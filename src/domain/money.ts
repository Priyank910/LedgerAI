/** Shop amounts are integer paise so totals never depend on binary floats. */

function digitsToPaise(input: string, allowZero: boolean): number | null {
  const trimmed = input.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null
  const [whole, frac = ''] = trimmed.split('.')
  const paise = Number(whole) * 100 + Number(frac.padEnd(2, '0'))
  if (!Number.isSafeInteger(paise)) return null
  if (paise < 0 || (!allowZero && paise === 0)) return null
  return paise
}

export function parseRupeesToPaise(input: string): number | null {
  return digitsToPaise(input, false)
}

export function parseOpeningToPaise(input: string): number | null {
  return digitsToPaise(input, true)
}

export function rupeesToPaise(rupees: number): number {
  if (!Number.isFinite(rupees)) throw new Error('amount')
  const negative = rupees < 0
  const [whole, frac = ''] = Math.abs(rupees).toFixed(2).split('.')
  const paise = Number(whole) * 100 + Number(frac)
  if (!Number.isSafeInteger(paise)) throw new Error('amount')
  return negative ? -paise : paise
}

export function paiseToRupees(paise: number): number {
  return paise / 100
}

/** Indian grouping (lakh, crore) and the rupee sign. Always en-IN, in every language. */
export function formatInr(paise: number): string {
  const rupees = paise / 100
  const whole = paise % 100 === 0
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rupees)
}

export function formatInrPlain(paise: number): string {
  const negative = paise < 0
  const abs = Math.abs(paise)
  const rupees = Math.trunc(abs / 100)
  const frac = String(abs % 100).padStart(2, '0')
  const body = `${rupees}.${frac}`
  return negative ? `-${body}` : body
}
