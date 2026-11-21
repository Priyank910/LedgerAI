import { useState } from 'react'
import { balance, inPeriod, rows, rupees, shop, totals, type PreviewRow } from '../data'
import { text, type Lang } from '../copy'
import './receipt.css'

type Screen = 'home' | 'add' | 'ledger'
type Period = 'day' | 'month' | 'year' | 'range'

export function ReceiptPreview() {
  const [lang, setLang] = useState<Lang>('en')
  const [screen, setScreen] = useState<Screen>('home')
  const [period, setPeriod] = useState<Period>('month')
  const [kind, setKind] = useState<'income' | 'expense'>('income')
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('450')
  const t = text(lang)
  const name = lang === 'gu' ? shop.gu : shop.en
  const shown = rows.filter((row) => inPeriod(row, period))
  const homeRows = rows.filter((row) => row.scope === 'today' || row.scope === 'month').slice(0, 5)
  const sum = totals(period === 'day' ? rows.filter((row) => row.scope === 'today') : shown)
  const figure = period === 'day' ? balance(rows.filter((row) => row.scope === 'today')) : balance(rows)

  return (
    <div className="slip">
      <article className="slip-sheet">
        <div className="slip-top">
          <h1>{name}</h1>
          <button type="button" className="slip-lang" data-lang={lang === 'en' ? 'gu' : 'en'} onClick={() => setLang(lang === 'en' ? 'gu' : 'en')}>
            {t.lang}
          </button>
        </div>
        <hr className="slip-rule" />
        <nav className="slip-nav">
          {(['home', 'ledger', 'add'] as const).map((item) => (
            <button key={item} type="button" data-goto={item} aria-current={screen === item ? 'page' : undefined} onClick={() => setScreen(item)}>
              {t[item]}
            </button>
          ))}
        </nav>
        <div className="slip-view" key={screen}>
          {screen === 'home' ? (
            <div className="slip-home">
              <div>
                {homeRows.map((row) => (
                  <Line key={row.id} row={row} lang={lang} />
                ))}
              </div>
              <div className="slip-total">
                <em>{t.balance}</em>
                <strong>{rupees(figure)}</strong>
              </div>
            </div>
          ) : null}
          {screen === 'add' ? (
            <form className="slip-form" onSubmit={(event) => event.preventDefault()}>
              <label>
                {t.amount}
                <input className="slip-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
              </label>
              <label>
                {t.description}
                <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={lang === 'gu' ? 'શર્ટ સિલાઈ' : 'Shirt stitching'} />
              </label>
              <div className="slip-pair">
                <button type="button" aria-pressed={kind === 'income'} onClick={() => setKind('income')}>{t.income}</button>
                <button type="button" aria-pressed={kind === 'expense'} onClick={() => setKind('expense')}>{t.expense}</button>
              </div>
              <button className="slip-save" type="submit">{t.write}</button>
            </form>
          ) : null}
          {screen === 'ledger' ? (
            <>
              <div className="slip-filters" role="group">
                {(['day', 'month', 'year', 'range'] as const).map((item) => (
                  <button key={item} type="button" data-period={item} aria-pressed={period === item} onClick={() => setPeriod(item)}>
                    {t[item === 'range' ? 'dates' : item === 'day' ? 'day' : item]}
                  </button>
                ))}
              </div>
              {period === 'range' ? (
                <div className="slip-dates">
                  <label>{t.from}<input type="date" defaultValue="2026-11-01" /></label>
                  <label>{t.to}<input type="date" defaultValue="2026-11-21" /></label>
                </div>
              ) : null}
              <p>{t.income} {rupees(sum.income)} · {t.expense} {rupees(sum.expense)}</p>
              {shown.map((row) => (
                <Line key={row.id} row={row} lang={lang} />
              ))}
            </>
          ) : null}
        </div>
      </article>
    </div>
  )
}

function Line({ row, lang }: { row: PreviewRow; lang: Lang }) {
  const title = lang === 'gu' ? row.gu : row.en
  const cat = lang === 'gu' ? row.catGu : row.catEn
  return (
    <div className="slip-line">
      <div>
        {title}
        <span>{cat}</span>
      </div>
      <b>{row.type === 'expense' ? `−${rupees(row.rupees)}` : rupees(row.rupees)}</b>
    </div>
  )
}
