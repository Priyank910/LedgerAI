import { D1Auth, D1Ledger, type D1Like } from './d1'
import { handleRequest } from './http'

export interface Env {
  DB: D1Like
  GEMINI_API_KEY?: string
  GEMINI_MODEL?: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, {
      auth: new D1Auth(env.DB),
      ledger: new D1Ledger(env.DB),
      ...(env.GEMINI_API_KEY ? { geminiKey: env.GEMINI_API_KEY } : {}),
      ...(env.GEMINI_MODEL ? { geminiModel: env.GEMINI_MODEL } : {}),
    })
  },
}
