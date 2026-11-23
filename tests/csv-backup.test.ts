import { describe, expect, it } from 'vitest'
import { createBackup, parseBackup } from '../src/domain/backup'
import { buildCsv } from '../src/domain/csv'
import { freshState, reduceLedger } from '../src/domain/ledger'

describe('csv and backup', () => {
  it('writes a UTF-8 BOM and neutralises formula text without touching negative amounts', () => {
    const csv = buildCsv({
      labels: { shop: 'દુકાન', period: 'ગાળો', income: 'આવક', expense: 'ખર્ચ', net: 'ચોખ્ખું', balance: 'બાકી' },
      shopName: 'રમેશ',
      periodLabel: 'માર્ચ 2026',
      income: '800.00',
      expense: '1450.00',
      net: '-650.00',
      balance: '100.00',
      columns: { date: 'તારીખ', type: 'પ્રકાર', title: 'વિગત', category: 'વિભાગ', payment: 'ચુકવણી', amount: 'રકમ', note: 'નોંધ' },
      rows: [
        { date: '2026-03-01', type: 'expense', title: '=cmd|"/c calc"!A0', category: 'કપડું', payment: 'upi', amount: '-1450.00', note: 'લાલ' },
      ],
    })
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('રમેશ')
    expect(csv).toContain(`"'=cmd|""/c calc""!A0"`)
    expect(csv).toContain('"-650.00"')
    expect(csv).not.toContain(`"'-650.00"`)
  })

  it('round-trips a Ledger AI backup', () => {
    let state = freshState('device-1')
    state = reduceLedger(state, { type: 'set-locale', locale: 'gu' })
    state = reduceLedger(state, { type: 'start', shopName: 'રમેશ ટેલર્સ', openingBalancePaise: 2500000, setupDate: '2026-01-01', now: '2026-03-01T00:00:00.000Z' })
    state = reduceLedger(state, {
      type: 'add',
      id: 'row-1',
      now: '2026-03-02T00:00:00.000Z',
      entry: { type: 'income', title: 'સિલાઈ', amountPaise: 80000, date: '2026-03-02', payment: 'cash', category: 'stitching', note: '' },
    })
    const restored = parseBackup(createBackup(state, '2026-03-03T00:00:00.000Z'))
    expect(restored.locale).toBe('gu')
    expect(restored.profile.shopName).toBe('રમેશ ટેલર્સ')
    expect(restored.transactions).toHaveLength(1)
  })
})
