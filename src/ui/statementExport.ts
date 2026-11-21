import { buildCsv } from '../domain/csv'
import { formatInrPlain } from '../domain/money'
import { balanceAsOf, transactionsInPeriod } from '../domain/period'
import type { Locale, Transaction } from '../domain/types'
import { buildStatementPdf, type PdfFonts } from '../export/pdf'
import { saveOrShare } from '../export/share'
import { categoryLabel, formatDay, paymentLabel, type MessageKey } from '../i18n'

function pdfBlob(bytes: Uint8Array): Blob {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return new Blob([copy], { type: 'application/pdf' })
}

let fontCache: Promise<PdfFonts> | null = null
function loadFonts(): Promise<PdfFonts> {
  fontCache ??= (async () => {
    const load = async (path: string) => new Uint8Array(await (await fetch(path)).arrayBuffer())
    return {
      latin: await load('/fonts/NotoSans-Regular.ttf'),
      gujarati: await load('/fonts/NotoSansGujarati-Regular.ttf'),
      devanagari: await load('/fonts/NotoSansDevanagari-Regular.ttf'),
    }
  })()
  return fontCache
}

export async function shareStatement(input: {
  format: 'pdf' | 'csv'
  shopName: string
  openingBalancePaise: number
  transactions: Transaction[]
  range: { from: string; to: string }
  category?: string
  label: string
  locale: Locale
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
}): Promise<void> {
  const query = { ...input.range, ...(input.category ? { category: input.category } : {}) }
  const rows = transactionsInPeriod(input.transactions, query)
  const income = rows.reduce((sum, row) => sum + (row.type === 'income' ? row.amountPaise : 0), 0)
  const expense = rows.reduce((sum, row) => sum + (row.type === 'expense' ? row.amountPaise : 0), 0)
  const balance = balanceAsOf(input.openingBalancePaise, input.transactions, input.range.to)
  const file = `ledger-ai-${input.range.from}-to-${input.range.to}.${input.format}`
  if (input.format === 'csv') {
    const csv = buildCsv({
      labels: { shop: input.t('shop'), period: input.t('period'), income: input.t('income'), expense: input.t('expense'), net: input.t('net'), balance: input.t('balance') },
      shopName: input.shopName,
      periodLabel: input.label,
      income: formatInrPlain(income),
      expense: formatInrPlain(expense),
      net: formatInrPlain(income - expense),
      balance: formatInrPlain(balance),
      columns: {
        date: input.t('date'),
        type: `${input.t('income')}/${input.t('expense')}`,
        title: input.t('description'),
        category: input.t('category'),
        payment: input.t('payment'),
        amount: input.t('amount'),
        note: input.t('note'),
      },
      rows: rows.map((row) => ({
        date: row.date,
        type: row.type === 'income' ? input.t('typeIncome') : input.t('typeExpense'),
        title: row.title,
        category: categoryLabel(input.locale, row.category),
        payment: paymentLabel(input.locale, row.payment),
        amount: formatInrPlain(row.type === 'income' ? row.amountPaise : -row.amountPaise),
        note: row.note,
      })),
    })
    await saveOrShare(file, new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    return
  }
  const bytes = await buildStatementPdf(
    {
      shopName: input.shopName,
      periodLabel: input.label,
      generatedLabel: input.t('generated'),
      labels: {
        income: input.t('income'),
        expense: input.t('expense'),
        net: input.t('net'),
        balance: input.t('balance'),
        date: input.t('date'),
        description: input.t('description'),
        category: input.t('category'),
        payment: input.t('payment'),
        empty: input.t('noEntries'),
      },
      totals: { incomePaise: income, expensePaise: expense, netPaise: income - expense, balancePaise: balance },
      rows: rows.map((row) => ({
        date: `${formatDay(row.date, input.locale).day} ${formatDay(row.date, input.locale).month}`,
        title: row.title,
        category: categoryLabel(input.locale, row.category),
        payment: paymentLabel(input.locale, row.payment),
        note: row.note,
        type: row.type,
        amountPaise: row.amountPaise,
      })),
    },
    await loadFonts(),
  )
  await saveOrShare(file, pdfBlob(bytes))
}
