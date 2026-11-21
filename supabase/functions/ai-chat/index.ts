import { completeWithGemini, type GeminiLocale, type GeminiMessage, type GeminiTool } from './gemini.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })
}

function isLocale(value: unknown): value is GeminiLocale {
  return value === 'en' || value === 'hi' || value === 'gu'
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return json({ error: 'method' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!supabaseUrl || !anonKey || !apiKey) return json({ error: 'server-not-configured' }, 503)

  const authorization = request.headers.get('Authorization') ?? ''
  if (!authorization.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: authorization, apikey: anonKey },
  })
  if (!userResponse.ok) return json({ error: 'unauthorized' }, 401)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'bad-body' }, 400)
  }
  if (typeof body !== 'object' || body === null) return json({ error: 'bad-body' }, 400)
  const record = body as Record<string, unknown>
  if (!isLocale(record.locale) || typeof record.today !== 'string' || !Array.isArray(record.messages) || !Array.isArray(record.tools)) {
    return json({ error: 'bad-body' }, 400)
  }

  try {
    const result = await completeWithGemini({
      apiKey,
      model: Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash',
      locale: record.locale,
      today: record.today,
      messages: record.messages as GeminiMessage[],
      tools: record.tools as GeminiTool[],
    })
    return json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'gemini-failed'
    return json({ error: message }, 502)
  }
})
