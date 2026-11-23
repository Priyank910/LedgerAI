import { categoryLabel, formatDate, translate, type MessageKey } from '../../i18n'
import { todayLocal } from '../../domain/dates'
import { quickAdds, monthTrend } from '../../domain/insights'
import { categoryTotals, periodTotals, recentTransactions, resolvePeriod } from '../../domain/period'
import { formatInr } from '../../domain/money'
import type { Transaction } from '../../domain/types'
import { useBooks, type SyncStatus } from '../books'
import { draftFrom, draftPreset, type Draft } from '../EntrySheet'
import { MoneyFigure } from '../MoneyFigure'
import { TrendChart } from '../Trend'
import { TxList } from '../TxList'

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
  const { state, syncStatus } = useBooks()
  const profile = state.profile
  if (!profile) return null
  const t = (key: MessageKey, vars?: Record<string, string | number>) => translate(state.locale, key, vars)
  const today = todayLocal()
  const month = resolvePeriod({ kind: 'month', month: today.slice(0, 7) })
  const todayTotals = periodTotals(state.transactions, { from: today, to: today })
  const monthTotals = periodTotals(state.transactions, month)
  const balance = profile.openingBalancePaise + state.transactions.reduce((sum, row) => {
    if (row.deletedAt) return sum
    return sum + (row.type === 'income' ? row.amountPaise : -row.amountPaise)
  }, 0)
  const recent = recentTransactions(state.transactions, 5)
  const trend = monthTrend(state.transactions, today.slice(0, 7))
  const categories = categoryTotals(state.transactions, month)
    .map((row) => ({ ...row, paise: row.expensePaise + row.incomePaise }))
    .filter((row) => row.paise > 0)
    .slice(0, 4)
  const categoryMax = Math.max(1, ...categories.map((row) => row.paise))
  const adds = quickAdds(state.transactions)
  const suggestions = [t('suggestionCloth'), t('suggestionBalance'), t('suggestionIncome')]

  return (
    <div className="home">
      <div className="home-main">
      <header className="home-top">
        <div>
          <h1>{profile.shopName}</h1>
          <p>{formatDate(today, state.locale)}</p>
        </div>
      </header>
      <p className="sync-chip" role="status">{syncLabel(syncStatus, t)}</p>
      <section className="balance-card">
        <span>{t('balance')}</span>
        <MoneyFigure className="balance-num" paise={balance} />
        <div className="band-actions">
          <button type="button" className="solid" onClick={() => onDraft(draftPreset({ type: 'income', title: '', category: 'stitching', payment: 'cash' }))}>
            {t('addIncome')}
          </button>
          <button type="button" className="ghost" onClick={() => onDraft(draftPreset({ type: 'expense', title: '', category: 'other', payment: 'cash' }))}>
            {t('addExpense')}
          </button>
        </div>
      </section>
      <div className="tile-row">
        <article className="tile">
          <span>{t('today')}</span>
          <MoneyFigure paise={todayTotals.netPaise} />
          <small>{t('income')} {formatInr(todayTotals.incomePaise)}</small>
        </article>
        <article className="tile">
          <span>{t('thisMonth')}</span>
          <MoneyFigure paise={monthTotals.netPaise} />
          <small>{t('expense')} {formatInr(monthTotals.expensePaise)}</small>
        </article>
      </div>
      <section className="pad">
        <h2>{t('topCategories')}</h2>
        {categories.length === 0 ? <p className="empty">{t('noCategories')}</p> : null}
        <div className="shares">
          {categories.map((row) => (
            <p key={row.category} className="share">
              <span>{categoryLabel(state.locale, row.category)}</span>
              <span className="share-track" aria-hidden="true">
                <span style={{ width: `${(row.paise / categoryMax) * 100}%` }} />
              </span>
              <strong>{formatInr(row.paise)}</strong>
            </p>
          ))}
        </div>
      </section>
      <section className="pad">
        <h2>{t('quickAdd')}</h2>
        <div className="quick-row">
          {adds.map((item) => {
            const title = item.fromHistory ? item.title : categoryLabel(state.locale, item.category)
            return (
              <button
                key={`${item.type}-${title}-${item.category}`}
                type="button"
                className="quick"
                onClick={() => onDraft(draftPreset({ type: item.type, title, category: item.category, payment: item.payment }))}
              >
                <span>{item.type === 'income' ? t('typeIncome') : t('typeExpense')}</span>
                {title}
              </button>
            )
          })}
        </div>
      </section>
      <section className="pad">
        <div className="section-head">
          <h2>{t('recent')}</h2>
          <button type="button" className="text-button" onClick={onLedger}>
            {t('openLedger')}
          </button>
        </div>
        <TxList rows={recent} locale={state.locale} empty={t('emptyHome')} onOpen={(row) => onDraft(draftFrom(row.type, row))} onDelete={onDelete} />
      </section>
      <section className="pad ask-card">
        <h2>{t('askHome')}</h2>
        <div className="suggestions">
          {suggestions.map((question) => (
            <button key={question} type="button" onClick={() => onAsk(question)}>
              {question}
            </button>
          ))}
        </div>
      </section>
      </div>
      <section className="pad home-side">
        <h2>{t('trend')}</h2>
        <p className="help">{t('incomeVsExpense')}</p>
        <TrendChart points={trend} locale={state.locale} incomeLabel={t('income')} expenseLabel={t('expense')} />
      </section>
    </div>
  )
}
