import { describe, expect, it } from 'vitest'
import { TOOL_SPECS } from '../src/domain/ai/tools'
import type { LlmProvider } from '../src/domain/ai/loop'
import {
  DEFAULT_OPENROUTER_MODEL,
  OPENROUTER_REFERER,
  OPENROUTER_TITLE,
  OPENROUTER_URL,
  OpenRouterProvider,
  parseOpenRouterResponse,
  systemPrompt,
} from '../src/llm/openrouter'

describe('OpenRouter provider', () => {
  it('asks for Gujarati, sends tools, and keeps the key out of the body', async () => {
    const seen: { url?: string; authorization?: string; referer?: string; title?: string; body?: string } = {}
    const provider: LlmProvider = new OpenRouterProvider({
      apiKey: 'secret-key',
      fetchImpl: async (url, init) => {
        const headers = new Headers(init?.headers)
        seen.url = String(url)
        seen.authorization = headers.get('authorization') ?? ''
        seen.referer = headers.get('http-referer') ?? ''
        seen.title = headers.get('x-title') ?? ''
        seen.body = String(init?.body)
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: null,
                  tool_calls: [
                    {
                      id: 'call-1',
                      type: 'function',
                      function: { name: 'period_totals', arguments: '{"from":"2026-02-01","to":"2026-02-28"}' },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        )
      },
    })
    const result = await provider.complete({
      locale: 'gu',
      today: '2026-03-15',
      messages: [{ role: 'user', text: 'કેટલા?' }],
      tools: TOOL_SPECS,
    })
    expect(systemPrompt('gu', '2026-03-15')).toContain('Gujarati')
    expect(systemPrompt('hi', '2026-03-15')).toContain('Hindi')
    expect(seen.url).toBe(OPENROUTER_URL)
    expect(seen.authorization).toBe('Bearer secret-key')
    expect(seen.referer).toBe(OPENROUTER_REFERER)
    expect(seen.title).toBe(OPENROUTER_TITLE)
    expect(seen.body).not.toContain('secret-key')
    const body = JSON.parse(seen.body ?? '{}') as { model: string; tools: { function: { name: string } }[] }
    expect(body.model).toBe(DEFAULT_OPENROUTER_MODEL)
    expect(body.tools.map((tool) => tool.function.name)).toContain('period_totals')
    expect(result.toolCalls?.[0]).toMatchObject({ id: 'call-1', name: 'period_totals', arguments: { from: '2026-02-01' } })
  })

  it('parses a plain reply and does not leak the key when OpenRouter rejects the call', async () => {
    expect(
      parseOpenRouterResponse({ choices: [{ message: { content: 'Your balance is ready.' } }] }).text,
    ).toBe('Your balance is ready.')
    const provider = new OpenRouterProvider({
      apiKey: 'secret-key',
      model: 'google/gemini-2.5-flash',
      fetchImpl: async () => new Response('no', { status: 401 }),
    })
    await expect(
      provider.complete({ locale: 'en', today: '2026-03-15', messages: [{ role: 'user', text: 'balance' }], tools: [] }),
    ).rejects.toThrow('openrouter-401')
  })
})
