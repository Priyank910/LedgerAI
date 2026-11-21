import { shiftDay, shiftMonth } from './dates'
import type { ImportedLedger } from './importDailyLedger'
import type { EntryInput, Locale, PersistedState, Profile, Transaction, TxType } from './types'

export function freshState(deviceId: string = crypto.randomUUID()): PersistedState {
  return { version: 1, deviceId, locale: 'en', profile: null, transactions: [] }
}

export function defaultCategory(type: TxType): string {
  return type === 'income' ? 'stitching' : 'other'
}

export type LedgerAction =
  | { type: 'set-locale'; locale: Locale }
  | { type: 'start'; shopName: string; openingBalancePaise: number; setupDate: string; now: string }
  | { type: 'use-demo'; today: string; now: string }
  | { type: 'save-shop'; shopName: string; openingBalancePaise: number; now: string }
  | { type: 'add'; entry: EntryInput; id: string; now: string }
  | { type: 'update'; id: string; entry: EntryInput; now: string }
  | { type: 'remove'; id: string; now: string }
  | { type: 'import-daily'; imported: ImportedLedger; now: string }
  | { type: 'restore'; locale: Locale; profile: Profile; transactions: Transaction[]; now: string }
  | { type: 'apply-sync'; profile: Profile | null; transactions: Transaction[] }

function cleanTitle(title: string): string {
  return title.trim().slice(0, 200)
}

function entryOk(entry: EntryInput): boolean {
  return (
    (entry.type === 'income' || entry.type === 'expense') &&
    cleanTitle(entry.title).length > 0 &&
    Number.isSafeInteger(entry.amountPaise) &&
    entry.amountPaise > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(entry.date) &&
    entry.payment.trim().length > 0 &&
    entry.category.trim().length > 0
  )
}

function toTransaction(entry: EntryInput, id: string, now: string): Transaction {
  return {
    id,
    type: entry.type,
    title: cleanTitle(entry.title),
    amountPaise: entry.amountPaise,
    date: entry.date,
    payment: entry.payment.trim(),
    category: entry.category.trim(),
    note: entry.note.trim().slice(0, 2000),
    updatedAt: now,
    deletedAt: null,
  }
}

export function demoTransactions(today: string, now: string): { profile: Profile; transactions: Transaction[] } {
  const previousMonth = `${shiftMonth(today.slice(0, 7), -1)}-15`
  const make = (
    id: string,
    type: TxType,
    title: string,
    amountPaise: number,
    date: string,
    payment: string,
    category: string,
    note: string,
  ): Transaction => ({
    id,
    type,
    title,
    amountPaise,
    date,
    payment,
    category,
    note,
    updatedAt: now,
    deletedAt: null,
  })
  return {
    profile: {
      shopName: 'રમેશ ટેલર્સ',
      openingBalancePaise: 2_500_000,
      setupDate: shiftDay(today, -40),
      updatedAt: now,
    },
    transactions: [
      make('demo-wedding', 'income', 'લગ્નનો ઓર્ડર', 12_500_000, shiftDay(today, -20), 'upi', 'stitching', 'પાંચ શેરવાની'),
      make('demo-wages', 'expense', 'મજૂરી', 800_000, shiftDay(today, -12), 'cash', 'wages', ''),
      make('demo-power', 'expense', 'વીજળી બિલ', 92_000, shiftDay(today, -10), 'bank', 'electricity', ''),
      make('demo-alter', 'income', 'પેન્ટ સુધારો', 15_000, shiftDay(today, -3), 'cash', 'alteration', ''),
      make('demo-hindi-cloth', 'expense', 'कपड़ा खरीदी', 220_000, shiftDay(today, -2), 'cash', 'cloth', 'सूटिंग का थान'),
      make('demo-cloth', 'expense', 'કપડું - સૂટિંગ', 145_000, shiftDay(today, -1), 'upi', 'cloth', 'લાલ સૂટિંગ'),
      make('demo-shirts', 'income', 'બે શર્ટ સિલાઈ', 80_000, today, 'cash', 'stitching', ''),
      make('demo-last-cloth', 'expense', 'કપડું', 145_000, previousMonth, 'upi', 'cloth', 'ગયા મહિના'),
    ],
  }
}

export function reduceLedger(state: PersistedState, action: LedgerAction): PersistedState {
  switch (action.type) {
    case 'set-locale':
      return { ...state, locale: action.locale }
    case 'start': {
      const shopName = action.shopName.trim()
      if (!shopName || !Number.isSafeInteger(action.openingBalancePaise) || action.openingBalancePaise < 0) return state
      return {
        ...state,
        profile: {
          shopName,
          openingBalancePaise: action.openingBalancePaise,
          setupDate: action.setupDate,
          updatedAt: action.now,
        },
        transactions: [],
      }
    }
    case 'use-demo': {
      const demo = demoTransactions(action.today, action.now)
      return { ...state, profile: demo.profile, transactions: demo.transactions }
    }
    case 'save-shop': {
      if (!state.profile) return state
      const shopName = action.shopName.trim()
      if (!shopName || !Number.isSafeInteger(action.openingBalancePaise) || action.openingBalancePaise < 0) return state
      return {
        ...state,
        profile: { ...state.profile, shopName, openingBalancePaise: action.openingBalancePaise, updatedAt: action.now },
      }
    }
    case 'add': {
      if (!state.profile || !entryOk(action.entry) || state.transactions.some((row) => row.id === action.id)) return state
      return { ...state, transactions: [toTransaction(action.entry, action.id, action.now), ...state.transactions] }
    }
    case 'update': {
      if (!entryOk(action.entry)) return state
      return {
        ...state,
        transactions: state.transactions.map((row) => {
          if (row.id !== action.id || row.deletedAt) return row
          return { ...toTransaction(action.entry, row.id, action.now), extra: row.extra }
        }),
      }
    }
    case 'remove':
      return {
        ...state,
        transactions: state.transactions.map((row) =>
          row.id === action.id && !row.deletedAt ? { ...row, deletedAt: action.now, updatedAt: action.now } : row,
        ),
      }
    case 'import-daily': {
      const importedIds = new Set(action.imported.transactions.map((row) => row.id))
      const tombstones = state.transactions
        .filter((row) => !importedIds.has(row.id))
        .map((row) => ({ ...row, deletedAt: action.now, updatedAt: action.now }))
      const brought: Transaction[] = action.imported.transactions.map((row) => ({
        ...row,
        updatedAt: action.now,
        deletedAt: null,
      }))
      const profile: Profile = {
        shopName: action.imported.shopName,
        openingBalancePaise: action.imported.openingBalancePaise,
        setupDate: action.imported.setupDate,
        updatedAt: action.now,
        ...(action.imported.profileExtra ? { extra: action.imported.profileExtra } : {}),
      }
      return { ...state, profile, transactions: [...brought, ...tombstones] }
    }
    case 'restore': {
      const profile: Profile = { ...action.profile, updatedAt: action.now }
      return {
        ...state,
        locale: action.locale,
        profile,
        transactions: action.transactions.map((row) => ({ ...row, updatedAt: action.now })),
      }
    }
    case 'apply-sync':
      return { ...state, profile: action.profile, transactions: action.transactions }
    default: {
      const neverAction: never = action
      return neverAction
    }
  }
}
