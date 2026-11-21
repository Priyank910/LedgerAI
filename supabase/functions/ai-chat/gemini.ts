export type GeminiLocale = 'en' | 'hi' | 'gu'

export type GeminiMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; toolCalls?: { id: string; name: string; arguments: unknown }[] }
  | { role: 'tool'; toolCallId: string; name: string; text: string }

export type GeminiTool = { name: string; description: string; parameters: Record<string, unknown> }

export type GeminiResult = {
  text?: string
  toolCalls?: { id: string; name: string; arguments: unknown }[]
}

export function systemPrompt(locale: GeminiLocale, today: string): string {
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

export function geminiEndpoint(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asObject(value: unknown): Record<string, unknown> {
  return isObject(value) ? value : {}
}

export function buildGeminiRequest(input: {
  locale: GeminiLocale
  today: string
  messages: GeminiMessage[]
  tools: GeminiTool[]
}): Record<string, unknown> {
  const contents = input.messages.map((message) => {
    if (message.role === 'user') return { role: 'user', parts: [{ text: message.text }] }
    if (message.role === 'tool') {
      let response: unknown
      try {
        response = JSON.parse(message.text) as unknown
      } catch {
        response = { result: message.text }
      }
      return { role: 'user', parts: [{ functionResponse: { name: message.name, response: asObject(response) } }] }
    }
    const parts: Record<string, unknown>[] = []
    if (message.text) parts.push({ text: message.text })
    for (const call of message.toolCalls ?? []) {
      parts.push({ functionCall: { name: call.name, args: asObject(call.arguments) } })
    }
    if (parts.length === 0) parts.push({ text: '' })
    return { role: 'model', parts }
  })
  return {
    system_instruction: { parts: [{ text: systemPrompt(input.locale, input.today) }] },
    contents,
    tools: [
      {
        functionDeclarations: input.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        })),
      },
    ],
    toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
    generationConfig: { temperature: 0.2 },
  }
}

export function parseGeminiResponse(payload: unknown): GeminiResult {
  const root = asObject(payload)
  const candidates = root.candidates
  if (!Array.isArray(candidates) || !isObject(candidates[0])) throw new Error('no-candidate')
  const parts = asObject(asObject(candidates[0]).content).parts
  if (!Array.isArray(parts)) return { text: '' }
  let text = ''
  const toolCalls: NonNullable<GeminiResult['toolCalls']> = []
  parts.forEach((part, index) => {
    const item = asObject(part)
    if (typeof item.text === 'string') text += item.text
    const call = asObject(item.functionCall)
    if (typeof call.name === 'string') {
      toolCalls.push({ id: `gemini-${index}-${call.name}`, name: call.name, arguments: call.args ?? {} })
    }
  })
  return { text, ...(toolCalls.length > 0 ? { toolCalls } : {}) }
}

export async function completeWithGemini(input: {
  apiKey: string
  model: string
  locale: GeminiLocale
  today: string
  messages: GeminiMessage[]
  tools: GeminiTool[]
  fetchImpl?: typeof fetch
}): Promise<GeminiResult> {
  const fetchImpl = input.fetchImpl ?? fetch
  const response = await fetchImpl(geminiEndpoint(input.model), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': input.apiKey },
    body: JSON.stringify(buildGeminiRequest(input)),
  })
  if (!response.ok) throw new Error(`gemini-${response.status}`)
  return parseGeminiResponse(await response.json())
}
