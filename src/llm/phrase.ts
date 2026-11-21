import type { LlmProvider, LlmRequest, LlmResponse } from '../domain/ai/loop'
import { shiftMonth } from '../domain/dates'
import { formatInr } from '../domain/money'
import { resolvePeriod } from '../domain/period'
import type { Locale } from '../domain/types'

type Span = 'today' | 'this-month' | 'last-month' | 'this-year' | 'last-year'

const PERIOD: Record<Locale, Record<Span, string>> = {
  en: { today: 'today', 'this-month': 'this month', 'last-month': 'last month', 'this-year': 'this year', 'last-year': 'last year' },
  hi: { today: 'आज', 'this-month': 'इस महीने', 'last-month': 'पिछले महीने', 'this-year': 'इस साल', 'last-year': 'पिछले साल' },
  gu: { today: 'આજે', 'this-month': 'આ મહિને', 'last-month': 'ગયા મહિને', 'this-year': 'આ વર્ષે', 'last-year': 'ગયા વર્ષે' },
}

const CATEGORY: Record<Locale, Record<string, string>> = {
  en: { cloth: 'cloth', stitching: 'stitching', notions: 'thread and buttons', alteration: 'alterations', rent: 'rent', electricity: 'electricity', wages: 'wages' },
  hi: { cloth: 'कपड़ा', stitching: 'सिलाई', notions: 'धागा और बटन', alteration: 'सुधार', rent: 'किराया', electricity: 'बिजली', wages: 'मज़दूरी' },
  gu: { cloth: 'કપડું', stitching: 'સિલાઈ', notions: 'દોરો અને બટન', alteration: 'સુધારો', rent: 'ભાડું', electricity: 'વીજળી', wages: 'મજૂરી' },
}

const GREETING: Record<Locale, string> = {
  en: 'Ask about income, expenses, or your balance.',
  hi: 'आमदनी, खर्च, या बाकी के बारे में पूछिए.',
  gu: 'આવક, ખર્ચ, અથવા બાકી વિશે પૂછો.',
}

const UNREADABLE: Record<Locale, string> = {
  en: 'I could not read that. Try today, this month, or last month.',
  hi: 'यह समझ नहीं आया. आज, इस महीने, या पिछले महीने के बारे में पूछिए.',
  gu: 'આ સમજાયું નહીં. આજે, આ મહિને, અથવા ગયા મહિને વિશે પૂછો.',
}

const CATEGORY_PATTERNS: { id: string; pattern: RegExp }[] = [
  { id: 'cloth', pattern: /cloth|kapda|कपड|કપડ/i },
  { id: 'stitching', pattern: /stitch|silai|सिला|સિલાઈ/i },
  { id: 'notions', pattern: /thread|button|notion|धाग|બટન|દોર/i },
  { id: 'alteration', pattern: /alter|सुधार|સુધાર/i },
  { id: 'rent', pattern: /rent|kiraya|किरा|ભાડ/i },
  { id: 'electricity', pattern: /electric|bijli|बिजल|વીજળ/i },
  { id: 'wages', pattern: /wage|salary|मजदूर|मज़दूर|મજૂર/i },
]

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function detectSpan(question: string): Span {
  if (/last year|पिछले साल|पिछले वर्ष|ગયા વર્ષ/i.test(question)) return 'last-year'
  if (/this year|इस साल|इस वर्ष|આ વર્ષ/i.test(question)) return 'this-year'
  if (/last month|previous month|पिछले महीने|पिछले महिने|ગયા મહિન/i.test(question)) return 'last-month'
  if (/today|आज|આજે/i.test(question)) return 'today'
  if (/this month|इस महीने|આ મહિન/i.test(question)) return 'this-month'
  return 'this-month'
}

function spanRange(span: Span, today: string): { from: string; to: string } {
  switch (span) {
    case 'today':
      return resolvePeriod({ kind: 'day', date: today })
    case 'this-month':
      return resolvePeriod({ kind: 'month', month: today.slice(0, 7) })
    case 'last-month':
      return resolvePeriod({ kind: 'month', month: shiftMonth(today.slice(0, 7), -1) })
    case 'this-year':
      return resolvePeriod({ kind: 'year', year: today.slice(0, 4) })
    case 'last-year':
      return resolvePeriod({ kind: 'year', year: String(Number(today.slice(0, 4)) - 1) })
    default: {
      const neverSpan: never = span
      return neverSpan
    }
  }
}

function detectCategory(question: string): string | undefined {
  return CATEGORY_PATTERNS.find((item) => item.pattern.test(question))?.id
}

function detectType(question: string): 'income' | 'expense' | undefined {
  const spend = /spend|spent|expense|खर्च|ખર્ચ/i.test(question)
  const earn = /income|earn|आमद|કમાણ|આવક/i.test(question)
  if (spend && !earn) return 'expense'
  if (earn && !spend) return 'income'
  return undefined
}

