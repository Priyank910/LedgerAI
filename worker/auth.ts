const ITERATIONS = 100_000
const SESSION_MS = 30 * 24 * 60 * 60 * 1000

function bytesToB64(bytes: Uint8Array): string {
  let text = ''
  for (const byte of bytes) text += String.fromCharCode(byte)
  return btoa(text)
}

function b64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const text = atob(value)
  const bytes = new Uint8Array(text.length)
  for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index)
  return bytes
}

function asBuffer(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy
}

export async function hashPassword(password: string, salt = crypto.getRandomValues(new Uint8Array(16))): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: asBuffer(salt), iterations: ITERATIONS, hash: 'SHA-256' }, key, 256)
  return `pbkdf2:${ITERATIONS}:${bytesToB64(salt)}:${bytesToB64(new Uint8Array(bits))}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, rounds, saltB64, hashB64] = stored.split(':')
  if (scheme !== 'pbkdf2' || !saltB64 || !hashB64) return false
  const salt = b64ToBytes(saltB64)
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: asBuffer(salt), iterations: Number(rounds), hash: 'SHA-256' },
    key,
    256,
  )
  return bytesToB64(new Uint8Array(bits)) === hashB64
}

export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return bytesToB64(bytes).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

export async function tokenHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return bytesToB64(new Uint8Array(digest))
}

export function sessionExpiry(now = Date.now()): string {
  return new Date(now + SESSION_MS).toISOString()
}

export function bearerToken(header: string | null): string | null {
  if (!header) return null
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim())
  return match?.[1] ?? null
}
