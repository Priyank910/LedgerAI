import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compareReleaseVersions, parseReleaseTag, shouldOfferUpdate, UPDATE_CHECK_MS } from '../src/domain/releaseVersion'
import { applyReleaseVersion, parseReleaseTag as parseFromScript } from '../scripts/set-release-version.mjs'

describe('release versions', () => {
  it('orders v0.1.1 above v0.1.0 and a plain release above its prerelease', () => {
    expect(parseReleaseTag('v0.1.0')?.versionCode).toBe(100)
    expect(parseReleaseTag('v0.1.1')?.versionCode).toBe(101)
    expect(compareReleaseVersions('v0.1.1', 'v0.1.0')).toBeGreaterThan(0)
    expect(compareReleaseVersions('0.1.1', '0.1.1-rc.1')).toBeGreaterThan(0)
    expect(parseFromScript('v0.1.1')).toEqual(parseReleaseTag('v0.1.1'))
  })

  it('writes the tag into the app, desktop, and Android versions', () => {
    const root = mkdtempSync(join(tmpdir(), 'ledger-version-'))
    mkdirSync(join(root, 'src-tauri'), { recursive: true })
    mkdirSync(join(root, 'android', 'app'), { recursive: true })
    writeFileSync(join(root, 'package.json'), '{ "version": "0.1.0" }\n')
    writeFileSync(join(root, 'src-tauri', 'tauri.conf.json'), '{ "version": "0.1.0" }\n')
    writeFileSync(join(root, 'src-tauri', 'Cargo.toml'), '[package]\nversion = "0.1.0"\n')
    writeFileSync(join(root, 'android', 'app', 'build.gradle'), 'versionCode 100\nversionName "0.1.0"\n')
    applyReleaseVersion(root, 'v0.1.1')
    expect(readFileSync(join(root, 'package.json'), 'utf8')).toContain('"version": "0.1.1"')
    expect(readFileSync(join(root, 'src-tauri', 'tauri.conf.json'), 'utf8')).toContain('"version": "0.1.1"')
    expect(readFileSync(join(root, 'android', 'app', 'build.gradle'), 'utf8')).toContain('versionCode 101')
    expect(readFileSync(join(root, 'android', 'app', 'build.gradle'), 'utf8')).toContain('versionName "0.1.1"')
  })

  it('offers a newer version again a few hours after Later', () => {
    const now = 1_000_000
    expect(shouldOfferUpdate({ currentVersion: '0.1.0', latestVersion: '0.1.1', laterVersion: null, laterAt: null, now })).toBe(true)
    expect(shouldOfferUpdate({ currentVersion: '0.1.1', latestVersion: '0.1.1', laterVersion: null, laterAt: null, now })).toBe(false)
    expect(
      shouldOfferUpdate({ currentVersion: '0.1.0', latestVersion: '0.1.1', laterVersion: '0.1.1', laterAt: now - 1000, now }),
    ).toBe(false)
    expect(
      shouldOfferUpdate({
        currentVersion: '0.1.0',
        latestVersion: '0.1.1',
        laterVersion: '0.1.1',
        laterAt: now - UPDATE_CHECK_MS,
        now,
      }),
    ).toBe(true)
  })
})
