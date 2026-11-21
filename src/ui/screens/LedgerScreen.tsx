import { useState } from 'react'
import { CATEGORY_IDS } from '../../domain/types'
import { shiftDay, shiftMonth, shiftYear, todayLocal } from '../../domain/dates'
import { formatInr, formatInrPlain } from '../../domain/money'
import { balanceAsOf, periodTotals, resolvePeriod, transactionsInPeriod } from '../../domain/period'
import type { Period, Transaction, TxType } from '../../domain/types'
import { buildCsv } from '../../domain/csv'
import { buildStatementPdf, type PdfFonts } from '../../export/pdf'
import { saveOrShare } from '../../export/share'
import { categoryLabel, formatDate, formatDay, formatMonth, paymentLabel, translate, type MessageKey } from '../../i18n'
import { useBooks } from '../books'
import { TxList } from '../TxList'

type Kind = Period['kind']

function pdfBlob(bytes: Uint8Array): Blob {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return new Blob([copy], { type: 'application/pdf' })
}

let fontCache: Promise<PdfFonts> | null = null
function loadFonts(): Promise<PdfFonts> {
  fontCache ??= (async () => {
    const load = async (path: string) => new Uint8Array(await (await fetch(path)).arrayBuffer())
    return { latin: await load('/fonts/NotoSans-Regular.ttf'), gujarati: await load('/fonts/NotoSansGujarati-Regular.ttf'), devanagari: await load('/fonts/NotoSansDevanagari-Regular.ttf') }
  })()
  return fontCache
}

