import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { runChat, type ChatResult, type LlmMessage } from '../domain/ai/loop'
import { todayLocal } from '../domain/dates'
import { reduceLedger, type LedgerAction } from '../domain/ledger'
import type { PersistedState } from '../domain/types'
import { translate } from '../i18n'
import { PhraseProvider } from '../llm/phrase'
import { ProxyProvider } from '../llm/proxy'
import { chatTarget } from '../llm/target'
import { loadState, saveState } from '../storage/idb'
import { apiOrigin, createCloudTransport, currentSession, readToken, signIn as cloudSignIn, signOut as cloudSignOut, signUp as cloudSignUp } from '../sync/cloud'
import { syncOnce } from '../domain/sync'

export type SyncStatus =
  | { kind: 'unconfigured' }
  | { kind: 'signed-out' }
  | { kind: 'offline' }
  | { kind: 'syncing' }
  | { kind: 'synced'; at: string }
  | { kind: 'error' }

export type BooksApi = {
  state: PersistedState
  syncStatus: SyncStatus
  email: string | null
  notice: string
  notify: (message: string) => void
  dispatch: (action: LedgerAction) => void
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  ask: (question: string, history: LlmMessage[]) => Promise<ChatResult>
}

const BooksContext = createContext<BooksApi | null>(null)

export function useBooks(): BooksApi {
  const value = useContext(BooksContext)
  if (!value) throw new Error('books')
  return value
}

function signature(state: PersistedState): string {
  return JSON.stringify({ profile: state.profile, transactions: state.transactions })
}

