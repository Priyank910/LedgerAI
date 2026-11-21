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
import { createSupabase, createTransport, readSupabaseEnv } from '../sync/remote'
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
  const userIdRef = useRef<string | null>(null)
  const clientRef = useRef<ReturnType<typeof createSupabase> | null>(null)
  const skipSave = useRef(true)
  const noticeTimer = useRef<number>(0)
  stateRef.current = state

  useEffect(() => {
    void loadState().then(setState)
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
    const env = readSupabaseEnv()
    if (!env) {
      setSyncStatus({ kind: 'unconfigured' })
      return
    }
    const client = createSupabase(env)
    clientRef.current = client
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null)
      tokenRef.current = session?.access_token ?? null
      userIdRef.current = session?.user.id ?? null
      if (!session) setSyncStatus({ kind: 'signed-out' })
    })
    return () => data.subscription.unsubscribe()
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
    const client = clientRef.current
    const userId = userIdRef.current
    if (!current?.profile || !client || !userId) return
    if (!navigator.onLine) {
      setSyncStatus({ kind: 'offline' })
      return
    }
    setSyncStatus({ kind: 'syncing' })
    try {
      const merged = await syncOnce({ profile: current.profile, transactions: current.transactions }, createTransport(client, userId))
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
    const client = clientRef.current
    if (!client) return 'syncUnconfigured'
    const { error } = await client.auth.signInWithPassword({ email: nextEmail.trim(), password })
    if (!error) return null
    return /invalid login/i.test(error.message) ? 'signInFailed' : 'authFailed'
  }

  async function signUp(nextEmail: string, password: string): Promise<string | null> {
    const client = clientRef.current
    if (!client) return 'syncUnconfigured'
    const { data, error } = await client.auth.signUp({ email: nextEmail.trim(), password })
    if (error) return 'authFailed'
    if (!data.session) return 'signUpConfirm'
    return null
  }

  async function signOut() {
    await clientRef.current?.auth.signOut()
  }

  async function ask(question: string, history: LlmMessage[]): Promise<ChatResult> {
    const current = stateRef.current
    if (!current?.profile) throw new Error('no-books')
    const env = readSupabaseEnv()
    const target = chatTarget({
      mode: import.meta.env.VITE_LLM_MODE,
      proxyUrl: import.meta.env.VITE_AI_PROXY_URL,
      supabaseUrl: env?.url,
      anonKey: env?.anonKey,
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
