import { formatDay, categoryLabel, paymentLabel } from '../i18n'
import { formatInr } from '../domain/money'
import type { Locale, Transaction } from '../domain/types'

export function TxList({
  rows,
  locale,
  empty,
  onOpen,
}: {
  rows: Transaction[]
  locale: Locale
  empty: string
  onOpen?: (row: Transaction) => void
}) {
  if (rows.length === 0) return <p className="empty">{empty}</p>
  return (
    <div className="list">
      {rows.map((row) => {
        const when = formatDay(row.date, locale)
        const body = (
          <>
            <span className="entry-date">
              <span className="entry-day">{when.day}</span>
              <span className="entry-month">{when.month}</span>
            </span>
            <span className="entry-copy">
              <span className="entry-title">{row.title}</span>
              <span className="entry-meta">
                {categoryLabel(locale, row.category)} · {paymentLabel(locale, row.payment)}
              </span>
            </span>
            <span className={`entry-amt ${row.type}`}>{formatInr(row.amountPaise)}</span>
          </>
        )
        if (!onOpen) {
          return (
            <div className="entry" key={row.id}>
              {body}
            </div>
          )
        }
        return (
          <button type="button" className="entry" key={row.id} onClick={() => onOpen(row)}>
            {body}
          </button>
        )
      })}
    </div>
  )
}
