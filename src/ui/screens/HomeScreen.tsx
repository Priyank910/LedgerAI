import { formatDate, translate, type MessageKey } from '../../i18n'
import { todayLocal } from '../../domain/dates'
import { periodTotals, recentTransactions, resolvePeriod } from '../../domain/period'
import type { TxType } from '../../domain/types'
import { useBooks } from '../books'
import { MoneyFigure } from '../MoneyFigure'
import { TxList } from '../TxList'

export function HomeScreen({ onAdd, onLedger }: { onAdd: (type: TxType) => void; onLedger: () => void }) {
  const { state } = useBooks()
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

  return (
    <>
      <header className="band">
        <div className="band-top">
          <h1>{profile.shopName}</h1>
          <p>{formatDate(today, state.locale)}</p>
        </div>
        <p className="balance-line">
          <span className="balance-caption">{t('balance')}</span>
          <MoneyFigure className="balance-num" paise={balance} />
        </p>
        <div className="band-actions">
          <button type="button" className="solid" onClick={() => onAdd('income')}>
            {t('addIncome')}
          </button>
          <button type="button" className="ghost" onClick={() => onAdd('expense')}>
            {t('addExpense')}
          </button>
        </div>
      </header>
      <section className="daybook">
        <h2>{t('today')}</h2>
        <div className="totals">
          <p>
            <span>{t('income')}</span>
            <MoneyFigure paise={todayTotals.incomePaise} />
          </p>
          <p>
            <span>{t('expense')}</span>
            <MoneyFigure paise={todayTotals.expensePaise} />
          </p>
          <p>
            <span>{t('net')}</span>
            <MoneyFigure paise={todayTotals.netPaise} />
          </p>
        </div>
        <h2>{t('thisMonth')}</h2>
        <div className="totals">
          <p>
            <span>{t('income')}</span>
            <MoneyFigure paise={monthTotals.incomePaise} />
          </p>
          <p>
            <span>{t('expense')}</span>
            <MoneyFigure paise={monthTotals.expensePaise} />
          </p>
          <p>
            <span>{t('net')}</span>
            <MoneyFigure paise={monthTotals.netPaise} />
          </p>
        </div>
      </section>
      <section className="daybook">
        <div className="section-head">
          <h2>{t('recent')}</h2>
          <button type="button" className="text-button" onClick={onLedger}>
            {t('openLedger')}
          </button>
        </div>
        <TxList rows={recent} locale={state.locale} empty={t('emptyHome')} />
      </section>
    </>
  )
}
