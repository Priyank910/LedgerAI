import { describe, expect, it } from 'vitest'
import { chatTarget } from '../src/llm/target'

describe('chat target', () => {
  it('sends the bearer token to the Worker and never a model key', () => {
    expect(chatTarget({ mode: 'mock', apiUrl: '', accessToken: null, dev: false }).kind).toBe('mock')
    expect(chatTarget({ mode: '', apiUrl: 'https://ledger.example.workers.dev', accessToken: null, dev: false }).kind).toBe('sign-in')
    const hosted = chatTarget({ mode: '', apiUrl: 'https://ledger.example.workers.dev/', accessToken: 'session-token', dev: false })
    expect(hosted).toEqual({
      kind: 'proxy',
      url: 'https://ledger.example.workers.dev/api/ai-chat',
      headers: { Authorization: 'Bearer session-token' },
    })
    expect(JSON.stringify(hosted)).not.toContain('OPENROUTER')
    expect(JSON.stringify(hosted)).not.toContain('GEMINI')
    expect(chatTarget({ mode: '', apiUrl: '', accessToken: null, dev: false }).kind).toBe('unavailable')
  })
})
