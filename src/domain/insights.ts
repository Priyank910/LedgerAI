import { shiftMonth } from './dates'
import { isActive, periodTotals, resolvePeriod } from './period'
import type { Transaction, TxType } from './types'

export type MonthBar = { month: string; incomePaise: number; expensePaise: number }

export function monthTrend(transactions: Transaction[], endMonth: string, count = 6): MonthBar[] {
  const months: string[] = []
  let cursor = endMonth
  for (let index = 0; index < count; index += 1) {
    months.unshift(cursor)
    cursor = shiftMonth(cursor, -1)
  }
  return months.map((month) => {
    const range = resolvePeriod({ kind: 'month', month })
    const totals = periodTotals(transactions, range)
    return { month, incomePaise: totals.incomePaise, expensePaise: totals.expensePaise }
  })
}

export type QuickAdd = {
  type: TxType
  title: string
  category: string
  payment: string
  fromHistory: boolean
}

const PRESETS: QuickAdd[] = [
  { type: 'income', title: '', category: 'stitching', payment: 'upi', fromHistory: false },
  { type: 'income', title: '', category: 'alteration', payment: 'cash', fromHistory: false },
  { type: 'expense', title: '', category: 'cloth', payment: 'upi', fromHistory: false },
  { type: 'expense', title: '', category: 'wages', payment: 'cash', fromHistory: false },
]

export function quickAdds(transactions: Transaction[], limit = 4): QuickAdd[] {
  const counts = new Map<string, QuickAdd & { count: number; updatedAt: string }>()
  for (const row of transactions) {
    if (!isActive(row) || !row.title.trim()) continue
    const key = `${row.type}|${row.title.trim().toLowerCase()}|${row.category}`
    const current = counts.get(key)
    if (!current) {
      counts.set(key, {
        type: row.type,
        title: row.title.trim(),
        category: row.category,
        payment: row.payment,
        fromHistory: true,
        count: 1,
        updatedAt: row.updatedAt,
      })
    } else {
      current.count += 1
      if (row.updatedAt > current.updatedAt) {
        current.updatedAt = row.updatedAt
        current.payment = row.payment
      }
    }
  }
  const ranked = [...counts.values()].sort((a, b) => b.count - a.count || (a.updatedAt < b.updatedAt ? 1 : -1))
  if (ranked.length === 0) return PRESETS.slice(0, limit)
  return ranked.slice(0, limit).map(({ count: _count, updatedAt: _updatedAt, ...item }) => item)
}