function clockLabel(): string {
  return new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

export function BooksProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ kind: 'unconfigured' })
  const [email, setEmail] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const stateRef = useRef<PersistedState | null>(null)
  const tokenRef = useRef<string | null>(null)
  const skipSave = useRef(true)
  const noticeTimer = useRef<number>(0)
  stateRef.current = state

  useEffect(() => {
    void loadState().then((loaded) => {
      if (import.meta.env.DEV && new URLSearchParams(location.search).get('preview') === 'shop' && loaded.profile === null) {
        const now = new Date().toISOString()
        const stamp = (daysAgo: number) => {
          const date = new Date()
          date.setDate(date.getDate() - daysAgo)
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        }
        const today = stamp(0)
        const row = (id: string, type: 'income' | 'expense', title: string, amountPaise: number, daysAgo: number, category: string) => ({
          id, type, title, amountPaise, date: stamp(daysAgo), payment: 'cash', category, note: '', updatedAt: now, deletedAt: null,
        })
        setState({
          ...loaded,
          profile: { shopName: 'શ્રી ગણેશ ટેલર્સ', openingBalancePaise: 4_822_000, setupDate: today, updatedAt: now },
          transactions: [
            row('d1', 'income', 'બ્લાઉઝ સિલાઈ, મીના પટેલ', 85_000, 0, 'stitching'),
            row('d2', 'expense', 'બજારમાંથી કાપડ', 240_000, 0, 'cloth'),
            row('d3', 'income', 'શેરવાની, રાજેશભાઈ', 1_500_000, 0, 'stitching'),
            row('d4', 'expense', 'વીજળી બિલ', 180_000, 1, 'electricity'),
            row('d5', 'income', 'ધોરણ 6ના યુનિફોર્મ', 45_000, 2, 'stitching'),
            row('d6', 'expense', 'દોરો અને બટન', 32_000, 3, 'notions'),
            row('d7', 'income', 'પાટલૂન સિલાઈ', 120_000, 4, 'stitching'),
            row('d8', 'income', 'સાડી ફોલ', 15_000, 5, 'alteration'),
            row('d9', 'expense', 'ભાડું', 800_000, 32, 'rent'),
          ],
        })
        return
      }
      setState(loaded)
    })
  }, [])

  useEffect(() => {
    if (!state) return
    document.documentElement.lang = state.locale
    if (skipSave.current) {
      skipSave.current = false
      return
    }
    void saveState(state)
  }, [state])

  useEffect(() => {
    if (apiOrigin() === null) {
      setSyncStatus({ kind: 'unconfigured' })
      return
    }
    tokenRef.current = readToken()
    void currentSession().then((session) => {
      tokenRef.current = readToken()
      setEmail(session?.email ?? null)
      setSyncStatus(session ? { kind: 'syncing' } : { kind: 'signed-out' })
    })
  }, [])

  const ledgerKey = state ? signature(state) : ''
  useEffect(() => {
    if (!stateRef.current?.profile || !email) return
    const timer = window.setTimeout(() => void pushAndPull(), 500)
    const onOnline = () => void pushAndPull()
    window.addEventListener('online', onOnline)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('online', onOnline)
    }
  }, [ledgerKey, email])

  async function pushAndPull() {
    const current = stateRef.current
    if (!current?.profile || !tokenRef.current || apiOrigin() === null) return
    if (!navigator.onLine) {
      setSyncStatus({ kind: 'offline' })
      return
    }
    setSyncStatus({ kind: 'syncing' })
    try {
      const merged = await syncOnce({ profile: current.profile, transactions: current.transactions }, createCloudTransport())
      const next = { ...current, profile: merged.profile, transactions: merged.transactions }
      if (signature(next) !== signature(current)) setState(next)
      setSyncStatus({ kind: 'synced', at: clockLabel() })
    } catch {
      setSyncStatus({ kind: 'error' })
    }
  }

  function notify(message: string) {
    setNotice(message)
    window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(''), 2400)
  }

  function dispatch(action: LedgerAction) {
    setState((current) => (current ? reduceLedger(current, action) : current))
  }

  async function signIn(nextEmail: string, password: string): Promise<string | null> {
    if (apiOrigin() === null) return 'syncUnconfigured'
    try {
      const session = await cloudSignIn(nextEmail, password)
      tokenRef.current = session.token
      setEmail(session.email)
      return null
    } catch {
      return 'signInFailed'
    }
  }

  async function signUp(nextEmail: string, password: string): Promise<string | null> {
    if (apiOrigin() === null) return 'syncUnconfigured'
    try {
      const session = await cloudSignUp(nextEmail, password)
      tokenRef.current = session.token
      setEmail(session.email)
      return null
    } catch (error) {
      const code = error instanceof Error ? error.message : ''
      if (code === 'exists') return 'accountExists'
      if (code === 'short') return 'passwordTooShort'
      if (code === 'unreachable') return 'accountUnreachable'
      return 'accountFailed'
    }
  }

  async function signOut() {
    await cloudSignOut()
    tokenRef.current = null
    setEmail(null)
    if (apiOrigin() !== null) setSyncStatus({ kind: 'signed-out' })
  }

  async function ask(question: string, history: LlmMessage[]): Promise<ChatResult> {
    const current = stateRef.current
    if (!current?.profile) throw new Error('no-books')
    const target = chatTarget({
      mode: import.meta.env.VITE_LLM_MODE,
      apiUrl: import.meta.env.VITE_API_URL,
      accessToken: tokenRef.current,
      dev: import.meta.env.DEV,
    })
    if (target.kind === 'sign-in') throw new Error('sign-in')
    if (target.kind === 'unavailable') throw new Error('unavailable')
    const provider = target.kind === 'mock' ? new PhraseProvider() : new ProxyProvider(target.url, target.headers)
    return runChat({
      provider,
      snapshot: { profile: current.profile, transactions: current.transactions },
      locale: current.locale,
      today: todayLocal(),
      history,
      question,
    })
  }

  if (!state) return <p className="opening">{translate('en', 'opening')}</p>
  const api: BooksApi = { state, syncStatus, email, notice, notify, dispatch, signIn, signUp, signOut, ask }
  return <BooksContext.Provider value={api}>{children}</BooksContext.Provider>
}
