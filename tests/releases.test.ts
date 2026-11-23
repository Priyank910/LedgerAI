import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { handleRequest } from '../worker/http'
import { MemoryAuth, MemoryLedger } from '../worker/store'
import { MemoryReleaseCache, pickRelease, type GhRelease } from '../worker/releases'

const release = (tag: string, extra: Partial<GhRelease> = {}): GhRelease => ({
  tag_name: tag,
  body: `Notes for ${tag}`,
  draft: false,
  prerelease: true,
  published_at: '2026-11-22T00:00:00Z',
  html_url: `https://github.com/Priyank910/LedgerAI/releases/tag/${tag}`,
  assets: [
    {
      name: 'latest.json',
      url: `https://api.github.com/repos/Priyank910/LedgerAI/releases/assets/${tag}-json`,
      browser_download_url: `https://github.com/Priyank910/LedgerAI/releases/download/${tag}/latest.json`,
    },
    {
      name: 'app-release.apk',
      url: `https://api.github.com/repos/Priyank910/LedgerAI/releases/assets/${tag}-apk`,
      browser_download_url: `https://github.com/Priyank910/LedgerAI/releases/download/${tag}/app-release.apk`,
    },
  ],
  ...extra,
})

const manifest = {
  version: '0.1.2',
  notes: 'Update check',
  pub_date: '2026-11-23T00:00:00Z',
  platforms: {
    'windows-x86_64': {
      signature: 'sig-bytes',
      url: 'https://github.com/Priyank910/LedgerAI/releases/download/v0.1.2/Ledger%20AI_0.1.2_x64-setup.exe',
    },
  },
  android: {
    versionCode: 102,
    url: 'https://github.com/Priyank910/LedgerAI/releases/download/v0.1.2/app-release.apk',
    releaseUrl: 'https://github.com/Priyank910/LedgerAI/releases/tag/v0.1.2',
  },
}

function deps(fetchImpl: typeof fetch, cache = new MemoryReleaseCache(() => Date.parse('2026-11-22T00:00:00Z'))) {
  return { auth: new MemoryAuth(), ledger: new MemoryLedger(), fetchImpl, releaseCache: cache, githubToken: 'gh-secret' }
}

