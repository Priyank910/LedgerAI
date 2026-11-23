export type TxType = 'income' | 'expense'

export type Locale = 'en' | 'hi' | 'gu'

export const CATEGORY_IDS = [
  'stitching',
  'cloth',
  'notions',
  'alteration',
  'rent',
  'electricity',
  'wages',
  'other',
] as const

export type CategoryId = (typeof CATEGORY_IDS)[number]

export const PAYMENT_IDS = ['cash', 'upi', 'bank', 'card'] as const

export type PaymentId = (typeof PAYMENT_IDS)[number]

export type Profile = {
  shopName: string
  openingBalancePaise: number
  setupDate: string
  updatedAt: string
  extra?: Record<string, unknown>
}

export type Transaction = {
  id: string
  type: TxType
  title: string
  amountPaise: number
  date: string
  payment: string
  category: string
  note: string
  updatedAt: string
  deletedAt: string | null
  extra?: Record<string, unknown>
}

export type LedgerSnapshot = {
  profile: Profile
  transactions: Transaction[]
}

export type PersistedState = {
  version: 1
  deviceId: string
  locale: Locale
  profile: Profile | null
  transactions: Transaction[]
}

export type EntryInput = {
  type: TxType
  title: string
  amountPaise: number
  date: string
  payment: string
  category: string
  note: string
}

export type Period =
  | { kind: 'day'; date: string }
  | { kind: 'month'; month: string }
  | { kind: 'year'; year: string }
  | { kind: 'range'; from: string; to: string }

export type PeriodQuery = {
  from: string
  to: string
  type?: TxType
  category?: string
  search?: string
}

export type PeriodTotals = {
  from: string
  to: string
  incomePaise: number
  expensePaise: number
  netPaise: number
  count: number
}
