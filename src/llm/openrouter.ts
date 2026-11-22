import type { LlmMessage, LlmProvider, LlmRequest, LlmResponse, LlmToolCall } from '../domain/ai/loop'
import type { Locale } from '../domain/types'

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
export const DEFAULT_OPENROUTER_MODEL = 'google/gemini-2.5-flash'
export const OPENROUTER_REFERER = 'https://github.com/Priyank910/LedgerAI'
export const OPENROUTER_TITLE = 'Ledger AI'

export function systemPrompt(locale: Locale, today: string): string {
  const language = locale === 'hi' ? 'Hindi' : locale === 'gu' ? 'Gujarati' : 'English'
  return [
    'You are Ledger AI, the bookkeeper for one small Indian shop.',
    `Today is ${today}.`,
    `Reply in ${language}, in short sentences a shopkeeper can read aloud.`,
    'Write money with the rupee sign and Indian digit grouping (lakh and crore).',
    'Never invent, estimate, or recall amounts. Every figure must come from a tool result in this conversation.',
    'If a tool returns no rows, say that plainly.',
    'Category ids are: stitching, cloth, notions, alteration, rent, electricity, wages, other.',
    'Do not give tax, legal, or investment advice.',
  ].join('\n')
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asObject(value: unknown): Record<string, unknown> {
  return isObject(value) ? value : {}
}

function parseArguments(value: unknown): unknown {
  if (typeof value !== 'string') return value ?? {}
  try {
    return JSON.parse(value) as unknown
  } catch {
    return {}
  }
}

function toOpenAiMessage(message: LlmMessage): Record<string, unknown> {
  switch (message.role) {
    case 'user':
      return { role: 'user', content: message.text }
    case 'tool':
      return { role: 'tool', tool_call_id: message.toolCallId, content: message.text }
    case 'assistant': {
      const toolCalls = message.toolCalls ?? []
      return {
        role: 'assistant',
        content: message.text || null,
        ...(toolCalls.length > 0
          ? {
              tool_calls: toolCalls.map((call) => ({
                id: call.id,
                type: 'function',
                function: {
                  name: call.name,
                  arguments: typeof call.arguments === 'string' ? call.arguments : JSON.stringify(call.arguments ?? {}),
                },
              })),
            }
          : {}),
      }
    }
    default: {
      const neverMessage: never = message
      return neverMessage
    }
  }
}

export function buildOpenRouterRequest(request: LlmRequest, model: string): Record<string, unknown> {
  return {
    model,
    temperature: 0.2,
    messages: [{ role: 'system', content: systemPrompt(request.locale, request.today) }, ...request.messages.map(toOpenAiMessage)],
    ...(request.tools.length > 0
      ? {
          tools: request.tools.map((tool) => ({
            type: 'function',
            function: { name: tool.name, description: tool.description, parameters: tool.parameters },
          })),
          tool_choice: 'auto',
        }
      : {}),
  }
}

export function parseOpenRouterResponse(payload: unknown): LlmResponse {
  const choices = asObject(payload).choices
  if (!Array.isArray(choices) || !isObject(choices[0])) throw new Error('no-choice')
  const message = asObject(asObject(choices[0]).message)
  const text = typeof message.content === 'string' ? message.content : ''
  const rawCalls = Array.isArray(message.tool_calls) ? message.tool_calls : []
  const toolCalls: LlmToolCall[] = []
  rawCalls.forEach((call, index) => {
    const item = asObject(call)
    const fn = asObject(item.function)
    if (typeof fn.name !== 'string') return
    toolCalls.push({
      id: typeof item.id === 'string' ? item.id : `openrouter-${index}-${fn.name}`,
      name: fn.name,
      arguments: parseArguments(fn.arguments),
    })
  })
  return {
    ...(text ? { text } : {}),
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
  }
}

export class OpenRouterProvider implements LlmProvider {
  constructor(
    private readonly options: {
      apiKey: string
      model?: string
      referer?: string
      title?: string
      fetchImpl?: typeof fetch
    },
  ) {}

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const fetchImpl = this.options.fetchImpl ?? fetch
    const model = this.options.model || DEFAULT_OPENROUTER_MODEL
    const response = await fetchImpl(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.options.apiKey}`,
        'HTTP-Referer': this.options.referer || OPENROUTER_REFERER,
        'X-Title': this.options.title || OPENROUTER_TITLE,
      },
      body: JSON.stringify(buildOpenRouterRequest(request, model)),
    })
    if (!response.ok) throw new Error(`openrouter-${response.status}`)
    return parseOpenRouterResponse(await response.json())
  }
}
