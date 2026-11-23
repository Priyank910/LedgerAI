import { useState } from 'react'
import { ArrowUpRight, MoreHorizontal, Scissors, Shirt, Zap } from 'lucide-react'
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

function Delta({ current, previous, label }: { current: number; previous: number; label: string }) {
  if (previous === 0 && current === 0) return null
  const pct = previous === 0 ? 100 : Math.round(((current - previous) / Math.abs(previous)) * 100)
  const text = `${pct > 0 ? '+' : ''}${pct}% ${label}`
  return <small className={pct < 0 ? 'delta down' : 'delta'}>{text}</small>
}

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
  const [openMenu, setOpenMenu] = useState<string | null>(null)
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
  const yesterdayDate = new Date(`${today}T12:00:00`)
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterday = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`
  const yesterdayTotals = periodTotals(state.transactions, { from: yesterday, to: yesterday })
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${today}T12:00:00`)
    date.setDate(date.getDate() - (6 - index))
    const stamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const totals = periodTotals(state.transactions, { from: stamp, to: stamp })
    return { stamp, label: String(date.getDate()), income: totals.incomePaise, expense: totals.expensePaise }
  })
  const dayMax = Math.max(1, ...days.flatMap((day) => [day.income, day.expense]))
  const weekTotal = days.reduce((sum, day) => sum + day.income + day.expense, 0)
  const categories = categoryTotals(state.transactions, month)
    .map((row) => ({ ...row, paise: row.expensePaise + row.incomePaise }))
    .filter((row) => row.paise > 0)
    .slice(0, 4)
  const categoryMax = Math.max(1, ...categories.map((row) => row.paise))
  const share = monthTotals.incomePaise + monthTotals.expensePaise
  const incomeShare = share === 0 ? 0 : Math.round((monthTotals.incomePaise / share) * 100)
  const adds = quickAdds(state.transactions).filter((item, index, list) => list.findIndex((other) => other.category === item.category) === index)
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
          <MoneyFigure className="kpi" paise={balance} />
          <Delta current={monthTotals.netPaise} previous={previousTotals.netPaise} label={t('vsLastMonth')} />
        </article>
        <article className="stat">
          <header><span>{t('today')} {t('income')}</span><button type="button" onClick={() => onDraft(draftPreset({ type: 'income', title: '', category: 'stitching', payment: 'cash' }))} aria-label={t('addIncome')}><ArrowUpRight size={16} /></button></header>
          <MoneyFigure className="kpi" paise={todayTotals.incomePaise} />
          <Delta current={todayTotals.incomePaise} previous={yesterdayTotals.incomePaise} label={t('vsLastMonth')} />
        </article>
        <article className="stat">
          <header><span>{t('today')} {t('expense')}</span><button type="button" onClick={() => onDraft(draftPreset({ type: 'expense', title: '', category: 'cloth', payment: 'cash' }))} aria-label={t('addExpense')}><ArrowUpRight size={16} /></button></header>
          <MoneyFigure className="kpi" paise={todayTotals.expensePaise} />
          <Delta current={todayTotals.expensePaise} previous={yesterdayTotals.expensePaise} label={t('vsLastMonth')} />
        </article>
        <article className="stat">
          <header><span>{t('thisMonth')} {t('net')}</span><button type="button" onClick={onLedger} aria-label={t('openLedger')}><ArrowUpRight size={16} /></button></header>
          <MoneyFigure className="kpi" paise={monthTotals.netPaise} />
          <Delta current={monthTotals.netPaise} previous={previousTotals.netPaise} label={t('vsLastMonth')} />
        </article>
      </div>
      <div className="dash-grid">
        <section className="card">
          <h2>{t('incomeVsExpense')}</h2>
          <div className="week">
            {days.map((day) => {
              const incomePx = day.income > 0 ? Math.max(28, Math.round((day.income / dayMax) * 112)) : 0
              const expensePx = day.expense > 0 ? Math.max(28, Math.round((day.expense / dayMax) * 112)) : 0
              const shareOfWeek = weekTotal === 0 ? 0 : Math.round(((day.income + day.expense) / weekTotal) * 100)
              return (
                <div className="week-col" key={day.stamp}>
                  {day.stamp === today ? <span className="tip">{shareOfWeek}%</span> : <span className="tip tip-spacer" />}
                  <span className="week-bars">
                    <i className="pill" style={{ height: `${incomePx}px` }} />
                    <i className="pill out" style={{ height: `${expensePx}px` }} />
                  </span>
                  <span>{day.label}</span>
                </div>
              )
            })}
          </div>
        </section>
        <section className="card">
          <h2>{t('quickAdd')}</h2>
          <label className="amount-line">
            <span className="sr-only">{t('amount')}</span>
            <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" />
          </label>
          <div className="segment" role="group" aria-label={t('typeIncome')}>
            <button type="button" aria-pressed={kind === 'income'} onClick={() => setKind('income')}>{t('typeIncome')}</button>
            <button type="button" aria-pressed={kind === 'expense'} onClick={() => setKind('expense')}>{t('typeExpense')}</button>
          </div>
          <div className="chips">
            {adds.slice(0, 4).map((item) => (
              <button key={item.category} type="button" aria-pressed={category === item.category} onClick={() => { setCategory(item.category); setKind(item.type) }}>
                {categoryLabel(state.locale, item.category)}
              </button>
            ))}
          </div>
          <button type="button" className="quick-save" onClick={() => void saveQuick()}>{t('saveEntry')}</button>
        </section>
        <section className="card">
          <h2>{t('recent')}</h2>
          {recent.length === 0 ? <p>{t('emptyHome')}</p> : recent.map((row) => (
            <div className="entry-row" key={row.id}>
              <span className={`cat-icon ${row.type}`} aria-hidden>{row.category === 'cloth' ? <Shirt size={16} /> : row.category === 'electricity' ? <Zap size={16} /> : <Scissors size={16} />}</span>
              <button type="button" className="entry-copy" onClick={() => onDraft(draftFrom(row.type, row))}>
                <strong>{row.title || categoryLabel(state.locale, row.category)}</strong>
                <small>{formatDate(row.date, state.locale)}</small>
              </button>
              <strong className={row.type === 'income' ? 'amt in' : 'amt out'}>{formatInr(row.amountPaise)}</strong>
              <span className="overflow">
                <button type="button" aria-label={t('delete')} onClick={() => setOpenMenu(openMenu === row.id ? null : row.id)}><MoreHorizontal size={16} /></button>
                {openMenu === row.id ? <button type="button" className="overflow-menu" onClick={() => { onDelete(row); setOpenMenu(null) }}>{t('delete')}</button> : null}
              </span>
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
      <aside className="phone-promo">
        <strong>{t('getWindows')}</strong>
        <p>{t('promoBody')}</p>
        <a href="https://github.com/Priyank910/LedgerAI/releases/latest">{t('downloadApp')}</a>
      </aside>
    </div>
  )
}
