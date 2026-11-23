import { describe, expect, it } from 'vitest'
import { importDailyLedger, ImportError } from '../src/domain/importDailyLedger'
import { freshState, reduceLedger } from '../src/domain/ledger'

const ledger = {
  shopName: 'દુકાન',
  openingBalance: 123.45,
  setupDate: '2026-01-01',
  extra: 'preserve',
  transactions: [
    { id: '1', type: 'income', title: 'Sale', amount: 25, date: '2026-01-05', payment: 'Cash', note: 'hello\nworld' },
    { id: '2', type: 'expense', title: 'Stock', amount: 3.5, date: '2026-01-06', payment: 'UPI', keep: true },
  ],
}

describe('Daily Ledger import', () => {
  it('reads a backup, the raw localStorage object, and the storage-key wrapper', () => {
    const backup = JSON.stringify({ format: 'daily-ledger-backup', version: 1, ledger })
    const wrapped = JSON.stringify({ 'daily-ledger-data-v1': JSON.stringify(ledger) })
    for (const raw of [backup, JSON.stringify(ledger), wrapped]) {
      const imported = importDailyLedger(raw)
      expect(imported.shopName).toBe('દુકાન')
      expect(imported.openingBalancePaise).toBe(12345)
      expect(imported.profileExtra).toEqual({ extra: 'preserve' })
      expect(imported.transactions[0]).toMatchObject({ id: '1', amountPaise: 2500, payment: 'cash', note: 'hello\nworld', category: 'other' })
      expect(imported.transactions[1]).toMatchObject({ payment: 'upi', amountPaise: 350, extra: { keep: true } })
    }
  })

  it('rejects invalid files and tombstones rows the import replaces', () => {
    expect(() => importDailyLedger('nope')).toThrow(ImportError)
    expect(() => importDailyLedger(JSON.stringify({ format: 'daily-ledger-backup', version: 2, ledger }))).toThrow(ImportError)
    let state = freshState('device')
    state = reduceLedger(state, { type: 'start', shopName: 'Old shop', openingBalancePaise: 0, setupDate: '2026-01-01', now: '2026-01-01T00:00:00.000Z' })
    state = reduceLedger(state, {
      type: 'add',
      id: 'old',
      now: '2026-01-01T00:00:00.000Z',
      entry: { type: 'expense', title: 'Old', amountPaise: 100, date: '2026-01-02', payment: 'cash', category: 'other', note: '' },
    })
    const next = reduceLedger(state, {
      type: 'import-daily',
      now: '2026-04-01T00:00:00.000Z',
      imported: importDailyLedger(JSON.stringify(ledger)),
    })
    const old = next.transactions.find((row) => row.id === 'old')
    expect(old?.deletedAt).toBe('2026-04-01T00:00:00.000Z')
    expect(next.transactions.find((row) => row.id === '1')?.deletedAt).toBeNull()
    expect(next.profile?.shopName).toBe('દુકાન')
  })
})
