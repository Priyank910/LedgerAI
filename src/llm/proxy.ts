import type { LlmProvider, LlmRequest, LlmResponse } from '../domain/ai/loop'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export class ProxyProvider implements LlmProvider {
  constructor(
    private readonly url: string,
    private readonly headers: Record<string, string>,
  ) {}

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...this.headers },
      body: JSON.stringify({
        locale: request.locale,
        today: request.today,
        messages: request.messages,
        tools: request.tools,
      }),
    })
    const body: unknown = await response.json().catch(() => ({}))
    if (!response.ok) {
      const message = isObject(body) && typeof body.error === 'string' ? body.error : `chat-${response.status}`
      throw new Error(message)
    }
    const record = isObject(body) ? body : {}
    const toolCalls = Array.isArray(record.toolCalls) ? (record.toolCalls as LlmResponse['toolCalls']) : undefined
    return {
      ...(typeof record.text === 'string' ? { text: record.text } : {}),
      ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
    }
  }
}
