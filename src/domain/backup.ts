import { isIsoDate } from './dates'
import type { Locale, PersistedState, Profile, Transaction, TxType } from './types'

export class BackupError extends Error {
  constructor() {
    super('invalid-backup')
    this.name = 'BackupError'
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'hi' || value === 'gu'
}

function isType(value: unknown): value is TxType {
  return value === 'income' || value === 'expense'
}

export function createBackup(state: PersistedState, exportedAt: string): string {
  return JSON.stringify(
    {
      format: 'ledger-ai-backup',
      version: 1,
      exportedAt,
      locale: state.locale,
      profile: state.profile,
      transactions: state.transactions,
    },
    null,
    2,
  )
}

function parseProfile(value: unknown): Profile {
  if (!isObject(value)) throw new BackupError()
  if (typeof value.shopName !== 'string' || !value.shopName.trim()) throw new BackupError()
  if (typeof value.openingBalancePaise !== 'number' || !Number.isSafeInteger(value.openingBalancePaise)) throw new BackupError()
  if (typeof value.setupDate !== 'string' || !isIsoDate(value.setupDate)) throw new BackupError()
  if (typeof value.updatedAt !== 'string' || Number.isNaN(Date.parse(value.updatedAt))) throw new BackupError()
  const extra = isObject(value.extra) ? value.extra : undefined
  return {
    shopName: value.shopName.trim(),
    openingBalancePaise: value.openingBalancePaise,
    setupDate: value.setupDate,
    updatedAt: value.updatedAt,
    ...(extra ? { extra } : {}),
  }
}

function parseTransaction(value: unknown): Transaction {
  if (!isObject(value)) throw new BackupError()
  if (typeof value.id !== 'string' || !value.id) throw new BackupError()
  if (!isType(value.type)) throw new BackupError()
  if (typeof value.title !== 'string' || !value.title.trim()) throw new BackupError()
  if (typeof value.amountPaise !== 'number' || !Number.isSafeInteger(value.amountPaise) || value.amountPaise <= 0) {
    throw new BackupError()
  }
  if (typeof value.date !== 'string' || !isIsoDate(value.date)) throw new BackupError()
  if (typeof value.payment !== 'string' || !value.payment.trim()) throw new BackupError()
  if (typeof value.category !== 'string' || !value.category.trim()) throw new BackupError()
  if (typeof value.note !== 'string') throw new BackupError()
  if (typeof value.updatedAt !== 'string' || Number.isNaN(Date.parse(value.updatedAt))) throw new BackupError()
  const deletedAt = value.deletedAt
  if (deletedAt !== null && (typeof deletedAt !== 'string' || Number.isNaN(Date.parse(deletedAt)))) throw new BackupError()
  const extra = isObject(value.extra) ? value.extra : undefined
  return {
    id: value.id,
    type: value.type,
    title: value.title,
    amountPaise: value.amountPaise,
    date: value.date,
    payment: value.payment,
    category: value.category,
    note: value.note,
    updatedAt: value.updatedAt,
    deletedAt,
    ...(extra ? { extra } : {}),
  }
}

export function parseBackup(raw: string): { locale: Locale; profile: Profile; transactions: Transaction[] } {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new BackupError()
  }
  if (!isObject(parsed) || parsed.format !== 'ledger-ai-backup' || parsed.version !== 1) throw new BackupError()
  if (!isLocale(parsed.locale)) throw new BackupError()
  const profile = parseProfile(parsed.profile)
  if (!Array.isArray(parsed.transactions)) throw new BackupError()
  const ids = new Set<string>()
  const transactions = parsed.transactions.map((row) => {
    const transaction = parseTransaction(row)
    if (ids.has(transaction.id)) throw new BackupError()
    ids.add(transaction.id)
    return transaction
  })
  return { locale: parsed.locale, profile, transactions }
}