export function LedgerScreen({ onAdd, onOpen }: { onAdd: (type: TxType) => void; onOpen: (row: Transaction) => void }) {
  const { state, notify } = useBooks()
  const profile = state.profile
  const [kind, setKind] = useState<Kind>('month')
  const [cursor, setCursor] = useState(todayLocal())
  const [from, setFrom] = useState(`${todayLocal().slice(0, 8)}01`)
  const [to, setTo] = useState(todayLocal())
  const [type, setType] = useState<'all' | TxType>('all')
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  if (!profile) return null
  const shop = profile
  const t = (key: MessageKey, vars?: Record<string, string | number>) => translate(state.locale, key, vars)
  const period: Period =
    kind === 'day' ? { kind, date: cursor } : kind === 'month' ? { kind, month: cursor.slice(0, 7) } : kind === 'year' ? { kind, year: cursor.slice(0, 4) } : { kind, from, to }
  const range = resolvePeriod(period)
  const categoryFilter = category === 'all' ? undefined : category
  const totals = periodTotals(state.transactions, { ...range, ...(categoryFilter ? { category: categoryFilter } : {}) })
  const rows = transactionsInPeriod(state.transactions, {
    ...range,
    ...(categoryFilter ? { category: categoryFilter } : {}),
    ...(type === 'all' ? {} : { type }),
    ...(search.trim() ? { search } : {}),
  })
  const label =
    kind === 'day' ? formatDate(cursor, state.locale) : kind === 'month' ? formatMonth(cursor.slice(0, 7), state.locale) : kind === 'year' ? cursor.slice(0, 4) : `${formatDate(range.from, state.locale)} – ${formatDate(range.to, state.locale)}`

  function step(delta: number) {
    if (kind === 'day') setCursor(shiftDay(cursor, delta))
    else if (kind === 'month') setCursor(`${shiftMonth(cursor.slice(0, 7), delta)}-01`)
    else if (kind === 'year') setCursor(`${shiftYear(cursor.slice(0, 4), delta)}-01-01`)
  }

  async function exportPdf() {
    if (busy) return
    setBusy(true)
    try {
      const statementRows = transactionsInPeriod(state.transactions, { ...range, ...(categoryFilter ? { category: categoryFilter } : {}) })
      const bytes = await buildStatementPdf(
        {
          shopName: shop.shopName,
          periodLabel: label,
          generatedLabel: t('generated'),
          labels: {
            income: t('income'),
            expense: t('expense'),
            net: t('net'),
            balance: t('balance'),
            date: t('date'),
            description: t('description'),
            category: t('category'),
            payment: t('payment'),
            empty: t('noEntries'),
          },
          totals: { ...totals, balancePaise: balanceAsOf(shop.openingBalancePaise, state.transactions, range.to) },
          rows: statementRows.map((row) => ({
            date: `${formatDay(row.date, state.locale).day} ${formatDay(row.date, state.locale).month}`,
            title: row.title,
            category: categoryLabel(state.locale, row.category),
            payment: paymentLabel(state.locale, row.payment),
            note: row.note,
            type: row.type,
            amountPaise: row.amountPaise,
          })),
        },
        await loadFonts(),
      )
      await saveOrShare(`ledger-ai-${range.from}-to-${range.to}.pdf`, pdfBlob(bytes))
      notify(t('pdfReady'))
    } catch {
      notify(t('exportFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function exportCsv() {
    if (busy) return
    setBusy(true)
    try {
      const statementRows = transactionsInPeriod(state.transactions, { ...range, ...(categoryFilter ? { category: categoryFilter } : {}) })
      const csv = buildCsv({
        labels: { shop: t('shop'), period: t('period'), income: t('income'), expense: t('expense'), net: t('net'), balance: t('balance') },
        shopName: shop.shopName,
        periodLabel: label,
        income: formatInrPlain(totals.incomePaise),
        expense: formatInrPlain(totals.expensePaise),
        net: formatInrPlain(totals.netPaise),
        balance: formatInrPlain(balanceAsOf(shop.openingBalancePaise, state.transactions, range.to)),
        columns: { date: t('date'), type: `${t('income')}/${t('expense')}`, title: t('description'), category: t('category'), payment: t('payment'), amount: t('amount'), note: t('note') },
        rows: statementRows.map((row) => ({
          date: row.date,
          type: row.type === 'income' ? t('typeIncome') : t('typeExpense'),
          title: row.title,
          category: categoryLabel(state.locale, row.category),
          payment: paymentLabel(state.locale, row.payment),
          amount: formatInrPlain(row.type === 'income' ? row.amountPaise : -row.amountPaise),
          note: row.note,
        })),
      })
      await saveOrShare(`ledger-ai-${range.from}-to-${range.to}.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      notify(t('csvReady'))
    } catch {
      notify(t('exportFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <h1>{t('ledger')}</h1>
        <p>{t('entries', { count: rows.length })}</p>
      </div>
      <div className="segmented" role="group" aria-label={t('period')}>
        {(['day', 'month', 'year', 'range'] as const).map((item) => (
          <button key={item} type="button" aria-pressed={kind === item} onClick={() => setKind(item)}>
            {t(item)}
          </button>
        ))}
      </div>
      {kind === 'range' ? (
        <div className="row-2">
          <label className="field">
            {t('from')}
            <input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="field">
            {t('to')}
            <input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} />
          </label>
        </div>
      ) : (
        <div className="stepper">
          <button type="button" onClick={() => step(-1)} aria-label={t('previous')}>
            {t('previous')}
          </button>
          <strong>{label}</strong>
          <button type="button" onClick={() => step(1)} aria-label={t('next')}>
            {t('next')}
          </button>
        </div>
      )}
      <div className="segmented" role="group" aria-label={t('category')}>
        {(['all', 'income', 'expense'] as const).map((item) => (
          <button key={item} type="button" aria-pressed={type === item} onClick={() => setType(item)}>
            {item === 'all' ? t('all') : item === 'income' ? t('income') : t('expense')}
          </button>
        ))}
      </div>
      <label className="field">
        {t('category')}
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="all">{t('allCategories')}</option>
          {CATEGORY_IDS.map((id) => (
            <option key={id} value={id}>
              {categoryLabel(state.locale, id)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        {t('searchLabel')}
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('searchPlaceholder')} />
      </label>
      <p className="period-label">{label}</p>
      <div className="totals">
        <p>
          <span>{t('income')}</span>
          <strong>{formatInr(totals.incomePaise)}</strong>
        </p>
        <p>
          <span>{t('expense')}</span>
          <strong>{formatInr(totals.expensePaise)}</strong>
        </p>
        <p>
          <span>{t('net')}</span>
          <strong>{formatInr(totals.netPaise)}</strong>
        </p>
      </div>
      <div className="row-2 export-row">
        <button type="button" className="ghost-ink" onClick={() => void exportPdf()} disabled={busy}>
          {busy ? t('working') : t('exportPdf')}
        </button>
        <button type="button" className="ghost-ink" onClick={() => void exportCsv()} disabled={busy}>
          {busy ? t('working') : t('exportCsv')}
        </button>
      </div>
      <div className="band-actions in-page">
        <button type="button" className="primary" onClick={() => onAdd('income')}>
          {t('addIncome')}
        </button>
        <button type="button" className="ghost-ink" onClick={() => onAdd('expense')}>
          {t('addExpense')}
        </button>
      </div>
      <TxList rows={rows} locale={state.locale} empty={t('noEntries')} onOpen={onOpen} />
    </section>
  )
}
