import { compareReleaseVersions, parseReleaseTag, type ReleaseVersion } from '../src/domain/releaseVersion'

export const RELEASE_REPO = 'Priyank910/LedgerAI'
export const RELEASE_CACHE_MS = 10 * 60 * 1000
export const LATEST_MANIFEST_URL = `https://github.com/${RELEASE_REPO}/releases/latest/download/latest.json`
const MANIFEST_CACHE_KEY = 'latest-manifest'

export type ReleaseAsset = { name: string; url: string; browser_download_url: string }

export type GhRelease = {
  tag_name: string
  body: string | null
  draft: boolean
  prerelease: boolean
  published_at: string | null
  html_url: string
  assets: ReleaseAsset[]
}

export type ReleaseCache = {
  get(key: string): Promise<string | null>
  getStale(key: string): Promise<string | null>
  set(key: string, value: string, ttlMs: number): Promise<void>
}

export class MemoryReleaseCache implements ReleaseCache {
  private readonly entries = new Map<string, { value: string; expires: number }>()

  constructor(private readonly now: () => number) {}

  async get(key: string) {
    const hit = this.entries.get(key)
    if (!hit || hit.expires <= this.now()) return null
    return hit.value
  }

  async getStale(key: string) {
    return this.entries.get(key)?.value ?? null
  }

  async set(key: string, value: string, ttlMs: number) {
    this.entries.set(key, { value, expires: this.now() + ttlMs })
  }
}

export function pickRelease(releases: GhRelease[]): GhRelease | null {
  const usable = releases.filter((release) => !release.draft && parseReleaseTag(release.tag_name))
  usable.sort((a, b) => compareReleaseVersions(b.tag_name, a.tag_name))
  return usable[0] ?? null
}

export function versionOf(release: GhRelease): ReleaseVersion {
  const parsed = parseReleaseTag(release.tag_name)
  if (!parsed) throw new Error('bad-tag')
  return parsed
}

export function assetFileName(url: string): string | null {
  const marker = '/releases/download/'
  const index = url.indexOf(marker)
  if (index < 0) return null
  const rest = url.slice(index + marker.length)
  const slash = rest.indexOf('/')
  if (slash < 0) return null
  return decodeURIComponent(rest.slice(slash + 1))
}

export function downloadUrl(origin: string, fileName: string): string {
  return `${origin}/app/download/${encodeURIComponent(fileName)}`
}

type UpdaterPlatform = { signature: string; url: string }

export function rewriteUpdaterManifest(payload: unknown, origin: string): Record<string, unknown> | null {
  if (typeof payload !== 'object' || payload === null) return null
  const root = payload as Record<string, unknown>
  const platforms = root.platforms
  if (typeof platforms !== 'object' || platforms === null) return null
  const nextPlatforms: Record<string, UpdaterPlatform> = {}
  for (const [name, value] of Object.entries(platforms)) {
    if (typeof value !== 'object' || value === null) continue
    const platform = value as { signature?: unknown; url?: unknown }
    if (typeof platform.signature !== 'string' || typeof platform.url !== 'string') continue
    const fileName = assetFileName(platform.url)
    nextPlatforms[name] = { signature: platform.signature, url: fileName ? downloadUrl(origin, fileName) : platform.url }
  }
  if (Object.keys(nextPlatforms).length === 0) return null
  return { ...root, platforms: nextPlatforms }
}

export type ServedManifest = {
  windows: Record<string, unknown>
  android: {
    version: string
    versionCode: number
    notes: string
    url: string
    releaseUrl: string
    pubDate: string | null
  }
}

export function projectLatestManifest(payload: unknown, origin: string): ServedManifest | null {
  if (typeof payload !== 'object' || payload === null) return null
  const root = payload as Record<string, unknown>
  if (typeof root.version !== 'string') return null
  const parsed = parseReleaseTag(root.version)
  if (!parsed) return null
  const rewritten = rewriteUpdaterManifest(root, origin)
  if (!rewritten) return null
  const androidBlock = root.android
  if (typeof androidBlock !== 'object' || androidBlock === null) return null
  const android = androidBlock as { url?: unknown; versionCode?: unknown; releaseUrl?: unknown }
  if (typeof android.url !== 'string') return null
  const apkName = assetFileName(android.url) ?? (android.url.toLowerCase().endsWith('.apk') ? decodeURIComponent(android.url.slice(android.url.lastIndexOf('/') + 1)) : null)
  if (!apkName) return null
  const versionCode = typeof android.versionCode === 'number' ? android.versionCode : parsed.versionCode
  const { android: _android, ...windows } = rewritten
  void _android
  return {
    windows,
    android: {
      version: parsed.version,
      versionCode,
      notes: typeof root.notes === 'string' ? root.notes : '',
      url: downloadUrl(origin, apkName),
      releaseUrl: typeof android.releaseUrl === 'string' ? android.releaseUrl : `https://github.com/${RELEASE_REPO}/releases/tag/v${parsed.version}`,
      pubDate: typeof root.pub_date === 'string' ? root.pub_date : null,
    },
  }
}

