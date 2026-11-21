import { describe, expect, it } from 'vitest'
import type { Profile, Transaction } from '../src/domain/types'
import { mergeLedgers, syncOnce, type SyncBody, type SyncTransport } from '../src/domain/sync'

const profile = (name: string, updatedAt: string): Profile => ({
  shopName: name,
  openingBalancePaise: 100,
  setupDate: '2026-01-01',
  updatedAt,
})

const tx = (id: string, title: string, updatedAt: string, deletedAt: string | null = null): Transaction => ({
  id,
  type: 'expense',
  title,
  amountPaise: 100,
  date: '2026-02-01',
  payment: 'cash',
  category: 'cloth',
  note: '',
  updatedAt,
  deletedAt,
})

describe('sync merge', () => {
  it('keeps the newer edit and lets the remote copy win a tie', () => {
    const local: SyncBody = {
      profile: profile('Local', '2026-03-02T00:00:00.000Z'),
      transactions: [tx('a', 'local newer', '2026-03-05T00:00:00.000Z'), tx('b', 'tie local', '2026-03-01T00:00:00.000Z')],
    }
    const remote: SyncBody = {
      profile: profile('Remote', '2026-03-01T00:00:00.000Z'),
      transactions: [
        tx('a', 'remote older', '2026-03-04T00:00:00.000Z'),
        tx('b', 'tie remote', '2026-03-01T00:00:00+00:00'),
        tx('c', 'remote only', '2026-03-03T00:00:00.000Z', '2026-03-04T00:00:00.000Z'),
      ],
    }
    const plan = mergeLedgers(local, remote)
    expect(plan.merged.profile?.shopName).toBe('Local')
    expect(plan.pushProfile).toBe(true)
    expect(plan.merged.transactions.map((row) => [row.id, row.title])).toEqual([
      ['a', 'local newer'],
      ['b', 'tie remote'],
      ['c', 'remote only'],
    ])
    expect(plan.pushTransactions.map((row) => row.id)).toEqual(['a'])
  })

  it('uploads local winners and keeps remote rows when the push succeeds', async () => {
    const pushed: SyncBody[] = []
    const transport: SyncTransport = {
      async pull() {
        return { profile: profile('Remote', '2026-01-01T00:00:00.000Z'), transactions: [] }
      },
      async push(body) {
        pushed.push(body)
      },
    }
    const next = await syncOnce({ profile: profile('Local', '2026-02-01T00:00:00.000Z'), transactions: [tx('a', 'mine', '2026-02-01T00:00:00.000Z')] }, transport)
    expect(next.profile?.shopName).toBe('Local')
    expect(pushed[0]?.transactions.map((row) => row.id)).toEqual(['a'])
    expect(next.transactions).toHaveLength(1)
  })
})
