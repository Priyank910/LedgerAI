import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { readAndroidRelease, readWindowsManifest, shouldPrompt, WINDOWS_UPDATE_TARGETS } from '../src/domain/appUpdate'
import { checkForUpdate } from '../src/ui/updateClient'

const windowsLive = JSON.parse(readFileSync('tests/fixtures/windows-latest.json', 'utf8')) as unknown
const androidLive = JSON.parse(readFileSync('tests/fixtures/android-latest.json', 'utf8')) as unknown

describe('updater manifests', () => {
  it('reads the live Windows manifest the way Tauri 2.14.1 picks an NSIS target', () => {
    const parsed = readWindowsManifest(windowsLive)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.release.version).toBe('0.1.1')
    expect(parsed.release.downloadUrl).toContain('Ledger.AI_0.1.1_x64-setup.exe')
    const platforms = (windowsLive as { platforms: Record<string, { url: string }> }).platforms
    expect(WINDOWS_UPDATE_TARGETS[0]).toBe('windows-x86_64-nsis')
    expect(parsed.release.downloadUrl).toBe(platforms['windows-x86_64-nsis'].url)
    expect(shouldPrompt({ currentVersion: '0.1.0', latestVersion: parsed.release.version, laterVersion: null, laterAt: null, now: 0, manual: false })).toBe(true)
    expect(shouldPrompt({ currentVersion: '0.1.2', latestVersion: parsed.release.version, laterVersion: null, laterAt: null, now: 0, manual: true })).toBe(false)
    const next = structuredClone(windowsLive) as { version: string }
    next.version = '0.1.3'
    const newer = readWindowsManifest(next)
    expect(newer.ok).toBe(true)
    if (!newer.ok) return
    expect(shouldPrompt({ currentVersion: '0.1.2', latestVersion: newer.release.version, laterVersion: null, laterAt: null, now: 0, manual: false })).toBe(true)
  })

  it('rejects a publication date Tauri cannot parse', () => {
    const broken = structuredClone(windowsLive) as { pub_date: string }
    broken.pub_date = '23 Nov 2026'
    expect(readWindowsManifest(broken)).toEqual({ ok: false, reason: 'The update manifest has a publication date the updater cannot read.' })
  })

  it('reads an Android release and lets 0.1.2 notice 0.1.3', () => {
    const parsed = readAndroidRelease(androidLive)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.release.version).toBe('0.1.1')
    expect(parsed.release.downloadUrl).toContain('app-release.apk')
    const next = structuredClone(androidLive) as { version: string }
    next.version = '0.1.3'
    const newer = readAndroidRelease(next)
    expect(newer.ok).toBe(true)
    if (!newer.ok) return
    expect(shouldPrompt({ currentVersion: '0.1.2', latestVersion: newer.release.version, laterVersion: null, laterAt: null, now: 0, manual: false })).toBe(true)
    expect(shouldPrompt({ currentVersion: '0.1.2', latestVersion: '0.1.2', laterVersion: null, laterAt: null, now: 0, manual: true })).toBe(false)
  })

  it('turns a failed response into a visible reason', async () => {
    const result = await checkForUpdate({
      manual: true,
      later: null,
      currentVersion: '0.1.2',
      platform: 'android',
      origin: 'https://ledger.test',
      fetchImpl: () => Promise.reject(new Error('Failed to fetch')),
    })
    expect(result).toMatchObject({ status: 'error', currentVersion: '0.1.2', reason: 'Failed to fetch' })
  })

  it('allows the Windows IPC origin in the desktop content policy', () => {
    const config = readFileSync('src-tauri/tauri.conf.json', 'utf8')
    expect(config).toContain('ipc:')
    expect(config).toContain('http://ipc.localhost')
  })

  it('registers the Capacitor App plugin the installed version reads', () => {
    expect(readFileSync('android/capacitor.settings.gradle', 'utf8')).toContain('capacitor-app')
    expect(readFileSync('android/app/capacitor.build.gradle', 'utf8')).toContain("project(':capacitor-app')")
  })
})
