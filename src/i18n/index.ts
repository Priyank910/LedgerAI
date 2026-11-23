import { en, gu, hi, type MessageKey } from './messages'
import type { Locale } from '../domain/types'

const dictionaries = { en, hi, gu }

const shortMonths: Record<Locale, readonly string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  hi: ['जन', 'फ़र', 'मार्च', 'अप्रै', 'मई', 'जून', 'जुल', 'अग', 'सित', 'अक्टू', 'नव', 'दिस'],
  gu: ['જાન્યુ', 'ફેબ્રુ', 'માર્ચ', 'એપ્રિ', 'મે', 'જૂન', 'જુલા', 'ઑગ', 'સપ્ટે', 'ઑક્ટો', 'નવે', 'ડિસે'],
}

const months: Record<Locale, readonly string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  hi: ['जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'],
  gu: ['જાન્યુઆરી', 'ફેબ્રુઆરી', 'માર્ચ', 'એપ્રિલ', 'મે', 'જૂન', 'જુલાઈ', 'ઑગસ્ટ', 'સપ્ટેમ્બર', 'ઑક્ટોબર', 'નવેમ્બર', 'ડિસેમ્બર'],
}

export function translate(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  const template = dictionaries[locale][key]
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''))
}

export function formatDate(iso: string, locale: Locale): string {
  const [year, month, day] = iso.split('-')
  const name = months[locale][Number(month) - 1] ?? month
  return `${Number(day)} ${name} ${year}`
}

export function formatMonth(month: string, locale: Locale): string {
  const [year, index] = month.split('-')
  return `${months[locale][Number(index) - 1] ?? index} ${year}`
}

export function formatDay(iso: string, locale: Locale): { day: string; month: string } {
  const [, month, day] = iso.split('-')
  return { day: String(Number(day)), month: shortMonths[locale][Number(month) - 1] ?? '' }
}

export function categoryLabel(locale: Locale, category: string): string {
  const key = `cat_${category}`
  if (Object.prototype.hasOwnProperty.call(en, key)) return dictionaries[locale][key as MessageKey]
  return category
}

export function paymentLabel(locale: Locale, payment: string): string {
  if (payment === 'cash' || payment === 'upi' || payment === 'bank' || payment === 'card') return dictionaries[locale][payment]
  return payment
}

export type { MessageKey }