describe('release proxy', () => {
  it('keeps prereleases, skips drafts, and chooses the newest tag', () => {
    const chosen = pickRelease([release('v0.1.0'), release('v0.1.1-rc.1'), release('v0.1.1', { draft: true }), release('v0.1.1')])
    expect(chosen?.tag_name).toBe('v0.1.1')
  })

  it('serves Windows and Android from the public latest.json file', async () => {
    const seen: { url: string; authorization: string }[] = []
    const fetchImpl: typeof fetch = async (url, init) => {
      const href = String(url)
      seen.push({ url: href, authorization: new Headers(init?.headers).get('authorization') ?? '' })
      if (href.endsWith('/releases/latest/download/latest.json')) return new Response(JSON.stringify(manifest))
      return new Response('missing', { status: 404 })
    }
    const store = deps(fetchImpl)
    const windows = await handleRequest(new Request('https://ledger.test/app/latest?platform=windows'), store)
    const windowsBody = (await windows.json()) as { version: string; platforms: { 'windows-x86_64': { url: string; signature: string } } }
    expect(windows.status).toBe(200)
    expect(windowsBody.version).toBe('0.1.2')
    expect(windowsBody.platforms['windows-x86_64'].signature).toBe('sig-bytes')
    expect(windowsBody.platforms['windows-x86_64'].url).toBe('https://ledger.test/app/download/Ledger%20AI_0.1.2_x64-setup.exe')
    expect(JSON.stringify(windowsBody)).not.toContain('gh-secret')
    expect(JSON.stringify(windowsBody)).not.toContain('api.github.com')

    const android = await handleRequest(new Request('https://ledger.test/app/latest?platform=android'), store)
    const androidBody = (await android.json()) as { version: string; versionCode: number; url: string }
    expect(androidBody).toMatchObject({ version: '0.1.2', versionCode: 102, url: 'https://ledger.test/app/download/app-release.apk' })
    expect(seen.filter((call) => call.url.includes('api.github.com'))).toHaveLength(0)
    expect(seen).toHaveLength(1)
    expect(seen[0]?.authorization).toBe('Bearer gh-secret')
  })

  it('serves the last good manifest when the release file later fails', async () => {
    let fail = false
    const now = { t: Date.parse('2026-11-23T00:00:00Z') }
    const cache = new MemoryReleaseCache(() => now.t)
    const fetchImpl: typeof fetch = async () => {
      if (fail) throw new Error('github-403 rate-limit')
      return new Response(JSON.stringify(manifest))
    }
    const store = deps(fetchImpl, cache)
    const first = await handleRequest(new Request('https://ledger.test/app/latest?platform=android'), store)
    expect(first.status).toBe(200)
    now.t += 11 * 60 * 1000
    fail = true
    const windows = await handleRequest(new Request('https://ledger.test/app/latest?platform=windows&current=0.1.2'), store)
    const android = await handleRequest(new Request('https://ledger.test/app/latest?platform=android'), store)
    expect(windows.status).toBe(200)
    expect(android.status).toBe(200)
    expect(((await windows.json()) as { version: string }).version).toBe('0.1.2')
    expect(((await android.json()) as { version: string }).version).toBe('0.1.2')
  })

  it('streams an asset from the public download URL and does not send the token to the redirected host', async () => {
    const hosts: string[] = []
    const fetchImpl: typeof fetch = async (url, init) => {
      const href = String(url)
      hosts.push(new URL(href).host)
      const authorization = new Headers(init?.headers).get('authorization')
      if (href.includes('/releases/latest/download/app-release.apk')) {
        expect(authorization).toBe('Bearer gh-secret')
        return new Response(null, { status: 302, headers: { location: 'https://objects.githubusercontent.com/apk' } })
      }
      expect(authorization).toBeNull()
      return new Response('apk-bytes')
    }
    const response = await handleRequest(new Request('https://ledger.test/app/download/app-release.apk'), deps(fetchImpl))
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('apk-bytes')
    expect(response.headers.get('content-type')).toContain('android.package-archive')
    expect(hosts).toContain('objects.githubusercontent.com')
    expect(hosts.some((host) => host === 'api.github.com')).toBe(false)
  })

  it('reads the public release file when no token is configured', async () => {
    let authorization = 'unset'
    let href = ''
    const fetchImpl: typeof fetch = async (url, init) => {
      href = String(url)
      authorization = new Headers(init?.headers).get('authorization') ?? ''
      return new Response(JSON.stringify(manifest))
    }
    const response = await handleRequest(new Request('https://ledger.test/app/latest?platform=android'), {
      auth: new MemoryAuth(),
      ledger: new MemoryLedger(),
      fetchImpl,
      releaseCache: new MemoryReleaseCache(() => Date.now()),
    })
    expect(response.status).toBe(200)
    expect(authorization).toBe('')
    expect(href).toBe('https://github.com/Priyank910/LedgerAI/releases/latest/download/latest.json')
  })

  it('returns a lookup error instead of throwing when nothing has been cached', async () => {
    const response = await handleRequest(new Request('https://ledger.test/app/latest?platform=windows'), {
      auth: new MemoryAuth(),
      ledger: new MemoryLedger(),
      fetchImpl: async () => {
        throw new Error('github-unreachable')
      },
      releaseCache: new MemoryReleaseCache(() => Date.now()),
    })
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'github-unreachable' })
  })

  it('does not cache a failed lookup', async () => {
    let calls = 0
    const cache = new MemoryReleaseCache(() => Date.parse('2026-11-22T00:00:00Z'))
    const fetchImpl: typeof fetch = async () => {
      calls += 1
      if (calls === 1) return new Response('missing', { status: 404 })
      return new Response(JSON.stringify(manifest))
    }
    const store = deps(fetchImpl, cache)
    const first = await handleRequest(new Request('https://ledger.test/app/latest?platform=android'), store)
    expect(first.status).toBe(502)
    const second = await handleRequest(new Request('https://ledger.test/app/latest?platform=android'), store)
    const body = (await second.json()) as { version: string }
    expect(body.version).toBe('0.1.2')
    expect(calls).toBe(2)
  })

  it('signs Android releases as PKCS12', () => {
    const gradle = readFileSync('android/app/build.gradle', 'utf8')
    expect(gradle).toContain("storeType 'PKCS12'")
  })
})
