import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { completeWithGemini, type GeminiLocale, type GeminiMessage, type GeminiTool } from './supabase/functions/ai-chat/gemini'

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
}

function send(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status
  response.setHeader('content-type', 'application/json')
  response.end(JSON.stringify(body))
}

/** Dev-only Gemini proxy. The key stays in this Node process and is never sent to the browser bundle. */
export function aiDevPlugin(apiKey: string | undefined, model: string | undefined): Plugin {
  return {
    name: 'ledger-ai-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/ai-chat', (request, response) => {
        void handle(request, response, apiKey, model)
      })
    },
  }
}

async function handle(request: IncomingMessage, response: ServerResponse, apiKey: string | undefined, model: string | undefined) {
  if (request.method !== 'POST') {
    send(response, 405, { error: 'method' })
    return
  }
  if (!apiKey) {
    send(response, 503, { error: 'GEMINI_API_KEY is not set' })
    return
  }
  try {
    const record = JSON.parse(await readBody(request)) as Record<string, unknown>
    const locale = record.locale
    if (locale !== 'en' && locale !== 'hi' && locale !== 'gu') {
      send(response, 400, { error: 'bad-body' })
      return
    }
    const result = await completeWithGemini({
      apiKey,
      model: model || 'gemini-2.5-flash',
      locale: locale as GeminiLocale,
      today: String(record.today ?? ''),
      messages: record.messages as GeminiMessage[],
      tools: record.tools as GeminiTool[],
    })
    send(response, 200, result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'gemini-failed'
    send(response, 502, { error: message })
  }
}
