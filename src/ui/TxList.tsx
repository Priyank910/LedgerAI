import { useRef, useState } from 'react'
import { formatDay, categoryLabel, paymentLabel, translate } from '../i18n'
import { formatInr } from '../domain/money'
import type { Locale, Transaction } from '../domain/types'

export function TxList({
  rows,
  locale,
  empty,
  onOpen,
  onDelete,
}: {
  rows: Transaction[]
  locale: Locale
  empty: string
  onOpen?: (row: Transaction) => void
  onDelete?: (row: Transaction) => void
}) {
  if (rows.length === 0) return <p className="empty">{empty}</p>
  return (
    <div className="list">
      {rows.map((row) => (
        <TxRow key={row.id} row={row} locale={locale} {...(onOpen ? { onOpen } : {})} {...(onDelete ? { onDelete } : {})} />
      ))}
    </div>
  )
}

function TxRow({
  row,
  locale,
  onOpen,
  onDelete,
}: {
  row: Transaction
  locale: Locale
  onOpen?: (row: Transaction) => void
  onDelete?: (row: Transaction) => void
}) {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const startX = useRef(0)
  const startAt = useRef(0)
  const moved = useRef(false)
  const skipClick = useRef(false)
  const when = formatDay(row.date, locale)
  const edit = translate(locale, 'edit')
  const remove = translate(locale, 'delete')
  const yes = translate(locale, 'yesDelete')

  function reveal(next: boolean) {
    setOpen(next)
    if (!next) setConfirm(false)
  }

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

  return (
    <div className={`swipe${open ? ' open' : ''}`}>
      {onOpen || onDelete ? (
        <div className="swipe-actions">
          {onOpen ? (
            <button type="button" className="ghost-ink" onClick={() => onOpen(row)}>
              {edit}
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              className="danger"
              onClick={() => {
                if (!confirm) {
                  setConfirm(true)
                  return
                }
                onDelete(row)
              }}
            >
              {confirm ? yes : remove}
            </button>
          ) : null}
        </div>
      ) : null}
      {onOpen ? (
        <button
          type="button"
          className="entry"
          aria-label={`${edit} ${row.title}`}
          onPointerDown={(event) => {
            startX.current = event.clientX
            startAt.current = Date.now()
            moved.current = false
          }}
          onPointerMove={(event) => {
            if (Math.abs(event.clientX - startX.current) > 12) moved.current = true
          }}
          onPointerUp={(event) => {
            const dx = event.clientX - startX.current
            const held = Date.now() - startAt.current > 500
            if (dx < -56 || held) {
              skipClick.current = true
              reveal(true)
            } else if (dx > 56) {
              skipClick.current = true
              reveal(false)
            }
          }}
          onContextMenu={(event) => {
            event.preventDefault()
            reveal(true)
          }}
          onClick={() => {
            if (moved.current || skipClick.current) {
              skipClick.current = false
              return
            }
            onOpen(row)
          }}
        >
          {body}
        </button>
      ) : (
        <div className="entry">{body}</div>
      )}
    </div>
  )
}
