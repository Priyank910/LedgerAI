import { describe, expect, it } from 'vitest'
import { runChat, type LlmProvider, type LlmResponse } from '../src/domain/ai/loop'
import { runTool } from '../src/domain/ai/tools'
import { demoTransactions } from '../src/domain/ledger'
import { formatInr } from '../src/domain/money'
import { PhraseProvider } from '../src/llm/phrase'
import type { LedgerSnapshot } from '../src/domain/types'

const today = '2026-03-15'
const demo = demoTransactions(today, '2026-03-15T00:00:00.000Z')
const snapshot: LedgerSnapshot = { profile: demo.profile, transactions: demo.transactions }

class Scripted implements LlmProvider {
  constructor(private readonly steps: LlmResponse[]) {}
  async complete(): Promise<LlmResponse> {
    const next = this.steps.shift()
    if (!next) throw new Error('script ended')
    return next
  }
}

describe('ai tools', () => {
  it('answers cloth last month from the books in English, Hindi, and Gujarati', async () => {
    const questions = [
      ['en', 'how much did I spend on cloth last month?'],
      ['hi', 'पिछले महीने कपड़े पर कितना खर्च हुआ?'],
      ['gu', 'ગયા મહિને કપડા પાછળ કેટલા ખર્ચ્યા?'],
    ] as const
    for (const [locale, question] of questions) {
      const result = await runChat({ provider: new PhraseProvider(), snapshot, locale, today, history: [], question })
      expect(result.ungrounded).toBe(false)
      expect(result.answer).toContain(formatInr(145_000))
      expect(result.answer).not.toContain(formatInr(220_000))
      expect(result.facts.some((fact) => fact.kind === 'money' && fact.label === 'expense' && fact.paise === 145_000)).toBe(true)
      expect(result.traces[0]?.name).toBe('period_totals')
    }
  })

  it('drops a total the model states without a matching tool result', async () => {
    const provider = new Scripted([{ text: 'You spent ₹999 on cloth.' }])
    const result = await runChat({ provider, snapshot, locale: 'en', today, history: [], question: 'cloth?' })
    expect(result.ungrounded).toBe(true)
    expect(result.answer).toBe('')
  })

  it('keeps a total that the tool actually returned', async () => {
    const provider = new Scripted([
      { toolCalls: [{ id: 'c1', name: 'period_totals', arguments: { from: '2026-02-01', to: '2026-02-28', type: 'expense', category: 'કપડું' } }] },
      { text: `Cloth was ${formatInr(145_000)}.` },
    ])
    const result = await runChat({ provider, snapshot, locale: 'en', today, history: [], question: 'cloth' })
    expect(result.ungrounded).toBe(false)
    expect(result.answer).toContain(formatInr(145_000))
    expect(runTool('balance_on', { date: today }, snapshot)).toMatchObject({ balancePaise: expect.any(Number) })
  })
})
