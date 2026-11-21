import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'
import regeneratorRuntime from 'regenerator-runtime'
import { formatInr } from '../domain/money'

const runtimeGlobal = globalThis as typeof globalThis & { regeneratorRuntime?: unknown }
runtimeGlobal.regeneratorRuntime = regeneratorRuntime

export type PdfFonts = {
  latin: Uint8Array
  gujarati: Uint8Array
  devanagari: Uint8Array
}

export type StatementLabels = {
  income: string
  expense: string
  net: string
  balance: string
  date: string
  description: string
  category: string
  payment: string
  empty: string
}

export type StatementRow = {
  date: string
  title: string
  category: string
  payment: string
  note: string
  type: 'income' | 'expense'
  amountPaise: number
}

type Script = 'latin' | 'gujarati' | 'devanagari'

const indigo = rgb(20 / 255, 53 / 255, 92 / 255)
const ink = rgb(16 / 255, 32 / 255, 51 / 255)
const chalk = rgb(247 / 255, 251 / 255, 255 / 255)
const paper = rgb(244 / 255, 247 / 255, 251 / 255)
const incomeColor = rgb(12 / 255, 92 / 255, 69 / 255)
const expenseColor = rgb(142 / 255, 30 / 255, 30 / 255)
const rule = rgb(183 / 255, 198 / 255, 214 / 255)

function isJoiner(code: number): boolean {
  return code === 0x200c || code === 0x200d || (code >= 0xfe00 && code <= 0xfe0f)
}

export function splitRuns(text: string): { script: Script; text: string }[] {
  const runs: { script: Script; text: string }[] = []
  let current: Script | null = null
  let buffer = ''
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    let script: Script
    if (isJoiner(code) || char === ' ' || char === '\u00a0') script = current ?? 'latin'
    else if (code >= 0x0a80 && code <= 0x0aff) script = 'gujarati'
    else if (code >= 0x0900 && code <= 0x097f) script = 'devanagari'
    else script = 'latin'
    if (script !== current && buffer) {
      runs.push({ script: current ?? 'latin', text: buffer })
      buffer = ''
    }
    current = script
    buffer += char
  }
  if (buffer) runs.push({ script: current ?? 'latin', text: buffer })
  return runs
}

type Fonts = Record<Script, PDFFont>

function widthOf(text: string, fonts: Fonts, size: number): number {
  return splitRuns(text).reduce((sum, run) => {
    try {
      return sum + fonts[run.script].widthOfTextAtSize(run.text, size)
    } catch {
      return sum
    }
  }, 0)
}

function drawRuns(page: PDFPage, text: string, x: number, y: number, size: number, fonts: Fonts, color: RGB): number {
  let cursor = x
  for (const run of splitRuns(text)) {
    try {
      page.drawText(run.text, { x: cursor, y, size, font: fonts[run.script], color })
      cursor += fonts[run.script].widthOfTextAtSize(run.text, size)
    } catch {
      // A missing glyph must not blank the rest of the statement.
    }
  }
  return cursor
}

function fit(text: string, fonts: Fonts, size: number, maxWidth: number): string {
  if (widthOf(text, fonts, size) <= maxWidth) return text
  const chars = [...text]
  let low = 0
  let high = chars.length
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    const candidate = `${chars.slice(0, mid).join('')}…`
    if (widthOf(candidate, fonts, size) <= maxWidth) low = mid
    else high = mid - 1
  }
  return `${chars.slice(0, low).join('')}…`
}

function drawRight(page: PDFPage, text: string, right: number, y: number, size: number, fonts: Fonts, color: RGB) {
  const width = widthOf(text, fonts, size)
  drawRuns(page, text, right - width, y, size, fonts, color)
}

