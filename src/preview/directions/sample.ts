export type Lang = 'en' | 'gu'
export type Kind = 'in' | 'out'
export type ThemeName = 'light' | 'dark'

export type Copy = { en: string; gu: string }

export type SampleRow = {
  id: string
  particular: Copy
  category: Copy
  kind: Kind
  paise: number
  day: 'today' | 'earlier'
}

export const shop: Copy = { en: 'Shree Ganesh Tailors', gu: 'શ્રી ગણેશ ટેલર્સ' }
export const todayLabel: Copy = { en: '23 November 2026', gu: '23 નવેમ્બર 2026' }

export const openingPaise = 4_822_000

export const sampleRows: SampleRow[] = [
  { id: 'r1', particular: { en: 'Blouse stitching, Meena Patel', gu: 'બ્લાઉઝ સિલાઈ, મીના પટેલ' }, category: { en: 'Stitching', gu: 'સિલાઈ' }, kind: 'in', paise: 85_000, day: 'today' },
  { id: 'r2', particular: { en: 'Cloth from the market', gu: 'બજારમાંથી કાપડ' }, category: { en: 'Cloth', gu: 'કાપડ' }, kind: 'out', paise: 240_000, day: 'today' },
  { id: 'r3', particular: { en: 'Sherwani, Rajeshbhai', gu: 'શેરવાની, રાજેશભાઈ' }, category: { en: 'Stitching', gu: 'સિલાઈ' }, kind: 'in', paise: 1_500_000, day: 'today' },
  { id: 'r4', particular: { en: 'School uniforms, class 6', gu: 'ધોરણ 6ના યુનિફોર્મ' }, category: { en: 'Stitching', gu: 'સિલાઈ' }, kind: 'in', paise: 45_000, day: 'today' },
  { id: 'r5', particular: { en: 'Thread and buttons', gu: 'દોરો અને બટન' }, category: { en: 'Supplies', gu: 'સામાન' }, kind: 'out', paise: 32_000, day: 'earlier' },
  { id: 'r6', particular: { en: 'Electricity bill', gu: 'વીજળી બિલ' }, category: { en: 'Shop', gu: 'દુકાન' }, kind: 'out', paise: 180_000, day: 'earlier' },
  { id: 'r7', particular: { en: 'Pant stitching, Kiran', gu: 'પાટલૂન સિલાઈ, કિરણ' }, category: { en: 'Stitching', gu: 'સિલાઈ' }, kind: 'in', paise: 120_000, day: 'today' },
  { id: 'r8', particular: { en: 'Saree fall, Nita Shah', gu: 'સાડી ફોલ, નીતા શાહ' }, category: { en: 'Stitching', gu: 'સિલાઈ' }, kind: 'in', paise: 15_000, day: 'today' },
  { id: 'r9', particular: { en: 'Lining cloth', gu: 'અસ્તરનું કાપડ' }, category: { en: 'Cloth', gu: 'કાપડ' }, kind: 'out', paise: 90_000, day: 'today' },
  { id: 'r10', particular: { en: 'Blouse set, last week', gu: 'બ્લાઉઝ સેટ, ગયા અઠવાડિયે' }, category: { en: 'Stitching', gu: 'સિલાઈ' }, kind: 'in', paise: 350_000, day: 'earlier' },
]

export const categories: Copy[] = [
  { en: 'Stitching', gu: 'સિલાઈ' },
  { en: 'Cloth', gu: 'કાપડ' },
  { en: 'Supplies', gu: 'સામાન' },
  { en: 'Shop', gu: 'દુકાન' },
]

export const draftParticular: Copy = { en: 'Trouser stitching, Kiran', gu: 'પાટલૂન સિલાઈ, કિરણ' }

const ui = {
  home: { en: 'Home', gu: 'ઘર' },
  newEntry: { en: 'New entry', gu: 'નવી એન્ટ્રી' },
  balance: { en: 'Balance', gu: 'બાકી' },
  todayIn: { en: 'In today', gu: 'આજની આવક' },
  todayOut: { en: 'Out today', gu: 'આજનો ખર્ચ' },
  particular: { en: 'Particular', gu: 'વિગત' },
  jama: { en: 'In', gu: 'જમા' },
  kind: { en: 'Kind', gu: 'પ્રકાર' },
  kharch: { en: 'Out', gu: 'ખર્ચ' },
  amount: { en: 'Amount', gu: 'રકમ' },
  category: { en: 'Category', gu: 'વર્ગ' },
  save: { en: 'Save entry', gu: 'એન્ટ્રી સાચવો' },
  cancel: { en: 'Cancel', gu: 'રદ' },
  what: { en: 'What was it', gu: 'શું થયું' },
  needAmount: { en: 'Write an amount greater than zero.', gu: 'શૂન્યથી મોટી રકમ લખો.' },
  light: { en: 'Light', gu: 'સફેદ' },
  dark: { en: 'Dark', gu: 'ઘેરું' },
  english: { en: 'English', gu: 'English' },
  gujarati: { en: 'ગુજરાતી', gu: 'ગુજરાતી' },
  recent: { en: 'Today and earlier', gu: 'આજે અને પહેલાં' },
  earlier: { en: 'Earlier', gu: 'પહેલાં' },
  inWord: { en: 'Income', gu: 'આવક' },
  outWord: { en: 'Expense', gu: 'ખર્ચ' },
  saved: { en: 'Entry saved in this preview.', gu: 'આ પૂર્વાવલોકનમાં એન્ટ્રી સચવાઈ.' },
} as const

export type UiKey = keyof typeof ui

export function t(lang: Lang, key: UiKey): string {
  return ui[key][lang]
}

export function text(lang: Lang, copy: Copy): string {
  return copy[lang]
}

export function other(lang: Lang, copy: Copy): string {
  return copy[lang === 'en' ? 'gu' : 'en']
}

export function inr(paise: number): string {
  const negative = paise < 0
  const rupees = Math.abs(paise) / 100
  const formatted = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(rupees)
  return negative ? `-${formatted}` : formatted
}

export function sum(rows: SampleRow[], kind: Kind, day?: SampleRow['day']): number {
  return rows.reduce((total, row) => {
    if (row.kind !== kind) return total
    if (day && row.day !== day) return total
    return total + row.paise
  }, 0)
}

export function balanceOf(rows: SampleRow[]): number {
  return openingPaise + sum(rows, 'in') - sum(rows, 'out')
}

export function readPreviewQuery(): { view: 'home' | 'add'; theme: ThemeName; lang: Lang } {
  const params = new URLSearchParams(window.location.search)
  return {
    view: params.get('view') === 'add' ? 'add' : 'home',
    theme: params.get('theme') === 'dark' ? 'dark' : 'light',
    lang: params.get('lang') === 'en' ? 'en' : 'gu',
  }
}
