import { describe, expect, it } from 'vitest'
import { shiftDay } from '../src/domain/dates'
import { balanceAsOf, periodTotals, resolvePeriod } from '../src/domain/period'
import type { Transaction } from '../src/domain/types'

const row = (partial: Partial<Transaction> & Pick<Transaction, 'id' | 'type' | 'amountPaise' | 'date'>): Transaction => ({
  title: partial.id,
  payment: 'cash',
  category: 'other',
  note: '',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  ...partial,
})

describe('periods', () => {
  it('covers a day, a month including leap day, a year, and a custom range', () => {
    expect(resolvePeriod({ kind: 'day', date: '2026-03-15' })).toEqual({ from: '2026-03-15', to: '2026-03-15' })
    expect(resolvePeriod({ kind: 'month', month: '2024-02' })).toEqual({ from: '2024-02-01', to: '2024-02-29' })
    expect(resolvePeriod({ kind: 'month', month: '2026-02' })).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(resolvePeriod({ kind: 'year', year: '2026' })).toEqual({ from: '2026-01-01', to: '2026-12-31' })
    expect(resolvePeriod({ kind: 'range', from: '2026-03-20', to: '2026-03-01' })).toEqual({ from: '2026-03-01', to: '2026-03-20' })
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('totals only the selected period and ignores deleted rows', () => {
    const transactions = [
      row({ id: 'in', type: 'income', amountPaise: 100, date: '2026-03-02' }),
      row({ id: 'out', type: 'expense', amountPaise: 40, date: '2026-03-03', category: 'cloth' }),
      row({ id: 'feb', type: 'expense', amountPaise: 5, date: '2026-02-28' }),
      row({ id: 'gone', type: 'expense', amountPaise: 999, date: '2026-03-04', deletedAt: '2026-03-05T00:00:00.000Z' }),
    ]
    const totals = periodTotals(transactions, { from: '2026-03-01', to: '2026-03-31' })
    expect(totals).toMatchObject({ incomePaise: 100, expensePaise: 40, netPaise: 60, count: 2 })
    expect(periodTotals(transactions, { from: '2026-03-01', to: '2026-03-31', category: 'cloth' }).expensePaise).toBe(40)
    expect(balanceAsOf(1000, transactions, '2026-03-03')).toBe(1055)
    expect(balanceAsOf(1000, transactions, '2026-02-28')).toBe(995)
  })
})
