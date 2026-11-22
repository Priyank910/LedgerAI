import type { LlmMessage } from '../src/domain/ai/loop'
import type { ToolSpec } from '../src/domain/ai/tools'
import { DEFAULT_OPENROUTER_MODEL, OpenRouterProvider } from '../src/llm/openrouter'
import type { Profile, Transaction } from '../src/domain/types'
import { bearerToken, hashPassword, newToken, sessionExpiry, tokenHash, verifyPassword } from './auth'
import { handleReleaseRequest, type ReleaseCache } from './releases'
import type { AuthStore, LedgerStore } from './store'

export type WorkerDeps = {
  auth: AuthStore
  ledger: LedgerStore
  openRouterKey?: string
  openRouterModel?: string
  githubToken?: string
  releaseCache?: ReleaseCache
  fetchImpl?: typeof fetch
  now?: () => string
}

function nowIso(deps: WorkerDeps): string {
  return deps.now?.() ?? new Date().toISOString()
}

function json(body: unknown, status = 200, origin: string | null = '*'): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': origin && origin !== 'null' ? origin : '*',
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      vary: 'Origin',
    },
  })
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json()
    if (typeof body === 'object' && body !== null && !Array.isArray(body)) return body as Record<string, unknown>
    return null
  } catch {
    return null
  }
}

function validEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim())
}

async function sessionUser(request: Request, deps: WorkerDeps) {
  const token = bearerToken(request.headers.get('authorization'))
  if (!token) return null
  return deps.auth.findSession(await tokenHash(token), nowIso(deps))
}

async function issueSession(userId: string, deps: WorkerDeps): Promise<string> {
  const token = newToken()
  await deps.auth.insertSession({ tokenHash: await tokenHash(token), userId, expiresAt: sessionExpiry(Date.parse(nowIso(deps)) || Date.now()) })
  return token
}

function isProfile(value: unknown): value is Profile {
  if (typeof value !== 'object' || value === null) return false
  const profile = value as Profile
  return typeof profile.shopName === 'string' && typeof profile.openingBalancePaise === 'number' && typeof profile.updatedAt === 'string'
}

function isTransaction(value: unknown): value is Transaction {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Transaction
  return typeof row.id === 'string' && (row.type === 'income' || row.type === 'expense') && typeof row.updatedAt === 'string'
}

export async function handleRequest(request: Request, deps: WorkerDeps): Promise<Response> {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return json({ ok: true }, 204, origin)
  const url = new URL(request.url)
  const path = url.pathname
  if (request.method === 'GET' && (path === '/app/latest' || path.startsWith('/app/download/'))) {
    return handleReleaseRequest(request, deps)
  }

  if (path === '/api/auth/sign-up' && request.method === 'POST') {
    const body = await readJson(request)
    if (!body || !validEmail(body.email) || typeof body.password !== 'string' || body.password.length < 6) return json({ error: 'bad-body' }, 400, origin)
    const email = body.email.trim().toLowerCase()
    if (await deps.auth.findUserByEmail(email)) return json({ error: 'exists' }, 409, origin)
    const userId = crypto.randomUUID()
    await deps.auth.insertUser({ id: userId, email, passwordHash: await hashPassword(body.password), createdAt: nowIso(deps) })
    const token = await issueSession(userId, deps)
    return json({ token, email, userId }, 201, origin)
  }

  if (path === '/api/auth/sign-in' && request.method === 'POST') {
    const body = await readJson(request)
    if (!body || !validEmail(body.email) || typeof body.password !== 'string') return json({ error: 'bad-body' }, 400, origin)
    const user = await deps.auth.findUserByEmail(body.email.trim().toLowerCase())
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) return json({ error: 'invalid' }, 401, origin)
    const token = await issueSession(user.id, deps)
    return json({ token, email: user.email, userId: user.id }, 200, origin)
  }

  const user = await sessionUser(request, deps)

  if (path === '/api/auth/session' && request.method === 'GET') {
    if (!user) return json({ error: 'unauthorized' }, 401, origin)
    return json({ email: user.email, userId: user.id }, 200, origin)
  }

  if (path === '/api/auth/sign-out' && request.method === 'POST') {
    const token = bearerToken(request.headers.get('authorization'))
    if (token) await deps.auth.deleteSession(await tokenHash(token))
    return json({ ok: true }, 200, origin)
  }

  if (!user) return json({ error: 'unauthorized' }, 401, origin)

  if (path === '/api/sync' && request.method === 'GET') {
    const since = url.searchParams.get('since')
    const profile = await deps.ledger.getProfile(user.id)
    const transactions = await deps.ledger.listTransactions(user.id, since)
    return json({ profile, transactions }, 200, origin)
  }

  if (path === '/api/sync' && request.method === 'POST') {
    const body = await readJson(request)
    if (!body) return json({ error: 'bad-body' }, 400, origin)
    if (body.profile != null && !isProfile(body.profile)) return json({ error: 'bad-body' }, 400, origin)
    if (!Array.isArray(body.transactions) || !body.transactions.every(isTransaction)) return json({ error: 'bad-body' }, 400, origin)
    if (isProfile(body.profile)) await deps.ledger.saveProfile(user.id, body.profile)
    const written = await deps.ledger.saveTransactions(user.id, body.transactions)
    return json({ written }, 200, origin)
  }

  if (path === '/api/ai-chat' && request.method === 'POST') {
    if (!deps.openRouterKey) return json({ error: 'server-not-configured' }, 503, origin)
    const body = await readJson(request)
    const locale = body?.locale
    if (!body || (locale !== 'en' && locale !== 'hi' && locale !== 'gu') || typeof body.today !== 'string' || !Array.isArray(body.messages) || !Array.isArray(body.tools)) {
      return json({ error: 'bad-body' }, 400, origin)
    }
    try {
      const provider = new OpenRouterProvider({
        apiKey: deps.openRouterKey,
        model: deps.openRouterModel || DEFAULT_OPENROUTER_MODEL,
        ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}),
      })
      const result = await provider.complete({
        locale,
        today: body.today,
        messages: body.messages as LlmMessage[],
        tools: body.tools as ToolSpec[],
      })
      return json(result, 200, origin)
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'openrouter-failed' }, 502, origin)
    }
  }

  return json({ error: 'not-found' }, 404, origin)
}
