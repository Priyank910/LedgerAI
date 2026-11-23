import { isIsoDate } from './dates'
import { rupeesToPaise } from './money'
import type { Transaction, TxType } from './types'

export class ImportError extends Error {
  readonly code: 'invalid-json' | 'unrecognised' | 'invalid-ledger'

  constructor(code: ImportError['code']) {
    super(code)
    this.name = 'ImportError'
    this.code = code
  }
}

export type ImportedLedger = {
  shopName: string
  openingBalancePaise: number
  setupDate: string
  profileExtra?: Record<string, unknown>
  transactions: Array<Omit<Transaction, 'updatedAt' | 'deletedAt'>>
}

const LEDGER_KEYS = new Set(['shopName', 'openingBalance', 'setupDate', 'transactions'])
const TX_KEYS = new Set(['id', 'type', 'title', 'amount', 'date', 'payment', 'note'])

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function paymentId(value: string): string {
  const key = value.trim().toLowerCase()
  if (key === 'cash') return 'cash'
  if (key === 'upi') return 'upi'
  if (key === 'bank' || key === 'bank transfer') return 'bank'
  if (key === 'card') return 'card'
  return value.trim()
}

function numericAmount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  throw new ImportError('invalid-ledger')
}

function extras(source: Record<string, unknown>, known: Set<string>): Record<string, unknown> | undefined {
  const extra: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(source)) {
    if (!known.has(key)) extra[key] = value
  }
  return Object.keys(extra).length > 0 ? extra : undefined
}

function parseLedgerObject(data: Record<string, unknown>): ImportedLedger {
  if (typeof data.shopName !== 'string' || !data.shopName.trim()) throw new ImportError('invalid-ledger')
  if (!isIsoDate(typeof data.setupDate === 'string' ? data.setupDate : '')) throw new ImportError('invalid-ledger')
  const opening = numericAmount(data.openingBalance)
  if (!Array.isArray(data.transactions)) throw new ImportError('invalid-ledger')
  const ids = new Set<string>()
  const transactions: ImportedLedger['transactions'] = []
  for (const row of data.transactions) {
    if (!isObject(row)) throw new ImportError('invalid-ledger')
    if (typeof row.id !== 'string' || !row.id.trim() || ids.has(row.id)) throw new ImportError('invalid-ledger')
    if (row.type !== 'income' && row.type !== 'expense') throw new ImportError('invalid-ledger')
    if (typeof row.title !== 'string' || !row.title.trim()) throw new ImportError('invalid-ledger')
    if (typeof row.payment !== 'string' || !row.payment.trim()) throw new ImportError('invalid-ledger')
    if (!isIsoDate(typeof row.date === 'string' ? row.date : '')) throw new ImportError('invalid-ledger')
    if (row.note !== undefined && typeof row.note !== 'string') throw new ImportError('invalid-ledger')
    const rupees = numericAmount(row.amount)
    if (rupees <= 0) throw new ImportError('invalid-ledger')
    const amountPaise = rupeesToPaise(rupees)
    const type: TxType = row.type
    ids.add(row.id)
    const extra = extras(row, TX_KEYS)
    transactions.push({
      id: row.id,
      type,
      title: row.title.trim(),
      amountPaise,
      date: row.date as string,
      payment: paymentId(row.payment),
      category: 'other',
      note: typeof row.note === 'string' ? row.note : '',
      ...(extra ? { extra } : {}),
    })
  }
  const profileExtra = extras(data, LEDGER_KEYS)
  return {
    shopName: data.shopName.trim(),
    openingBalancePaise: rupeesToPaise(opening),
    setupDate: data.setupDate as string,
    ...(profileExtra ? { profileExtra } : {}),
    transactions,
  }
}

function unwrap(value: unknown): Record<string, unknown> | null {
  if (!isObject(value)) return null
  if (value.format === 'daily-ledger-backup') {
    if (value.version !== 1 || !isObject(value.ledger)) throw new ImportError('unrecognised')
    return value.ledger
  }
  if ('daily-ledger-data-v1' in value) {
    const stored = value['daily-ledger-data-v1']
    if (typeof stored === 'string') {
      try {
        const parsed: unknown = JSON.parse(stored)
        if (!isObject(parsed)) throw new ImportError('invalid-ledger')
        return parsed
      } catch (error) {
        if (error instanceof ImportError) throw error
        throw new ImportError('invalid-json')
      }
    }
    if (isObject(stored)) return stored
    throw new ImportError('invalid-ledger')
  }
  if ('shopName' in value && 'transactions' in value) return value
  return null
}

/** Accept a Daily Ledger backup file, a raw ledger object, or the localStorage key wrapper. */
export function importDailyLedger(raw: string): ImportedLedger {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new ImportError('invalid-json')
  }
  const ledger = unwrap(parsed)
  if (!ledger) throw new ImportError('unrecognised')
  return parseLedgerObject(ledger)
}
