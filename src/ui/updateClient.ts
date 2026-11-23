import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import packageJson from '../../package.json'
import { readAndroidRelease, readWindowsManifest, shouldPrompt, type ParsedRelease } from '../domain/appUpdate'

export const bundledVersion: string = packageJson.version
const UPDATE_ORIGIN = 'https://ledger-ai.priyank-chavda.workers.dev'

export type LaterMark = { version: string; at: number }

export type CheckResult =
  | { status: 'browser'; currentVersion: string }
  | { status: 'current'; currentVersion: string; latestVersion: string }
  | { status: 'available'; currentVersion: string; release: ParsedRelease; platform: 'windows' | 'android'; quiet: boolean }
  | { status: 'error'; currentVersion: string; reason: string }

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function updateOrigin(): string {
  const configured = import.meta.env.VITE_API_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  if (import.meta.env.DEV) return ''
  return UPDATE_ORIGIN
}

export function nativePlatform(): 'windows' | 'android' | 'browser' {
  if (isTauri()) return 'windows'
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') return 'android'
  return 'browser'
}

export async function installedVersion(): Promise<string> {
  try {
    if (isTauri()) {
      const { getVersion } = await import('@tauri-apps/api/app')
      const version = await getVersion()
      if (version) return version
    } else if (nativePlatform() === 'android') {
      const info = await App.getInfo()
      if (typeof info.version === 'string' && info.version.length > 0) return info.version
    }
  } catch (error) {
    console.error('[ledger-ai update] installed version', error)
  }
  return bundledVersion
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

export async function checkForUpdate(input: {
  manual: boolean
  later: LaterMark | null
  now?: number
  fetchImpl?: typeof fetch
  currentVersion?: string
  platform?: 'windows' | 'android' | 'browser'
  origin?: string
}): Promise<CheckResult> {
  const platform = input.platform ?? nativePlatform()
  const currentVersion = input.currentVersion ?? (await installedVersion())
  if (platform === 'browser') return { status: 'browser', currentVersion }
  const origin = input.origin ?? updateOrigin()
  if (!origin) return { status: 'error', currentVersion, reason: 'This build has no update server.' }
  const path = platform === 'windows' ? `/app/latest?platform=windows&current=${encodeURIComponent(currentVersion)}` : '/app/latest?platform=android'
  let response: Response
  try {
    const fetchImpl = input.fetchImpl ?? fetch
    response = await fetchImpl(`${origin}${path}`)
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'The network request failed.'
    console.error('[ledger-ai update] request failed', error)
    return { status: 'error', currentVersion, reason }
  }
  const body = await readBody(response)
  if (!response.ok) {
    const server = typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string' ? (body as { error: string }).error : `HTTP ${response.status}`
    const reason = `The update server returned ${server}.`
    console.error('[ledger-ai update]', reason)
    return { status: 'error', currentVersion, reason }
  }
  const parsed = platform === 'windows' ? readWindowsManifest(body) : readAndroidRelease(body)
  if (!parsed.ok) {
    console.error('[ledger-ai update]', parsed.reason)
    return { status: 'error', currentVersion, reason: parsed.reason }
  }
  const now = input.now ?? Date.now()
  const newer = shouldPrompt({ currentVersion, latestVersion: parsed.release.version, laterVersion: null, laterAt: null, now, manual: true })
  if (!newer) return { status: 'current', currentVersion, latestVersion: parsed.release.version }
  const quiet = !input.manual && !shouldPrompt({ currentVersion, latestVersion: parsed.release.version, laterVersion: input.later?.version ?? null, laterAt: input.later?.at ?? null, now, manual: false })
  return { status: 'available', currentVersion, release: parsed.release, platform, quiet }
}
