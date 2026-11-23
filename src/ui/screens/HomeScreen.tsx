import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { categoryLabel, formatDate, translate, type MessageKey } from '../../i18n'
import { shiftMonth, todayLocal } from '../../domain/dates'
import { quickAdds } from '../../domain/insights'
import { categoryTotals, periodTotals, recentTransactions, resolvePeriod } from '../../domain/period'
import { formatInr } from '../../domain/money'
import type { Transaction } from '../../domain/types'
import { useBooks, type SyncStatus } from '../books'
import { draftFrom, draftPreset, type Draft } from '../EntrySheet'
import { MoneyFigure } from '../MoneyFigure'
import { shareStatement } from '../statementExport'

function syncLabel(status: SyncStatus, t: (key: MessageKey, vars?: Record<string, string | number>) => string): string {
  switch (status.kind) {
    case 'unconfigured':
      return t('syncUnconfigured')
    case 'signed-out':
      return t('syncSignedOut')
    case 'offline':
      return t('syncOffline')
    case 'syncing':
      return t('syncing')
    case 'synced':
      return t('synced', { time: status.at })
    case 'error':
      return t('syncError')
    default: {
      const neverStatus: never = status
      return neverStatus
    }
  }
}

export function HomeScreen({
  onDraft,
  onLedger,
  onAsk,
  onDelete,
}: {
  onDraft: (draft: Draft) => void
  onLedger: () => void
  onAsk: (question: string) => void
  onDelete: (row: Transaction) => void
}) {
  const { state, syncStatus, dispatch, notify } = useBooks()
  const profile = state.profile
  const [kind, setKind] = useState<'income' | 'expense'>('income')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('stitching')
  const [exportOpen, setExportOpen] = useState(false)
  const [filter, setFilter] = useState<'day' | 'month' | 'year' | 'custom'>('month')
  if (!profile) return null
  const shop = profile
  const t = (key: MessageKey, vars?: Record<string, string | number>) => translate(state.locale, key, vars)
  const today = todayLocal()
  const monthKey = today.slice(0, 7)
  const month = resolvePeriod({ kind: 'month', month: monthKey })
  const previous = resolvePeriod({ kind: 'month', month: shiftMonth(monthKey, -1) })
  const todayTotals = periodTotals(state.transactions, { from: today, to: today })
  const monthTotals = periodTotals(state.transactions, month)
  const previousTotals = periodTotals(state.transactions, previous)
  const balance = profile.openingBalancePaise + state.transactions.reduce((sum, row) => {
    if (row.deletedAt) return sum
    return sum + (row.type === 'income' ? row.amountPaise : -row.amountPaise)
  }, 0)
  const recent = recentTransactions(state.transactions, 5)
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${today}T00:00:00`)
    date.setDate(date.getDate() - (6 - index))
    const stamp = date.toISOString().slice(0, 10)
    const totals = periodTotals(state.transactions, { from: stamp, to: stamp })
    return { stamp, label: stamp.slice(8), income: totals.incomePaise, expense: totals.expensePaise }
  })
  const dayMax = Math.max(1, ...days.flatMap((day) => [day.income, day.expense]))
  const categories = categoryTotals(state.transactions, month)
    .map((row) => ({ ...row, paise: row.expensePaise + row.incomePaise }))
    .filter((row) => row.paise > 0)
    .slice(0, 4)
  const categoryMax = Math.max(1, ...categories.map((row) => row.paise))
  const share = monthTotals.incomePaise + monthTotals.expensePaise
  const incomeShare = share === 0 ? 0 : Math.round((monthTotals.incomePaise / share) * 100)
  const delta = monthTotals.netPaise - previousTotals.netPaise
  const adds = quickAdds(state.transactions)
  const suggestions = [t('suggestionCloth'), t('suggestionBalance'), t('suggestionIncome')]
  const monthRange = filter === 'day' ? resolvePeriod({ kind: 'day', date: today }) : filter === 'year' ? resolvePeriod({ kind: 'year', year: today.slice(0, 4) }) : month

  async function saveQuick() {
    const rupees = Number(amount)
    if (!Number.isFinite(rupees) || rupees <= 0) {
      notify(t('invalidAmount'))
      return
    }
    dispatch({
      type: 'add',
      id: crypto.randomUUID(),
      now: new Date().toISOString(),
      entry: { type: kind, title: categoryLabel(state.locale, category), amountPaise: Math.round(rupees * 100), date: today, payment: 'cash', category, note: '' },
    })
    setAmount('')
    notify(t('saved'))
  }

  async function shareFile(format: 'pdf' | 'csv') {
    setExportOpen(false)
    try {
      await shareStatement({
        format,
        shopName: shop.shopName,
        openingBalancePaise: shop.openingBalancePaise,
        transactions: state.transactions,
        range: monthRange,
        label: formatDate(today, state.locale),
        locale: state.locale,
        t,
      })
      notify(format === 'pdf' ? t('pdfReady') : t('csvReady'))
    } catch {
      notify(t('exportFailed'))
    }
  }

  return (
    <div className="home">
      <header className="dash-head">
        <div>
          <h1>{shop.shopName}</h1>
          <p>{formatDate(today, state.locale)} · {syncLabel(syncStatus, t)}</p>
        </div>
        <div className="dash-actions">
          <button type="button" className="primary" onClick={() => onDraft(draftPreset({ type: 'income', title: '', category: 'stitching', payment: 'cash' }))}>{t('addEntry')}</button>
          <div className="export-menu">
            <button type="button" className="ghost-ink" onClick={() => setExportOpen((open) => !open)}>{t('exportPdf').split(' ')[0]}</button>
            {exportOpen ? (
              <menu>
                <li><button type="button" onClick={() => void shareFile('pdf')}>{t('exportPdf')}</button></li>
                <li><button type="button" onClick={() => void shareFile('csv')}>{t('exportCsv')}</button></li>
              </menu>
            ) : null}
          </div>
        </div>
      </header>
      <div className="stat-row">
        <article className="stat hero">
          <header><span>{t('balance')}</span><button type="button" onClick={onLedger} aria-label={t('openLedger')}><ArrowUpRight size={16} /></button></header>
          <MoneyFigure paise={balance} />
          <small>{formatInr(delta)} {t('vsLastMonth')}</small>
        </article>
        <article className="stat">
          <header><span>{t('today')} {t('income')}</span><button type="button" onClick={() => onDraft(draftPreset({ type: 'income', title: '', category: 'stitching', payment: 'cash' }))} aria-label={t('addIncome')}><ArrowUpRight size={16} /></button></header>
          <MoneyFigure paise={todayTotals.incomePaise} />
          <small>{t('vsLastMonth')}</small>
        </article>
        <article className="stat">
          <header><span>{t('today')} {t('expense')}</span><button type="button" onClick={() => onDraft(draftPreset({ type: 'expense', title: '', category: 'cloth', payment: 'cash' }))} aria-label={t('addExpense')}><ArrowUpRight size={16} /></button></header>
          <MoneyFigure paise={todayTotals.expensePaise} />
          <small>{t('vsLastMonth')}</small>
        </article>
        <article className="stat">
          <header><span>{t('thisMonth')} {t('net')}</span><button type="button" onClick={onLedger} aria-label={t('openLedger')}><ArrowUpRight size={16} /></button></header>
          <MoneyFigure paise={monthTotals.netPaise} />
          <small>{formatInr(delta)} {t('vsLastMonth')}</small>
        </article>
      </div>
      <div className="dash-grid">
        <section className="card">
          <h2>{t('incomeVsExpense')}</h2>
          <div className="week" aria-hidden="true">
            {days.map((day) => (
              <div className="week-col" key={day.stamp}>
                <span className="week-bars">
                  {day.income > 0 ? <i className="pill" style={{ height: `${(day.income / dayMax) * 100}%` }} /> : null}
                  {day.expense > 0 ? <i className="pill out" style={{ height: `${(day.expense / dayMax) * 100}%` }} /> : null}
                </span>
                <span>{day.label}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <h2>{t('quickAdd')}</h2>
          <div className="quick-line">
            <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} aria-label={t('amount')} placeholder={t('amount')} />
            <button type="button" aria-pressed={kind === 'income'} onClick={() => setKind('income')}>{t('typeIncome')}</button>
            <button type="button" aria-pressed={kind === 'expense'} onClick={() => setKind('expense')}>{t('typeExpense')}</button>
          </div>
          <div className="chips">
            {adds.slice(0, 4).map((item) => (
              <button key={`${item.category}-${item.type}`} type="button" aria-pressed={category === item.category} onClick={() => { setCategory(item.category); setKind(item.type) }}>
                {categoryLabel(state.locale, item.category)}
              </button>
            ))}
            <button type="button" className="quick-save" onClick={() => void saveQuick()}>{t('saveShop').split(' ')[0]}</button>
          </div>
        </section>
        <section className="card">
          <h2>{t('recent')}</h2>
          {recent.length === 0 ? <p>{t('emptyHome')}</p> : recent.map((row) => (
            <div className="entry-row" key={row.id}>
              <button type="button" onClick={() => onDraft(draftFrom(row.type, row))}>{row.title || categoryLabel(state.locale, row.category)}</button>
              <strong>{formatInr(row.type === 'expense' ? -row.amountPaise : row.amountPaise)}</strong>
              <button type="button" onClick={() => onDelete(row)}>{t('delete')}</button>
            </div>
          ))}
        </section>
        <section className="card">
          <h2>{t('topCategories')}</h2>
          <svg className="gauge" viewBox="0 0 120 70" role="img" aria-label={`${incomeShare}%`}>
            <path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke="#e6e6e6" strokeWidth="12" strokeLinecap="round" />
            <path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke="#f6b400" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(incomeShare / 100) * 157} 157`} />
            <text x="60" y="58" textAnchor="middle" fontSize="16" fill="currentColor">{incomeShare}%</text>
          </svg>
          {categories.map((row) => (
            <p key={row.category} className="cat-row">
              <span>{categoryLabel(state.locale, row.category)}</span>
              <span className="share-track" aria-hidden="true"><span style={{ width: `${(row.paise / categoryMax) * 100}%` }} /></span>
              <strong>{formatInr(row.paise)}</strong>
            </p>
          ))}
        </section>
        <section className="card">
          <h2>{t('askHome')}</h2>
          <div className="chips">
            {suggestions.map((question) => (
              <button key={question} type="button" onClick={() => onAsk(question)}>{question}</button>
            ))}
          </div>
        </section>
        <section className="card">
          <h2>{t('period')}</h2>
          <div className="chips">
            {(['day', 'month', 'year', 'custom'] as const).map((id) => (
              <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>{t(id === 'day' ? 'today' : id === 'month' ? 'thisMonth' : id === 'year' ? 'year' : 'custom')}</button>
            ))}
          </div>
          <p>{t('net')} {formatInr(periodTotals(state.transactions, filter === 'custom' ? month : monthRange).netPaise)}</p>
        </section>
      </div>
    </div>
  )
}
