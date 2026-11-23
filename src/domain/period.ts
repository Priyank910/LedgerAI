import { isIsoDate, isIsoMonth, isIsoYear, lastDayOfMonth } from './dates'
import type { Period, PeriodQuery, PeriodTotals, Transaction, TxType } from './types'

export function resolvePeriod(period: Period): { from: string; to: string } {
  switch (period.kind) {
    case 'day':
      return { from: period.date, to: period.date }
    case 'month':
      return { from: `${period.month}-01`, to: lastDayOfMonth(period.month) }
    case 'year':
      return { from: `${period.year}-01-01`, to: `${period.year}-12-31` }
    case 'range':
      return period.from <= period.to ? { from: period.from, to: period.to } : { from: period.to, to: period.from }
    default: {
      const neverPeriod: never = period
      return neverPeriod
    }
  }
}

export function isActive(transaction: Transaction): boolean {
  return transaction.deletedAt === null
}

export function balanceAsOf(openingBalancePaise: number, transactions: Transaction[], date: string): number {
  let balance = openingBalancePaise
  for (const transaction of transactions) {
    if (!isActive(transaction) || transaction.date > date) continue
    balance += transaction.type === 'income' ? transaction.amountPaise : -transaction.amountPaise
  }
  return balance
}

function matches(transaction: Transaction, query: PeriodQuery): boolean {
  if (!isActive(transaction)) return false
  if (transaction.date < query.from || transaction.date > query.to) return false
  if (query.type && transaction.type !== query.type) return false
  if (query.category && transaction.category !== query.category) return false
  if (query.search) {
    const haystack = `${transaction.title}\n${transaction.note}\n${transaction.category}\n${transaction.payment}`.toLowerCase()
    if (!haystack.includes(query.search.trim().toLowerCase())) return false
  }
  return true
}

export function recentTransactions(transactions: Transaction[], limit: number): Transaction[] {
  return transactions
    .filter(isActive)
    .sort((a, b) => (a.date === b.date ? compareTitle(b.updatedAt, a.updatedAt) : a.date < b.date ? 1 : -1))
    .slice(0, limit)
}

export function transactionsInPeriod(transactions: Transaction[], query: PeriodQuery): Transaction[] {
  return transactions
    .filter((transaction) => matches(transaction, query))
    .sort((a, b) => (a.date === b.date ? compareTitle(b.updatedAt, a.updatedAt) : a.date < b.date ? 1 : -1))
}

function compareTitle(a: string, b: string): number {
  if (a === b) return 0
  return a < b ? -1 : 1
}

export function periodTotals(transactions: Transaction[], query: PeriodQuery): PeriodTotals {
  let incomePaise = 0
  let expensePaise = 0
  let count = 0
  for (const transaction of transactions) {
    if (!matches(transaction, query)) continue
    count += 1
    if (transaction.type === 'income') incomePaise += transaction.amountPaise
    else expensePaise += transaction.amountPaise
  }
  return {
    from: query.from,
    to: query.to,
    incomePaise,
    expensePaise,
    netPaise: incomePaise - expensePaise,
    count,
  }
}

export function categoryTotals(
  transactions: Transaction[],
  query: { from: string; to: string; type?: TxType },
): { category: string; incomePaise: number; expensePaise: number; count: number }[] {
  const rows = new Map<string, { category: string; incomePaise: number; expensePaise: number; count: number }>()
  for (const transaction of transactions) {
    if (!matches(transaction, query)) continue
    const row = rows.get(transaction.category) ?? {
      category: transaction.category,
      incomePaise: 0,
      expensePaise: 0,
      count: 0,
    }
    row.count += 1
    if (transaction.type === 'income') row.incomePaise += transaction.amountPaise
    else row.expensePaise += transaction.amountPaise
    rows.set(transaction.category, row)
  }
  return [...rows.values()].sort((a, b) => b.incomePaise + b.expensePaise - (a.incomePaise + a.expensePaise))
}

export function assertPeriod(period: Period): string | null {
  switch (period.kind) {
    case 'day':
      return isIsoDate(period.date) ? null : 'date'
    case 'month':
      return isIsoMonth(period.month) ? null : 'date'
    case 'year':
      return isIsoYear(period.year) ? null : 'date'
    case 'range':
      return isIsoDate(period.from) && isIsoDate(period.to) ? null : 'date'
    default: {
      const neverPeriod: never = period
      return neverPeriod
    }
  }
}