export function androidRelease(release: GhRelease, origin: string) {
  const apk = release.assets.find((asset) => asset.name.toLowerCase().endsWith('.apk'))
  if (!apk) return null
  const version = versionOf(release)
  return {
    version: version.version,
    versionCode: version.versionCode,
    notes: release.body ?? '',
    url: downloadUrl(origin, apk.name),
    releaseUrl: release.html_url,
    pubDate: release.published_at,
  }
}

function githubHeaders(token: string | undefined, accept: string): Headers {
  const headers = new Headers({
    accept,
    'user-agent': 'ledger-ai',
    'x-github-api-version': '2022-11-28',
  })
  if (token) headers.set('authorization', `Bearer ${token}`)
  return headers
}

async function readJson(response: Response): Promise<unknown> {
  return response.json() as Promise<unknown>
}

export async function loadReleases(input: {
  token?: string
  fetchImpl: typeof fetch
  cache: ReleaseCache
}): Promise<GhRelease[] | null> {
  const cached = await input.cache.get('releases')
  if (cached) return JSON.parse(cached) as GhRelease[]
  const response = await input.fetchImpl(`https://api.github.com/repos/${RELEASE_REPO}/releases?per_page=30`, {
    headers: githubHeaders(input.token, 'application/vnd.github+json'),
  })
  if (!response.ok) {
    const detail = (await response.text()).toLowerCase()
    const rate = detail.includes('rate limit') ? ' rate-limit' : ''
    throw new Error(`github-${response.status}${rate}`)
  }
  const body = await readJson(response)
  if (!Array.isArray(body)) return null
  const releases = body.filter((item): item is GhRelease => {
    if (typeof item !== 'object' || item === null) return false
    const row = item as GhRelease
    return typeof row.tag_name === 'string' && Array.isArray(row.assets)
  })
  // An empty list is what GitHub returns before the release exists. Caching it
  // hides a prerelease that appears a few seconds later.
  if (pickRelease(releases)) await input.cache.set('releases', JSON.stringify(releases), RELEASE_CACHE_MS)
  return releases
}

function assetFetchUrls(asset: ReleaseAsset, token?: string): string[] {
  return token ? [asset.url, asset.browser_download_url] : [asset.browser_download_url, asset.url]
}

async function readAssetText(fetchImpl: typeof fetch, asset: ReleaseAsset, token?: string): Promise<string | null> {
  for (const url of assetFetchUrls(asset, token)) {
    try {
      const response = await fetchImpl(url, { headers: githubHeaders(token, 'application/octet-stream') })
      if (response.ok) return await response.text()
    } catch {
      continue
    }
  }
  return null
}

export async function windowsManifest(input: {
  release: GhRelease
  origin: string
  token?: string
  fetchImpl: typeof fetch
}): Promise<Record<string, unknown> | null> {
  const latest = input.release.assets.find((asset) => asset.name === 'latest.json')
  if (latest) {
    const text = await readAssetText(input.fetchImpl, latest, input.token)
    if (text) {
      try {
        const rewritten = rewriteUpdaterManifest(JSON.parse(text) as unknown, input.origin)
        if (rewritten) return rewritten
      } catch {
        // Fall through to the installer and its signature file.
      }
    }
  }
  const installer = input.release.assets.find((asset) => asset.name.endsWith('.exe') && !asset.name.endsWith('.sig'))
  const signature = input.release.assets.find((asset) => asset.name === `${installer?.name ?? ''}.sig`)
  if (!installer || !signature) return null
  const signatureText = await readAssetText(input.fetchImpl, signature, input.token)
  if (!signatureText) return null
  const version = versionOf(input.release)
  return {
    version: version.version,
    notes: input.release.body ?? '',
    pub_date: input.release.published_at ?? new Date(0).toISOString(),
    platforms: {
      'windows-x86_64': { signature: signatureText, url: downloadUrl(input.origin, installer.name) },
    },
  }
}

export async function streamReleaseAsset(input: {
  release: GhRelease
  fileName: string
  token?: string
  fetchImpl: typeof fetch
  originHeader: string | null
}): Promise<Response> {
  const asset = input.release.assets.find((item) => item.name === input.fileName)
  if (!asset) return jsonRelease({ error: 'not-found' }, 404, input.originHeader)
  const upstream = await input.fetchImpl(assetFetchUrls(asset, input.token)[0], {
    headers: githubHeaders(input.token, 'application/octet-stream'),
    redirect: 'manual',
  })
  const location = upstream.headers.get('location')
  const file = location ? await input.fetchImpl(location) : upstream
  if (!file.ok || !file.body) return jsonRelease({ error: 'download-failed' }, 502, input.originHeader)
  const type = input.fileName.toLowerCase().endsWith('.apk') ? 'application/vnd.android.package-archive' : 'application/octet-stream'
  return new Response(file.body, {
    status: 200,
    headers: {
      'content-type': type,
      'content-disposition': `attachment; filename="${input.fileName.replaceAll('"', '')}"`,
      'access-control-allow-origin': input.originHeader && input.originHeader !== 'null' ? input.originHeader : '*',
      'cache-control': 'private, max-age=600',
    },
  })
}

