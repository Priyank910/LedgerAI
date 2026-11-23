import { compareReleaseVersions, shouldOfferUpdate } from './releaseVersion'

/** Automatic checks after the app returns to the foreground wait at least this long. */
export const FOREGROUND_CHECK_MS = 30 * 60 * 1000

const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/

export type ParsedRelease = {
  version: string
  notes: string
  downloadUrl: string
  releaseUrl: string
}

export type ReleaseRead = { ok: true; release: ParsedRelease } | { ok: false; reason: string }

/**
 * Target order used by tauri-plugin-updater 2.14.1 for an NSIS install:
 * `windows-x86_64-nsis`, then `windows-x86_64`.
 */
export const WINDOWS_UPDATE_TARGETS = ['windows-x86_64-nsis', 'windows-x86_64'] as const

export function readWindowsManifest(body: unknown): ReleaseRead {
  if (typeof body !== 'object' || body === null) return { ok: false, reason: 'The update server returned an empty response.' }
  const row = body as Record<string, unknown>
  if (typeof row.error === 'string') return { ok: false, reason: `The update server said ${row.error}.` }
  if (typeof row.version !== 'string' || !/^\d+\.\d+\.\d+/.test(row.version)) return { ok: false, reason: 'The update manifest has no version.' }
  if (row.pub_date != null && (typeof row.pub_date !== 'string' || !RFC3339.test(row.pub_date))) {
    return { ok: false, reason: 'The update manifest has a publication date the updater cannot read.' }
  }
  const platforms = row.platforms
  if (typeof platforms !== 'object' || platforms === null) return { ok: false, reason: 'The update manifest has no Windows installers.' }
  const table = platforms as Record<string, unknown>
  for (const key of WINDOWS_UPDATE_TARGETS) {
    const value = table[key]
    if (typeof value !== 'object' || value === null) continue
    const platform = value as { url?: unknown; signature?: unknown }
    if (typeof platform.url !== 'string' || !platform.url.startsWith('https://')) continue
    if (typeof platform.signature !== 'string' || platform.signature.length < 40) continue
    return {
      ok: true,
      release: {
        version: row.version,
        notes: typeof row.notes === 'string' ? row.notes : '',
        downloadUrl: platform.url,
        releaseUrl: `https://github.com/Priyank910/LedgerAI/releases/tag/v${row.version}`,
      },
    }
  }
  return { ok: false, reason: 'The update manifest has no signed Windows installer.' }
}

export function readAndroidRelease(body: unknown): ReleaseRead {
  if (typeof body !== 'object' || body === null) return { ok: false, reason: 'The update server returned an empty response.' }
  const row = body as Record<string, unknown>
  if (typeof row.error === 'string') return { ok: false, reason: `The update server said ${row.error}.` }
  if (typeof row.version !== 'string' || !/^\d+\.\d+\.\d+/.test(row.version)) return { ok: false, reason: 'The update server did not name a version.' }
  if (typeof row.url !== 'string' || !row.url.startsWith('https://')) return { ok: false, reason: 'The update server did not include an Android download.' }
  return {
    ok: true,
    release: {
      version: row.version,
      notes: typeof row.notes === 'string' ? row.notes : '',
      downloadUrl: row.url,
      releaseUrl: typeof row.releaseUrl === 'string' ? row.releaseUrl : `https://github.com/Priyank910/LedgerAI/releases/tag/v${row.version}`,
    },
  }
}

export function updateIsNewer(latestVersion: string, currentVersion: string): boolean {
  return compareReleaseVersions(latestVersion, currentVersion) > 0
}

export function shouldPrompt(input: { currentVersion: string; latestVersion: string; laterVersion: string | null; laterAt: number | null; now: number; manual: boolean }): boolean {
  if (!updateIsNewer(input.latestVersion, input.currentVersion)) return false
  if (input.manual) return true
  return shouldOfferUpdate({
    currentVersion: input.currentVersion,
    latestVersion: input.latestVersion,
    laterVersion: input.laterVersion,
    laterAt: input.laterAt,
    now: input.now,
  })
}