export async function buildStatementPdf(
  input: {
    shopName: string
    periodLabel: string
    generatedLabel: string
    labels: StatementLabels
    totals: { incomePaise: number; expensePaise: number; netPaise: number; balancePaise: number }
    rows: StatementRow[]
  },
  files: PdfFonts,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const fonts: Fonts = {
    latin: await pdf.embedFont(files.latin, { subset: true }),
    gujarati: await pdf.embedFont(files.gujarati, { subset: true }),
    devanagari: await pdf.embedFont(files.devanagari, { subset: true }),
  }
  pdf.setTitle(`${input.shopName} ${input.periodLabel}`)
  pdf.setAuthor('Ledger AI')

  const pageWidth = 595.28
  const pageHeight = 841.89
  const margin = 32
  let page = pdf.addPage([pageWidth, pageHeight])
  let y = 0

  const paintPage = (continued: boolean) => {
    page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: paper })
    page.drawRectangle({ x: 0, y: pageHeight - (continued ? 48 : 78), width: pageWidth, height: continued ? 48 : 78, color: indigo })
    drawRuns(page, input.shopName, margin, pageHeight - (continued ? 30 : 36), continued ? 14 : 20, fonts, chalk)
    if (!continued) drawRuns(page, input.periodLabel, margin, pageHeight - 60, 12, fonts, chalk)
    y = pageHeight - (continued ? 72 : 104)
  }

  const ensure = (needed: number) => {
    if (y - needed >= 40) return
    page = pdf.addPage([pageWidth, pageHeight])
    paintPage(true)
  }

  paintPage(false)
  const summary = [
    `${input.labels.income} ${formatInr(input.totals.incomePaise)}`,
    `${input.labels.expense} ${formatInr(input.totals.expensePaise)}`,
    `${input.labels.net} ${formatInr(input.totals.netPaise)}`,
    `${input.labels.balance} ${formatInr(input.totals.balancePaise)}`,
  ].join('    ')
  drawRuns(page, summary, margin, y, 11, fonts, ink)
  y -= 22
  page.drawLine({ start: { x: margin, y: y + 8 }, end: { x: pageWidth - margin, y: y + 8 }, thickness: 0.6, color: rule })

  const columns = [margin, 100, 268, 346, pageWidth - margin - 78, pageWidth - margin]
  const header = [input.labels.date, input.labels.description, input.labels.category, input.labels.payment, input.labels.income, input.labels.expense]
  header.forEach((label, index) => {
    if (index >= 4) drawRight(page, label, columns[index] ?? 0, y, 10, fonts, indigo)
    else drawRuns(page, label, columns[index] ?? margin, y, 10, fonts, indigo)
  })
  y -= 16

  if (input.rows.length === 0) {
    drawRuns(page, input.labels.empty, margin, y, 12, fonts, ink)
  }

  for (const row of input.rows) {
    ensure(row.note ? 36 : 22)
    const widthBetween = (index: number) => (columns[index + 1] ?? pageWidth - margin) - (columns[index] ?? margin) - 8
    drawRuns(page, fit(row.date, fonts, 10, widthBetween(0)), columns[0] ?? margin, y, 10, fonts, ink)
    drawRuns(page, fit(row.title, fonts, 11, widthBetween(1)), columns[1] ?? margin, y, 11, fonts, ink)
    drawRuns(page, fit(row.category, fonts, 10, widthBetween(2)), columns[2] ?? margin, y, 10, fonts, ink)
    drawRuns(page, fit(row.payment, fonts, 10, widthBetween(3)), columns[3] ?? margin, y, 10, fonts, ink)
    const amount = formatInr(row.amountPaise)
    if (row.type === 'income') drawRight(page, amount, columns[4] ?? 0, y, 10, fonts, incomeColor)
    else drawRight(page, amount, columns[5] ?? 0, y, 10, fonts, expenseColor)
    y -= 16
    if (row.note) {
      drawRuns(page, row.note, columns[1] ?? margin, y, 9, fonts, ink)
      y -= 14
    }
    page.drawLine({ start: { x: margin, y: y + 6 }, end: { x: pageWidth - margin, y: y + 6 }, thickness: 0.4, color: rule })
    y -= 6
  }

  drawRuns(page, input.generatedLabel, margin, 24, 9, fonts, indigo)
  return pdf.save()
}
