export type ChatTarget =
  | { kind: 'mock' }
  | { kind: 'sign-in' }
  | { kind: 'unavailable' }
  | { kind: 'proxy'; url: string; headers: Record<string, string> }

export function chatTarget(input: {
  mode: string | undefined
  proxyUrl: string | undefined
  supabaseUrl: string | undefined
  anonKey: string | undefined
  accessToken: string | null
  dev: boolean
}): ChatTarget {
  if (input.mode === 'mock') return { kind: 'mock' }
  const proxyUrl = input.proxyUrl?.trim()
  if (proxyUrl) {
    return {
      kind: 'proxy',
      url: proxyUrl,
      headers: input.accessToken ? { Authorization: `Bearer ${input.accessToken}` } : {},
    }
  }
  const supabaseUrl = input.supabaseUrl?.trim()
  const anonKey = input.anonKey?.trim()
  if (supabaseUrl && anonKey) {
    if (!input.accessToken) return { kind: 'sign-in' }
    return {
      kind: 'proxy',
      url: `${supabaseUrl.replace(/\/$/, '')}/functions/v1/ai-chat`,
      headers: { Authorization: `Bearer ${input.accessToken}`, apikey: anonKey },
    }
  }
  if (input.dev) return { kind: 'proxy', url: '/api/ai-chat', headers: {} }
  return { kind: 'unavailable' }
}
