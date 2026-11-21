import { freshState } from '../domain/ledger'
import type { Locale, PersistedState, Profile, Transaction } from '../domain/types'

const DB_NAME = 'ledger-ai'
const STORE = 'kv'
const KEY = 'state-v1'

function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'hi' || value === 'gu'
}

function isProfile(value: unknown): value is Profile {
  if (typeof value !== 'object' || value === null) return false
  const profile = value as Profile
  return typeof profile.shopName === 'string' && typeof profile.openingBalancePaise === 'number' && typeof profile.setupDate === 'string'
}

function isTransaction(value: unknown): value is Transaction {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Transaction
  return typeof row.id === 'string' && (row.type === 'income' || row.type === 'expense') && typeof row.amountPaise === 'number'
}

export function normalizeState(value: unknown): PersistedState | null {
  if (typeof value !== 'object' || value === null) return null
  const state = value as PersistedState
  if (state.version !== 1 || typeof state.deviceId !== 'string' || !isLocale(state.locale)) return null
  if (state.profile !== null && !isProfile(state.profile)) return null
  if (!Array.isArray(state.transactions) || !state.transactions.every(isTransaction)) return null
  return state
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function loadState(): Promise<PersistedState> {
  try {
    const db = await openDb()
    const stored = await new Promise<unknown>((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    return normalizeState(stored) ?? freshState()
  } catch {
    return freshState()
  }
}

export async function saveState(state: PersistedState): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(state, KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  localStorage.setItem('ledger-ai-locale', state.locale)
}
