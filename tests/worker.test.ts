import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { handleRequest } from '../worker/http'
import { acceptServerWrite } from '../worker/rules'
import { MemoryAuth, MemoryLedger } from '../worker/store'
import type { Profile, Transaction } from '../src/domain/types'

const now = '2026-11-21T00:00:00.000Z'

function deps() {
  return { auth: new MemoryAuth(), ledger: new MemoryLedger(), now: () => now, geminiKey: 'secret-key', geminiModel: 'gemini-2.5-flash' }
}

async function post(path: string, body: unknown, token?: string, extra?: Parameters<typeof handleRequest>[1]) {
  const base = extra ?? deps()
  return handleRequest(
    new Request(`https://ledger.test${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }),
    base,
  )
}

const profile = (updatedAt: string, name = 'Shop'): Profile => ({
  shopName: name,
  openingBalancePaise: 100,
  setupDate: '2026-01-01',
  updatedAt,
})

const row = (updatedAt: string, title = 'Cloth'): Transaction => ({
  id: 't1',
  type: 'expense',
  title,
  amountPaise: 100,
  date: '2026-02-01',
  payment: 'cash',
  category: 'cloth',
  note: '',
  updatedAt,
  deletedAt: null,
})

describe('worker auth and sync', () => {
  it('signs up with a bearer token and refuses another user\'s rows', async () => {
    const store = deps()
    const created = await post('/api/auth/sign-up', { email: 'Father@Shop.test', password: 'secret1' }, undefined, store)
    const body = (await created.json()) as { token: string; email: string }
    expect(created.status).toBe(201)
    expect(body.email).toBe('father@shop.test')
    expect(body.token.length).toBeGreaterThan(20)

    const again = await post('/api/auth/sign-in', { email: 'father@shop.test', password: 'wrong-pass' }, undefined, store)
    expect(again.status).toBe(401)
    const signed = await post('/api/auth/sign-in', { email: 'father@shop.test', password: 'secret1' }, undefined, store)
    const session = (await signed.json()) as { token: string }
    expect(signed.status).toBe(200)

    const pushed = await handleRequest(
      new Request('https://ledger.test/api/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ profile: profile('2026-03-01T00:00:00.000Z'), transactions: [row('2026-03-02T00:00:00.000Z')] }),
      }),
      store,
    )
    expect(pushed.status).toBe(200)

    const other = await post('/api/auth/sign-up', { email: 'other@shop.test', password: 'secret1' }, undefined, store)
    const otherToken = ((await other.json()) as { token: string }).token
    const foreign = await handleRequest(new Request('https://ledger.test/api/sync', { headers: { authorization: `Bearer ${otherToken}` } }), store)
    const foreignBody = (await foreign.json()) as { transactions: Transaction[] }
    expect(foreignBody.transactions).toEqual([])
  })

  it('keeps the newer row and a tombstone, and ignores a stale push', async () => {
    expect(acceptServerWrite(null, now)).toBe(true)
    expect(acceptServerWrite(now, now)).toBe(false)
    const store = deps()
    const created = await post('/api/auth/sign-up', { email: 'a@b.co', password: 'secret1' }, undefined, store)
    const token = ((await created.json()) as { token: string }).token
    const send = (transactions: Transaction[]) =>
      handleRequest(
        new Request('https://ledger.test/api/sync', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({ profile: null, transactions }),
        }),
        store,
      )
    await send([row('2026-04-02T00:00:00.000Z', 'new')])
    await send([row('2026-04-01T00:00:00.000Z', 'old')])
    await send([{ ...row('2026-04-03T00:00:00.000Z', 'new'), deletedAt: '2026-04-03T00:00:00.000Z' }])
    const pulled = await handleRequest(new Request('https://ledger.test/api/sync', { headers: { authorization: `Bearer ${token}` } }), store)
    const body = (await pulled.json()) as { transactions: Transaction[] }
    expect(body.transactions).toEqual([{ ...row('2026-04-03T00:00:00.000Z', 'new'), deletedAt: '2026-04-03T00:00:00.000Z' }])
  })

  it('proxies chat only for a signed-in session and keeps the key out of the response', async () => {
    const store = deps()
    const anon = await handleRequest(
      new Request('https://ledger.test/api/ai-chat', { method: 'POST', body: JSON.stringify({ locale: 'en', today: now, messages: [], tools: [] }) }),
      store,
    )
    expect(anon.status).toBe(401)
    const created = await post('/api/auth/sign-up', { email: 'a@b.co', password: 'secret1' }, undefined, store)
    const token = ((await created.json()) as { token: string }).token
    let seenKey = ''
    const response = await handleRequest(
      new Request('https://ledger.test/api/ai-chat', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ locale: 'gu', today: '2026-11-21', messages: [{ role: 'user', text: 'કેટલા?' }], tools: [] }),
      }),
      {
        ...store,
        fetchImpl: async (_url, init) => {
          seenKey = new Headers(init?.headers).get('x-goog-api-key') ?? ''
          expect(String(init?.body)).not.toContain('secret-key')
          return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'જોયું' }] } }] }))
        },
      },
    )
    const body = (await response.json()) as { text?: string; error?: string }
    expect(response.status).toBe(200)
    expect(body.text).toBe('જોયું')
    expect(seenKey).toBe('secret-key')
    expect(JSON.stringify(body)).not.toContain('secret-key')
  })

  it('indexes transactions by user and updated time', () => {
    const sql = readFileSync('migrations/0001_init.sql', 'utf8')
    expect(sql).toContain('CREATE INDEX transactions_user_updated_idx')
    expect(sql).toContain('PRIMARY KEY (user_id, id)')
  })
})
