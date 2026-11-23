import { D1Auth, D1Ledger, type D1Like } from './d1'
import { handleRequest } from './http'
import { MemoryReleaseCache, type ReleaseCache } from './releases'

export interface Env {
  DB: D1Like
  OPENROUTER_API_KEY?: string
  OPENROUTER_MODEL?: string
  GITHUB_RELEASES_TOKEN?: string
}

const memoryReleaseCache = new MemoryReleaseCache(() => Date.now())

function releaseCacheKey(name: string): Request {
  return new Request(`https://ledger-ai.priyank-chavda.workers.dev/__release_cache/${name}`)
}

function releaseCache(): ReleaseCache {
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default
  if (!cache) return memoryReleaseCache
  return {
    async get(name: string) {
      try {
        const shared = await cache.match(releaseCacheKey(name))
        if (shared) return shared.text()
      } catch {
        // A cache miss falls through to this isolate's memory.
      }
      return memoryReleaseCache.get(name)
    },
    async getStale(name: string) {
      try {
        const shared = await cache.match(releaseCacheKey(`${name}:last-good`))
        if (shared) return shared.text()
      } catch {
        // The memory copy is the fallback.
      }
      return memoryReleaseCache.getStale(name)
    },
    async set(name: string, value: string, ttlMs: number) {
      await memoryReleaseCache.set(name, value, ttlMs)
      try {
        await cache.put(
          releaseCacheKey(name),
          new Response(value, { headers: { 'cache-control': `public, max-age=${Math.floor(ttlMs / 1000)}` } }),
        )
        await cache.put(
          releaseCacheKey(`${name}:last-good`),
          new Response(value, { headers: { 'cache-control': 'public, max-age=2592000' } }),
        )
      } catch {
        // The memory entry still serves this isolate, including after it expires.
      }
    },
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, {
      auth: new D1Auth(env.DB),
      ledger: new D1Ledger(env.DB),
      releaseCache: releaseCache(),
      ...(env.OPENROUTER_API_KEY ? { openRouterKey: env.OPENROUTER_API_KEY } : {}),
      ...(env.OPENROUTER_MODEL ? { openRouterModel: env.OPENROUTER_MODEL } : {}),
      ...(env.GITHUB_RELEASES_TOKEN ? { githubToken: env.GITHUB_RELEASES_TOKEN } : {}),
    })
  },
}
