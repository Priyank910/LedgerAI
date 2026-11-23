export type PreviewRow = {
  id: string
  type: 'income' | 'expense'
  en: string
  gu: string
  rupees: number
  scope: 'today' | 'month' | 'older'
  catEn: string
  catGu: string
}

export const shop = { en: 'Ramesh Tailors', gu: 'રમેશ ટેલર્સ' }

export const rows: PreviewRow[] = [
  { id: '1', type: 'income', en: 'Two shirts', gu: 'બે શર્ટ સિલાઈ', rupees: 800, scope: 'today', catEn: 'Stitching', catGu: 'સિલાઈ' },
  { id: '2', type: 'expense', en: 'Suiting cloth', gu: 'કપડું - સૂટિંગ', rupees: 1450, scope: 'month', catEn: 'Cloth', catGu: 'કપડું' },
  { id: '3', type: 'expense', en: 'Cloth purchase', gu: 'कपड़ा खरीदी', rupees: 2200, scope: 'month', catEn: 'Cloth', catGu: 'કપડું' },
  { id: '4', type: 'income', en: 'Trouser alteration', gu: 'પેન્ટ સુધારો', rupees: 150, scope: 'month', catEn: 'Alteration', catGu: 'સુધારો' },
  { id: '5', type: 'expense', en: 'Power bill', gu: 'વીજળી બિલ', rupees: 920, scope: 'month', catEn: 'Electricity', catGu: 'વીજળી' },
  { id: '6', type: 'expense', en: 'Wages', gu: 'મજૂરી', rupees: 8000, scope: 'older', catEn: 'Wages', catGu: 'મજૂરી' },
  { id: '7', type: 'income', en: 'Wedding order', gu: 'લગ્નનો ઓર્ડર', rupees: 125000, scope: 'older', catEn: 'Stitching', catGu: 'સિલાઈ' },
]

export const openingRupees = 25000

export function rupees(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

export function inPeriod(row: PreviewRow, period: 'day' | 'month' | 'year' | 'range'): boolean {
  if (period === 'day') return row.scope === 'today'
  if (period === 'month') return row.scope === 'today' || row.scope === 'month'
  return true
}

export function totals(list: PreviewRow[]): { income: number; expense: number; net: number } {
  let income = 0
  let expense = 0
  for (const row of list) {
    if (row.type === 'income') income += row.rupees
    else expense += row.rupees
  }
  return { income, expense, net: income - expense }
}

export function balance(list: PreviewRow[]): number {
  return openingRupees + totals(list).net
}
