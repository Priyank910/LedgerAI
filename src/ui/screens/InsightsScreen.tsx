import { useState } from 'react'
import { CATEGORY_IDS } from '../../domain/types'
import { shiftMonth, todayLocal } from '../../domain/dates'
import { monthTrend } from '../../domain/insights'
import { categoryTotals, periodTotals, resolvePeriod } from '../../domain/period'
import { formatInr } from '../../domain/money'
import { categoryLabel, formatMonth, translate, type MessageKey } from '../../i18n'
import { useBooks } from '../books'
import { MoneyFigure } from '../MoneyFigure'
import { shareStatement } from '../statementExport'
import { TrendChart } from '../Trend'

export function InsightsScreen() {
  const { state, notify } = useBooks()
  const profile = state.profile
  const [month, setMonth] = useState(todayLocal().slice(0, 7))
  const [busy, setBusy] = useState(false)
  if (!profile) return null
  const shop = profile
  const t = (key: MessageKey, vars?: Record<string, string | number>) => translate(state.locale, key, vars)
  const range = resolvePeriod({ kind: 'month', month })
  const totals = periodTotals(state.transactions, range)
  const trend = monthTrend(state.transactions, month)
  const categories = CATEGORY_IDS.map((id) => {
    const found = categoryTotals(state.transactions, range).find((row) => row.category === id)
    return { id, expensePaise: found?.expensePaise ?? 0, incomePaise: found?.incomePaise ?? 0 }
  }).filter((row) => row.expensePaise + row.incomePaise > 0)
  const max = Math.max(1, ...categories.map((row) => row.expensePaise + row.incomePaise))
  const label = formatMonth(month, state.locale)

  async function share(format: 'pdf' | 'csv') {
    if (busy) return
    setBusy(true)
    try {
      await shareStatement({
        format,
        shopName: shop.shopName,
        openingBalancePaise: shop.openingBalancePaise,
        transactions: state.transactions,
        range,
        label,
        locale: state.locale,
        t,
      })
      notify(format === 'pdf' ? t('pdfReady') : t('csvReady'))
    } catch {
      notify(t('exportFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="page">
      <h1>{t('insights')}</h1>
      <div className="stepper">
        <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label={t('previous')}>
          {t('previous')}
        </button>
        <strong>{label}</strong>
        <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label={t('next')}>
          {t('next')}
        </button>
      </div>
      <div className="totals">
        <p>
          <span>{t('income')}</span>
          <MoneyFigure paise={totals.incomePaise} />
        </p>
        <p>
          <span>{t('expense')}</span>
          <MoneyFigure paise={totals.expensePaise} />
        </p>
        <p>
          <span>{t('net')}</span>
          <MoneyFigure paise={totals.netPaise} />
        </p>
      </div>
      <h2>{t('trend')}</h2>
      <TrendChart points={trend} locale={state.locale} incomeLabel={t('income')} expenseLabel={t('expense')} />
      <h2>{t('topCategories')}</h2>
      {categories.length === 0 ? <p className="empty">{t('noCategories')}</p> : null}
      <div className="shares">
        {categories.map((row) => (
          <p key={row.id} className="share">
            <span>{categoryLabel(state.locale, row.id)}</span>
            <span className="share-track" aria-hidden="true">
              <span style={{ width: `${((row.expensePaise + row.incomePaise) / max) * 100}%` }} />
            </span>
            <strong>{formatInr(row.expensePaise + row.incomePaise)}</strong>
          </p>
        ))}
      </div>
      <div className="row-2 export-row">
        <button type="button" className="ghost-ink" onClick={() => void share('pdf')} disabled={busy}>
          {busy ? t('working') : t('exportPdf')}
        </button>
        <button type="button" className="ghost-ink" onClick={() => void share('csv')} disabled={busy}>
          {busy ? t('working') : t('exportCsv')}
        </button>
      </div>
    </section>
  )
}
