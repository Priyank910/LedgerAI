import type { SyncBody, SyncTransport } from '../domain/sync'
import type { Profile, Transaction } from '../domain/types'

const TOKEN_KEY = 'ledger-ai-bearer'

export function apiOrigin(): string | null {
  const configured = import.meta.env.VITE_API_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  if (import.meta.env.DEV) return ''
  return null
}

export function readToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function writeToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

type ApiResult = { ok: boolean; status: number; body: Record<string, unknown> }

async function api(path: string, init: RequestInit = {}): Promise<ApiResult> {
  const origin = apiOrigin()
  if (origin === null) throw new Error('unconfigured')
  const headers = new Headers(init.headers)
  const token = readToken()
  if (token) headers.set('authorization', `Bearer ${token}`)
  if (init.body) headers.set('content-type', 'application/json')
  const response = await fetch(`${origin}${path}`, { ...init, headers })
  const parsed: unknown = await response.json().catch(() => ({}))
  const body = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
  return { ok: response.ok, status: response.status, body }
}

export async function signUp(email: string, password: string): Promise<{ token: string; email: string }> {
  if (password.length < 6) throw new Error('short')
  let result: ApiResult
  try {
    result = await api('/api/auth/sign-up', { method: 'POST', body: JSON.stringify({ email, password }) })
  } catch {
    throw new Error('unreachable')
  }
  if (!result.ok || typeof result.body.token !== 'string') {
    if (result.status === 409 || result.body.error === 'exists') throw new Error('exists')
    if (result.status === 400) throw new Error('short')
    throw new Error('create')
  }
  writeToken(result.body.token)
  return { token: result.body.token, email: String(result.body.email) }
}

export async function signIn(email: string, password: string): Promise<{ token: string; email: string }> {
  const result = await api('/api/auth/sign-in', { method: 'POST', body: JSON.stringify({ email, password }) })
  if (!result.ok || typeof result.body.token !== 'string') throw new Error('invalid')
  writeToken(result.body.token)
  return { token: result.body.token, email: String(result.body.email) }
}

export async function signOut(): Promise<void> {
  try {
    await api('/api/auth/sign-out', { method: 'POST' })
  } finally {
    writeToken(null)
  }
}

export async function currentSession(): Promise<{ email: string } | null> {
  if (!readToken() || apiOrigin() === null) return null
  const result = await api('/api/auth/session')
  if (!result.ok || typeof result.body.email !== 'string') {
    writeToken(null)
    return null
  }
  return { email: result.body.email }
}

export function createCloudTransport(): SyncTransport {
  return {
    async pull(): Promise<SyncBody> {
      const result = await api('/api/sync')
      if (!result.ok) throw new Error('sync')
      return {
        profile: (result.body.profile as Profile | null) ?? null,
        transactions: (result.body.transactions as Transaction[] | undefined) ?? [],
      }
    },
    async push(body: SyncBody) {
      const result = await api('/api/sync', { method: 'POST', body: JSON.stringify(body) })
      if (!result.ok) throw new Error('sync')
    },
  }
}
