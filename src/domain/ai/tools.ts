import { isIsoDate } from '../dates'
import { categoryTotals, periodTotals, balanceAsOf, transactionsInPeriod } from '../period'
import type { LedgerSnapshot, PeriodQuery, TxType } from '../types'

export const TOOL_NAMES = ['period_totals', 'list_transactions', 'balance_on', 'category_totals'] as const

export type ToolName = (typeof TOOL_NAMES)[number]

export type ToolSpec = {
  name: ToolName
  description: string
  parameters: Record<string, unknown>
}

const dateSchema = { type: 'string', description: 'Calendar date YYYY-MM-DD' }

export const TOOL_SPECS: ToolSpec[] = [
  {
    name: 'period_totals',
    description: 'Income, expense, net, and count for an inclusive date range. Use this before stating any total.',
    parameters: {
      type: 'object',
      properties: {
        from: dateSchema,
        to: dateSchema,
        type: { type: 'string', enum: ['income', 'expense'] },
        category: { type: 'string', description: 'Category id: stitching, cloth, notions, alteration, rent, electricity, wages, other' },
        search: { type: 'string', description: 'Match title or note' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'list_transactions',
    description: 'List matching entries. Use this when the person wants the rows, not only a total.',
    parameters: {
      type: 'object',
      properties: {
        from: dateSchema,
        to: dateSchema,
        type: { type: 'string', enum: ['income', 'expense'] },
        category: { type: 'string' },
        search: { type: 'string' },
        limit: { type: 'integer' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'balance_on',
    description: 'Cash balance at the end of a date, including the opening balance and every earlier entry.',
    parameters: { type: 'object', properties: { date: dateSchema }, required: ['date'] },
  },
  {
    name: 'category_totals',
    description: 'Totals grouped by category for an inclusive date range.',
    parameters: {
      type: 'object',
      properties: {
        from: dateSchema,
        to: dateSchema,
        type: { type: 'string', enum: ['income', 'expense'] },
      },
      required: ['from', 'to'],
    },
  },
]

const CATEGORY_ALIASES: Record<string, string> = {
  stitching: 'stitching',
  silai: 'stitching',
  सिलाई: 'stitching',
  સિલાઈ: 'stitching',
  cloth: 'cloth',
  kapda: 'cloth',
  kapad: 'cloth',
  कपड़ा: 'cloth',
  कपडा: 'cloth',
  कपडे: 'cloth',
  કપડું: 'cloth',
  કપડા: 'cloth',
  notions: 'notions',
  thread: 'notions',
  buttons: 'notions',
  धागा: 'notions',
  દોરો: 'notions',
  બટન: 'notions',
  alteration: 'alteration',
  सुधार: 'alteration',
  સુધારો: 'alteration',
  rent: 'rent',
  kiraya: 'rent',
  किराया: 'rent',
  ભાડું: 'rent',
  electricity: 'electricity',
  bijli: 'electricity',
  बिजली: 'electricity',
  વીજળી: 'electricity',
  wages: 'wages',
  salary: 'wages',
  मजदूरी: 'wages',
  मज़दूरी: 'wages',
  મજૂરી: 'wages',
  other: 'other',
  અન્ય: 'other',
  अन्य: 'other',
}

export function canonicalCategory(value: string): string {
  const trimmed = value.trim()
  return CATEGORY_ALIASES[trimmed] ?? CATEGORY_ALIASES[trimmed.toLowerCase()] ?? trimmed
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value)
      if (isObject(parsed)) return parsed
    } catch {
      return {}
    }
  }
  return isObject(value) ? value : {}
}

function isToolName(name: string): name is ToolName {
  return (TOOL_NAMES as readonly string[]).includes(name)
}

function optionalType(value: unknown): TxType | undefined {
  return value === 'income' || value === 'expense' ? value : undefined
}

function readRange(args: Record<string, unknown>): PeriodQuery | { error: 'bad-date' } {
  const from = typeof args.from === 'string' ? args.from : ''
  const to = typeof args.to === 'string' ? args.to : ''
  if (!isIsoDate(from) || !isIsoDate(to)) return { error: 'bad-date' }
  const [start, end] = from <= to ? [from, to] : [to, from]
  const category = typeof args.category === 'string' && args.category.trim() ? canonicalCategory(args.category) : undefined
  const search = typeof args.search === 'string' && args.search.trim() ? args.search.trim() : undefined
  return { from: start, to: end, type: optionalType(args.type), ...(category ? { category } : {}), ...(search ? { search } : {}) }
}

export function runTool(name: string, rawArgs: unknown, snapshot: LedgerSnapshot): unknown {
  if (!isToolName(name)) return { error: 'unknown-tool' }
  const args = asRecord(rawArgs)
  switch (name) {
    case 'period_totals': {
      const query = readRange(args)
      if ('error' in query) return query
      return periodTotals(snapshot.transactions, query)
    }
    case 'list_transactions': {
      const query = readRange(args)
      if ('error' in query) return query
      const requested = typeof args.limit === 'number' ? Math.floor(args.limit) : 20
      const limit = Math.min(50, Math.max(1, requested))
      const matched = transactionsInPeriod(snapshot.transactions, query)
      const rows = matched.slice(0, limit)
      return {
        from: query.from,
        to: query.to,
        count: matched.length,
        transactions: rows.map((row) => ({
          date: row.date,
          type: row.type,
          title: row.title,
          category: row.category,
          payment: row.payment,
          amountPaise: row.amountPaise,
          note: row.note,
        })),
      }
    }
    case 'balance_on': {
      const date = typeof args.date === 'string' ? args.date : ''
      if (!isIsoDate(date)) return { error: 'bad-date' }
      return { date, balancePaise: balanceAsOf(snapshot.profile.openingBalancePaise, snapshot.transactions, date) }
    }
    case 'category_totals': {
      const query = readRange(args)
      if ('error' in query) return query
      return { from: query.from, to: query.to, rows: categoryTotals(snapshot.transactions, query) }
    }
    default: {
      const neverName: never = name
      return neverName
    }
  }
}