function isBalance(question: string): boolean {
  return /balance|बाकी|બાકી/i.test(question)
}

function isList(question: string): boolean {
  return /\blist\b|show me|दिखा|બતાવ/i.test(question)
}

function isBookQuestion(question: string): boolean {
  return /spend|spent|expense|income|earn|balance|total|how much|list|show|ખર્ચ|આવક|બાકી|કેટલ|खर्च|आमद|बाकी|कितना|दिखा|બતાવ/i.test(question)
}

function latestUserText(request: LlmRequest): string {
  for (let index = request.messages.length - 1; index >= 0; index -= 1) {
    const message = request.messages[index]
    if (message?.role === 'user') return message.text
  }
  return ''
}

function sentence(
  locale: Locale,
  question: string,
  output: Record<string, unknown>,
): string {
  if ('error' in output) return UNREADABLE[locale]
  const period = PERIOD[locale][detectSpan(question)]
  const count = typeof output.count === 'number' ? String(output.count) : '0'
  if (typeof output.balancePaise === 'number') {
    const amount = formatInr(output.balancePaise)
    if (locale === 'hi') return `आपकी बाकी ${amount} है.`
    if (locale === 'gu') return `તમારી બાકી ${amount} છે.`
    return `Your balance is ${amount}.`
  }
  if (Array.isArray(output.transactions)) {
    if (locale === 'hi') return `${period} ${count} एंट्री हैं.`
    if (locale === 'gu') return `${period} ${count} નોંધ છે.`
    return `${count} entries ${period}.`
  }
  if (typeof output.expensePaise !== 'number' || typeof output.incomePaise !== 'number') return UNREADABLE[locale]
  const type = detectType(question)
  const categoryId = detectCategory(question)
  const category = categoryId ? CATEGORY[locale][categoryId] : undefined
  if (type === 'expense') {
    const amount = formatInr(output.expensePaise)
    if (locale === 'hi') return category ? `${period} ${category} पर ${amount} खर्च हुए. ${count} एंट्री.` : `${period} ${amount} खर्च हुए. ${count} एंट्री.`
    if (locale === 'gu') return category ? `${period} ${category} પર ${amount} ખર્ચ્યા. ${count} નોંધ.` : `${period} ${amount} ખર્ચ્યા. ${count} નોંધ.`
    const entryWord = count === '1' ? '1 entry' : `${count} entries`
    return category ? `You spent ${amount} on ${category} ${period}. ${entryWord}.` : `You spent ${amount} ${period}. ${entryWord}.`
  }
  if (type === 'income') {
    const amount = formatInr(output.incomePaise)
    if (locale === 'hi') return `${period} आमदनी ${amount} है. ${count} एंट्री.`
    if (locale === 'gu') return `${period} આવક ${amount} છે. ${count} નોંધ.`
    return `Income ${period} is ${amount}. ${count === '1' ? '1 entry' : `${count} entries`}.`
  }
  const income = formatInr(output.incomePaise)
  const expense = formatInr(output.expensePaise)
  const net = formatInr(typeof output.netPaise === 'number' ? output.netPaise : output.incomePaise - output.expensePaise)
  if (locale === 'hi') return `${period}: आमदनी ${income}, खर्च ${expense}, शुद्ध ${net}.`
  if (locale === 'gu') return `${period}: આવક ${income}, ખર્ચ ${expense}, ચોખ્ખું ${net}.`
  return `${period}: income ${income}, expenses ${expense}, net ${net}.`
}

/** Offline stand-in for Gemini. It only understands a small phrase list, and every figure comes from a tool. */
export class PhraseProvider implements LlmProvider {
  async complete(request: LlmRequest): Promise<LlmResponse> {
    const last = request.messages[request.messages.length - 1]
    if (!last) return { text: '' }
    if (last.role === 'tool') {
      let output: unknown
      try {
        output = JSON.parse(last.text) as unknown
      } catch {
        return { text: UNREADABLE[request.locale] }
      }
      if (!isObject(output)) return { text: UNREADABLE[request.locale] }
      return { text: sentence(request.locale, latestUserText(request), output) }
    }
    if (last.role !== 'user') return { text: '' }
    const question = last.text
    if (!isBookQuestion(question)) return { text: GREETING[request.locale] }
    if (isBalance(question)) {
      return { toolCalls: [{ id: 'phrase-balance', name: 'balance_on', arguments: { date: request.today } }] }
    }
    const range = spanRange(detectSpan(question), request.today)
    const category = detectCategory(question)
    const type = detectType(question)
    const args = {
      from: range.from,
      to: range.to,
      ...(category ? { category } : {}),
      ...(type ? { type } : {}),
    }
    if (isList(question)) {
      return { toolCalls: [{ id: 'phrase-list', name: 'list_transactions', arguments: { ...args, limit: 8 } }] }
    }
    return { toolCalls: [{ id: 'phrase-totals', name: 'period_totals', arguments: args }] }
  }
}