function jsonRelease(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': origin && origin !== 'null' ? origin : '*',
    },
  })
}

function workerFetch(fetchImpl?: typeof fetch): typeof fetch {
  if (fetchImpl) return fetchImpl
  return (input, init) => fetch(input, init)
}

function publicDownloadHeaders(token?: string): Headers {
  const headers = new Headers({ accept: 'application/octet-stream', 'user-agent': 'ledger-ai' })
  if (token) headers.set('authorization', `Bearer ${token}`)
  return headers
}

export function githubDownloadUrl(fileName: string): string {
  return `https://github.com/${RELEASE_REPO}/releases/latest/download/${encodeURIComponent(fileName)}`
}

async function fetchGithubDownload(fetchImpl: typeof fetch, url: string, token?: string): Promise<Response> {
  const first = await fetchImpl(url, { headers: publicDownloadHeaders(token), redirect: 'manual' })
  if (first.status >= 300 && first.status < 400) {
    const location = first.headers.get('location')
    if (!location) return first
    return fetchImpl(new URL(location, url).toString(), { redirect: 'follow' })
  }
  return first
}

function servePlatform(raw: string, platform: string | null, origin: string, originHeader: string | null): Response | null {
  let payload: unknown
  try {
    payload = JSON.parse(raw) as unknown
  } catch {
    return null
  }
  const projected = projectLatestManifest(payload, origin)
  if (!projected) return null
  if (platform === 'android') return jsonRelease(projected.android, 200, originHeader)
  if (platform === 'windows') return jsonRelease(projected.windows, 200, originHeader)
  return null
}

export async function handleReleaseRequest(request: Request, deps: {
  githubToken?: string
  fetchImpl?: typeof fetch
  releaseCache?: ReleaseCache
  now?: () => string
}): Promise<Response> {
  const originHeader = request.headers.get('origin')
  const url = new URL(request.url)
  const fetchImpl = workerFetch(deps.fetchImpl)
  const now = Date.parse(deps.now?.() ?? '') || Date.now()
  const cache = deps.releaseCache ?? new MemoryReleaseCache(() => now)
  const token = deps.githubToken
  if (url.pathname === '/app/latest') {
    const platform = url.searchParams.get('platform')
    if (platform !== 'android' && platform !== 'windows') return jsonRelease({ error: 'bad-platform' }, 400, originHeader)
    const fresh = await cache.get(MANIFEST_CACHE_KEY)
    if (fresh) {
      const served = servePlatform(fresh, platform, url.origin, originHeader)
      if (served) return served
    }
    try {
      const response = await fetchGithubDownload(fetchImpl, LATEST_MANIFEST_URL, token)
      if (!response.ok) throw new Error(`release-${response.status}`)
      const raw = await response.text()
      if (!projectLatestManifest(JSON.parse(raw) as unknown, url.origin)) throw new Error('bad-manifest')
      await cache.set(MANIFEST_CACHE_KEY, raw, RELEASE_CACHE_MS)
      const served = servePlatform(raw, platform, url.origin, originHeader)
      if (served) return served
      throw new Error('bad-manifest')
    } catch (error) {
      const stale = await cache.getStale(MANIFEST_CACHE_KEY)
      if (stale) {
        const served = servePlatform(stale, platform, url.origin, originHeader)
        if (served) return served
      }
      const message = error instanceof Error ? error.message : 'release-lookup-failed'
      return jsonRelease({ error: message.slice(0, 180) }, 502, originHeader)
    }
  }
  if (url.pathname.startsWith('/app/download/')) {
    const fileName = decodeURIComponent(url.pathname.slice('/app/download/'.length))
    if (!fileName || fileName.includes('/') || fileName.includes('\\')) return jsonRelease({ error: 'not-found' }, 404, originHeader)
    try {
      const upstream = await fetchGithubDownload(fetchImpl, githubDownloadUrl(fileName), token)
      if (!upstream.ok || !upstream.body) return jsonRelease({ error: 'download-failed' }, 502, originHeader)
      const type = fileName.toLowerCase().endsWith('.apk') ? 'application/vnd.android.package-archive' : 'application/octet-stream'
      return new Response(upstream.body, {
        status: 200,
        headers: {
          'content-type': type,
          'content-disposition': `attachment; filename="${fileName.replaceAll('"', '')}"`,
          'access-control-allow-origin': originHeader && originHeader !== 'null' ? originHeader : '*',
          'cache-control': 'private, max-age=600',
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'download-failed'
      return jsonRelease({ error: message.slice(0, 180) }, 502, originHeader)
    }
  }
  return jsonRelease({ error: 'not-found' }, 404, originHeader)
}
