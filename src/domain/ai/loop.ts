import { runTool, TOOL_SPECS, type ToolSpec } from './tools'
import type { LedgerSnapshot, Locale } from '../types'

export type { ToolSpec }

export type LlmToolCall = {
  id: string
  name: string
  arguments: unknown
}

export type LlmMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; toolCalls?: LlmToolCall[] }
  | { role: 'tool'; toolCallId: string; name: string; text: string }

export type LlmRequest = {
  locale: Locale
  today: string
  messages: LlmMessage[]
  tools: ToolSpec[]
}

export type LlmResponse = {
  text?: string
  toolCalls?: LlmToolCall[]
}

export interface LlmProvider {
  complete(request: LlmRequest): Promise<LlmResponse>
}

export type ToolTrace = {
  name: string
  arguments: unknown
  output: unknown
}

export type LedgerFact =
  | { kind: 'money'; label: 'income' | 'expense' | 'net' | 'balance'; paise: number }
  | { kind: 'count'; count: number }
  | { kind: 'range'; from: string; to: string }
  | { kind: 'lines'; lines: { date: string; title: string; type: 'income' | 'expense'; amountPaise: number }[] }
  | { kind: 'categories'; rows: { category: string; incomePaise: number; expensePaise: number }[] }

export type ChatResult = {
  messages: LlmMessage[]
  traces: ToolTrace[]
  answer: string
  facts: LedgerFact[]
  ungrounded: boolean
}

const MONEY =
  /(?:₹|Rs\.?|INR)\s*(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s*(?:₹|Rs\.?|INR|rupees|रुपये|રૂપિયા)|(\d{1,3}(?:,\d{2})+(?:\.\d+)?)/gi

function moneyPaise(text: string): number[] {
  const values: number[] = []
  for (const match of text.matchAll(MONEY)) {
    const raw = match[1] ?? match[2] ?? match[3]
    if (!raw) continue
    const rupees = Number(raw.replace(/,/g, ''))
    if (Number.isFinite(rupees)) values.push(Math.round(rupees * 100))
  }
  return values
}

function collectPaise(value: unknown, into: Set<number>): void {
  if (typeof value === 'number' && Number.isFinite(value)) {
    into.add(Math.round(value))
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectPaise(item, into)
    return
  }
  if (typeof value === 'object' && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === 'number' && key.endsWith('Paise')) into.add(Math.round(item))
      else collectPaise(item, into)
    }
  }
}

export function proseIsGrounded(text: string, traces: ToolTrace[]): boolean {
  const mentioned = moneyPaise(text)
  if (mentioned.length === 0) return true
  const allowed = new Set<number>()
  for (const trace of traces) collectPaise(trace.output, allowed)
  return mentioned.every((paise) => allowed.has(paise))
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function factsFromTraces(traces: ToolTrace[]): LedgerFact[] {
  const facts: LedgerFact[] = []
  for (const trace of traces) {
    if (!isObject(trace.output) || 'error' in trace.output) continue
    const output = trace.output
    if (typeof output.from === 'string' && typeof output.to === 'string') {
      facts.push({ kind: 'range', from: output.from, to: output.to })
    }
    if (typeof output.incomePaise === 'number') facts.push({ kind: 'money', label: 'income', paise: output.incomePaise })
    if (typeof output.expensePaise === 'number') facts.push({ kind: 'money', label: 'expense', paise: output.expensePaise })
    if (typeof output.netPaise === 'number') facts.push({ kind: 'money', label: 'net', paise: output.netPaise })
    if (typeof output.balancePaise === 'number') facts.push({ kind: 'money', label: 'balance', paise: output.balancePaise })
    if (typeof output.count === 'number') facts.push({ kind: 'count', count: output.count })
    if (Array.isArray(output.transactions)) {
      const lines = output.transactions.slice(0, 8).flatMap((row) => {
        if (!isObject(row)) return []
        const entryType: 'income' | 'expense' | null = row.type === 'income' ? 'income' : row.type === 'expense' ? 'expense' : null
        if (!entryType || typeof row.title !== 'string' || typeof row.amountPaise !== 'number') return []
        return [{ date: String(row.date), title: row.title, type: entryType, amountPaise: row.amountPaise }]
      })
      if (lines.length > 0) facts.push({ kind: 'lines', lines })
    }
    if (Array.isArray(output.rows)) {
      const rows = output.rows.flatMap((row) => {
        if (!isObject(row) || typeof row.category !== 'string') return []
        if (typeof row.incomePaise !== 'number' || typeof row.expensePaise !== 'number') return []
        return [{ category: row.category, incomePaise: row.incomePaise, expensePaise: row.expensePaise }]
      })
      if (rows.length > 0) facts.push({ kind: 'categories', rows })
    }
  }
  return facts
}

export async function runChat(options: {
  provider: LlmProvider
  snapshot: LedgerSnapshot
  locale: Locale
  today: string
  history: LlmMessage[]
  question: string
}): Promise<ChatResult> {
  const messages: LlmMessage[] = [...options.history, { role: 'user', text: options.question }]
  const traces: ToolTrace[] = []
  for (let round = 0; round < 4; round += 1) {
    const response = await options.provider.complete({
      locale: options.locale,
      today: options.today,
      messages,
      tools: TOOL_SPECS,
    })
    const toolCalls = response.toolCalls ?? []
    if (toolCalls.length > 0) {
      messages.push({ role: 'assistant', text: response.text ?? '', toolCalls })
      for (const call of toolCalls) {
        const output = runTool(call.name, call.arguments, options.snapshot)
        traces.push({ name: call.name, arguments: call.arguments, output })
        messages.push({ role: 'tool', toolCallId: call.id, name: call.name, text: JSON.stringify(output) })
      }
      continue
    }
    const raw = response.text ?? ''
    const grounded = proseIsGrounded(raw, traces)
    const answer = grounded ? raw : ''
    messages.push({ role: 'assistant', text: answer })
    return {
      messages,
      traces,
      answer,
      facts: factsFromTraces(traces),
      ungrounded: !grounded,
    }
  }
  return { messages, traces, answer: '', facts: factsFromTraces(traces), ungrounded: false }
}
