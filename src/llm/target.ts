export type ChatTarget =
  | { kind: 'mock' }
  | { kind: 'sign-in' }
  | { kind: 'unavailable' }
  | { kind: 'proxy'; url: string; headers: Record<string, string> }

export function chatTarget(input: {
  mode: string | undefined
  apiUrl: string | undefined
  accessToken: string | null
  dev: boolean
}): ChatTarget {
  if (input.mode === 'mock') return { kind: 'mock' }
  const configured = input.apiUrl?.trim()
  const origin = configured ? configured.replace(/\/$/, '') : input.dev ? '' : null
  if (origin === null) return { kind: 'unavailable' }
  if (!input.accessToken) return { kind: 'sign-in' }
  return {
    kind: 'proxy',
    url: `${origin}/api/ai-chat`,
    headers: { Authorization: `Bearer ${input.accessToken}` },
  }
}
