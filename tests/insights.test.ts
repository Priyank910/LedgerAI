import { describe, expect, it } from 'vitest'
import { monthTrend, quickAdds } from '../src/domain/insights'
import type { Transaction } from '../src/domain/types'

function row(partial: Partial<Transaction> & Pick<Transaction, 'id' | 'type' | 'title' | 'amountPaise' | 'date'>): Transaction {
  return {
    payment: 'cash',
    category: 'other',
    note: '',
    updatedAt: `${partial.date}T00:00:00.000Z`,
    deletedAt: null,
    ...partial,
  }
}

describe('home insights', () => {
  it('builds six labeled months ending on the current month', () => {
    const bars = monthTrend(
      [
        row({ id: 'a', type: 'income', title: 'Shirts', amountPaise: 80000, date: '2026-11-02', category: 'stitching' }),
        row({ id: 'b', type: 'expense', title: 'Cloth', amountPaise: 220000, date: '2026-10-04', category: 'cloth' }),
      ],
      '2026-11',
    )
    expect(bars).toHaveLength(6)
    expect(bars[5]).toEqual({ month: '2026-11', incomePaise: 80000, expensePaise: 0 })
    expect(bars[4]?.expensePaise).toBe(220000)
    expect(bars[0]?.month).toBe('2026-06')
  })

  it('offers the most repeated entries, then tailor presets', () => {
    expect(quickAdds([])[0]).toMatchObject({ category: 'stitching', fromHistory: false })
    const adds = quickAdds([
      row({ id: '1', type: 'expense', title: 'Cloth', amountPaise: 100, date: '2026-11-01', category: 'cloth' }),
      row({ id: '2', type: 'expense', title: 'Cloth', amountPaise: 100, date: '2026-11-02', category: 'cloth' }),
      row({ id: '3', type: 'income', title: 'Shirts', amountPaise: 100, date: '2026-11-03', category: 'stitching' }),
    ])
    expect(adds[0]).toMatchObject({ title: 'Cloth', fromHistory: true })
  })
})
