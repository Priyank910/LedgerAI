import { describe, expect, it } from 'vitest'
import { chatTarget } from '../src/llm/target'

describe('chat target', () => {
  it('keeps the model key off the client and requires sign-in for the hosted proxy', () => {
    expect(chatTarget({ mode: 'mock', proxyUrl: '', supabaseUrl: '', anonKey: '', accessToken: null, dev: false }).kind).toBe('mock')
    expect(chatTarget({ mode: '', proxyUrl: '', supabaseUrl: 'https://shop.supabase.co', anonKey: 'anon', accessToken: null, dev: false }).kind).toBe('sign-in')
    const hosted = chatTarget({ mode: '', proxyUrl: '', supabaseUrl: 'https://shop.supabase.co/', anonKey: 'anon', accessToken: 'jwt', dev: false })
    expect(hosted).toMatchObject({ kind: 'proxy', url: 'https://shop.supabase.co/functions/v1/ai-chat' })
    expect(chatTarget({ mode: '', proxyUrl: '', supabaseUrl: '', anonKey: '', accessToken: null, dev: false }).kind).toBe('unavailable')
  })
})
