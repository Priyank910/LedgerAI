import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { CATEGORY_IDS, PAYMENT_IDS, type EntryInput, type Transaction, type TxType } from '../domain/types'
import { defaultCategory } from '../domain/ledger'
import { parseRupeesToPaise } from '../domain/money'
import { todayLocal } from '../domain/dates'
import { categoryLabel, paymentLabel, translate, type MessageKey } from '../i18n'
import { useBooks } from './books'

export type Draft = {
  mode: 'add' | 'edit'
  id?: string
  type: TxType
  title: string
  amount: string
  date: string
  payment: string
  category: string
  note: string
}

export function draftPreset(input: { type: TxType; title: string; category: string; payment: string }): Draft {
  return {
    mode: 'add',
    type: input.type,
    title: input.title,
    amount: '',
    date: todayLocal(),
    payment: input.payment,
    category: input.category,
    note: '',
  }
}

export function draftFrom(type: TxType, row?: Transaction): Draft {
  if (!row) {
    return { mode: 'add', type, title: '', amount: '', date: todayLocal(), payment: 'cash', category: defaultCategory(type), note: '' }
  }
  const rupees = row.amountPaise / 100
  return {
    mode: 'edit',
    id: row.id,
    type: row.type,
    title: row.title,
    amount: rupees.toFixed(2).replace(/\.00$/, ''),
    date: row.date,
    payment: row.payment,
    category: row.category,
    note: row.note,
  }
}

export function EntrySheet({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const { state, dispatch, notify } = useBooks()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [form, setForm] = useState(draft)
  const [error, setError] = useState<MessageKey | ''>('')
  const [confirming, setConfirming] = useState(false)
  const t = (key: MessageKey, vars?: Record<string, string | number>) => translate(state.locale, key, vars)

  useEffect(() => {
    const node = dialog.current
    if (!node) return
    if (!node.open) node.showModal()
    return () => {
      if (node.open) node.close()
    }
  }, [])

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function save(event: FormEvent) {
    event.preventDefault()
    if (!form.title.trim()) {
      setError('required')
      return
    }
    const amountPaise = parseRupeesToPaise(form.amount)
    if (!amountPaise) {
      setError('invalidAmount')
      return
    }
    const entry: EntryInput = {
      type: form.type,
      title: form.title,
      amountPaise,
      date: form.date,
      payment: form.payment,
      category: form.category,
      note: form.note,
    }
    const now = new Date().toISOString()
    if (form.mode === 'edit' && form.id) dispatch({ type: 'update', id: form.id, entry, now })
    else dispatch({ type: 'add', entry, id: crypto.randomUUID(), now })
    notify(t('saved'))
    onClose()
  }

  function remove() {
    if (!form.id) return
    dispatch({ type: 'remove', id: form.id, now: new Date().toISOString() })
    notify(t('deleted'))
    onClose()
  }

  const payments = PAYMENT_IDS.includes(form.payment as (typeof PAYMENT_IDS)[number]) ? PAYMENT_IDS : [form.payment, ...PAYMENT_IDS]
  const categories = CATEGORY_IDS.includes(form.category as (typeof CATEGORY_IDS)[number]) ? CATEGORY_IDS : [form.category, ...CATEGORY_IDS]
  const heading = form.mode === 'edit' ? (form.type === 'income' ? 'editIncome' : 'editExpense') : form.type === 'income' ? 'addIncome' : 'addExpense'

  return (
    <dialog className="sheet" ref={dialog} aria-labelledby={titleId} onClose={onClose}>
      <form className="sheet-form" onSubmit={save}>
        <div className="sheet-head">
          <h2 id={titleId}>{t(heading)}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t('close')}>
            <X />
          </button>
        </div>
        <label className="field">
          {t('amount')}
          <input inputMode="decimal" autoFocus value={form.amount} onChange={(event) => set('amount', event.target.value)} className="amount-input" />
        </label>
        <label className="field">
          {t('description')}
          <input value={form.title} onChange={(event) => set('title', event.target.value)} />
        </label>
        <div className="row-2">
          <label className="field">
            {t('date')}
            <input type="date" required value={form.date} onChange={(event) => set('date', event.target.value)} />
          </label>
          <label className="field">
            {t('payment')}
            <select value={form.payment} onChange={(event) => set('payment', event.target.value)}>
              {payments.map((payment) => (
                <option key={payment} value={payment}>
                  {paymentLabel(state.locale, payment)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          {t('category')}
          <select value={form.category} onChange={(event) => set('category', event.target.value)}>
            {categories.map((category) => (
              <option key={category} value={category}>
                {categoryLabel(state.locale, category)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {t('note')}
          <input value={form.note} onChange={(event) => set('note', event.target.value)} />
        </label>
        {error ? <p role="alert">{t(error)}</p> : null}
        <button className="primary" type="submit">
          {t('save')}
        </button>
        {form.mode === 'edit' && !confirming ? (
          <button type="button" className="danger" onClick={() => setConfirming(true)}>
            {t('delete')}
          </button>
        ) : null}
        {confirming ? (
          <div className="confirm">
            <p>{t('confirmDelete')}</p>
            <button type="button" className="danger" onClick={remove}>
              {t('yesDelete')}
            </button>
            <button type="button" className="ghost-ink" onClick={() => setConfirming(false)}>
              {t('cancel')}
            </button>
          </div>
        ) : null}
      </form>
    </dialog>
  )
}
