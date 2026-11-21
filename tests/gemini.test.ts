import { describe, expect, it } from 'vitest'
import { TOOL_SPECS } from '../src/domain/ai/tools'
import { buildGeminiRequest, completeWithGemini, parseGeminiResponse, systemPrompt } from '../supabase/functions/ai-chat/gemini'

describe('gemini proxy contract', () => {
  it('builds a tool-calling request and parses a function call without putting the key in the body', () => {
    const body = buildGeminiRequest({
      locale: 'gu',
      today: '2026-03-15',
      messages: [{ role: 'user', text: 'કેટલા?' }],
      tools: TOOL_SPECS,
    })
    expect(systemPrompt('gu', '2026-03-15')).toContain('Gujarati')
    expect(systemPrompt('gu', '2026-03-15')).toContain('Never invent')
    expect(JSON.stringify(body)).not.toContain('secret-key')
    const parsed = parseGeminiResponse({
      candidates: [{ content: { parts: [{ functionCall: { name: 'period_totals', args: { from: '2026-02-01', to: '2026-02-28' } } }] } }],
    })
    expect(parsed.toolCalls?.[0]).toMatchObject({ name: 'period_totals', arguments: { from: '2026-02-01' } })
  })

  it('sends the key in a header and returns the parsed model response', async () => {
    const seen: { url?: string; key?: string; body?: string } = {}
    const result = await completeWithGemini({
      apiKey: 'secret-key',
      model: 'gemini-2.5-flash',
      locale: 'en',
      today: '2026-03-15',
      messages: [{ role: 'user', text: 'balance' }],
      tools: TOOL_SPECS,
      fetchImpl: async (url, init) => {
        seen.url = String(url)
        seen.key = new Headers(init?.headers).get('x-goog-api-key') ?? ''
        seen.body = String(init?.body)
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Your balance is ready.' }] } }] }), { status: 200 })
      },
    })
    expect(seen.url).toContain('gemini-2.5-flash:generateContent')
    expect(seen.url).not.toContain('secret-key')
    expect(seen.key).toBe('secret-key')
    expect(seen.body).not.toContain('secret-key')
    expect(result.text).toBe('Your balance is ready.')
  })
})
