import { D1Auth, D1Ledger, type D1Like } from './d1'
import { handleRequest } from './http'
import { MemoryReleaseCache } from './releases'

export interface Env {
  DB: D1Like
  OPENROUTER_API_KEY?: string
  OPENROUTER_MODEL?: string
  GITHUB_RELEASES_TOKEN?: string
}

const releaseCache = new MemoryReleaseCache(() => Date.now())

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, {
      auth: new D1Auth(env.DB),
      ledger: new D1Ledger(env.DB),
      releaseCache,
      ...(env.OPENROUTER_API_KEY ? { openRouterKey: env.OPENROUTER_API_KEY } : {}),
      ...(env.OPENROUTER_MODEL ? { openRouterModel: env.OPENROUTER_MODEL } : {}),
      ...(env.GITHUB_RELEASES_TOKEN ? { githubToken: env.GITHUB_RELEASES_TOKEN } : {}),
    })
  },
}
