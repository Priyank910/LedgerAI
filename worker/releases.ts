import { compareReleaseVersions, parseReleaseTag, type ReleaseVersion } from '../src/domain/releaseVersion'

export const RELEASE_REPO = 'Priyank910/LedgerAI'
export const RELEASE_CACHE_MS = 10 * 60 * 1000

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
  if (!response.ok) return null
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

function noRelease(): Response {
  return new Response(null, {
    status: 204,
    headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' },
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
  let releases: GhRelease[] | null
  try {
    releases = await loadReleases({ ...(deps.githubToken ? { token: deps.githubToken } : {}), fetchImpl, cache })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'release-lookup-failed'
    return jsonRelease({ error: message.slice(0, 180) }, 502, originHeader)
  }
  const release = releases ? pickRelease(releases) : null
  if (url.pathname === '/app/latest') {
    const platform = url.searchParams.get('platform')
    if (!release) return noRelease()
    if (platform === 'android') {
      const body = androidRelease(release, url.origin)
      if (!body) return noRelease()
      return jsonRelease(body, 200, originHeader)
    }
    if (platform === 'windows') {
      const manifest = await windowsManifest({ release, origin: url.origin, fetchImpl, ...(deps.githubToken ? { token: deps.githubToken } : {}) })
      if (!manifest) return noRelease()
      return jsonRelease(manifest, 200, originHeader)
    }
    return jsonRelease({ error: 'bad-platform' }, 400, originHeader)
  }
  if (url.pathname.startsWith('/app/download/')) {
    if (!release) return jsonRelease({ error: 'not-found' }, 404, originHeader)
    const fileName = decodeURIComponent(url.pathname.slice('/app/download/'.length))
    return streamReleaseAsset({ release, fileName, fetchImpl, originHeader, ...(deps.githubToken ? { token: deps.githubToken } : {}) })
  }
  return jsonRelease({ error: 'not-found' }, 404, originHeader)
}
