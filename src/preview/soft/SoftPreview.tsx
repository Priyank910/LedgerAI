import { useState } from 'react'
import { balance, inPeriod, rows, rupees, shop, totals } from '../data'
import { text, type Lang } from '../copy'
import './soft.css'

type Screen = 'home' | 'add' | 'ledger'
type Period = 'day' | 'month' | 'year' | 'range'

export function SoftPreview() {
  const [lang, setLang] = useState<Lang>('en')
  const [screen, setScreen] = useState<Screen>('home')
  const [period, setPeriod] = useState<Period>('month')
  const [kind, setKind] = useState<'income' | 'expense'>('income')
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const t = text(lang)
  const name = lang === 'gu' ? shop.gu : shop.en
  const monthRows = rows.filter((row) => row.scope !== 'older')
  const shown = rows.filter((row) => inPeriod(row, period))
  const sum = totals(shown)

  return (
    <div className="till">
      <div className="till-page">
        <div className="till-bar">
          <nav className="till-nav">
            {(['home', 'ledger', 'add'] as const).map((item) => (
              <button key={item} type="button" data-goto={item} aria-current={screen === item ? 'page' : undefined} onClick={() => setScreen(item)}>
                {t[item]}
              </button>
            ))}
          </nav>
          <button type="button" className="till-lang" data-lang={lang === 'en' ? 'gu' : 'en'} onClick={() => setLang(lang === 'en' ? 'gu' : 'en')}>
            {t.lang}
          </button>
        </div>
        <div className="till-view" key={`${screen}-${lang}`}>
          {screen === 'home' ? (
            <>
              <h1>{name}</h1>
              <div className="till-home">
                <div className="till-balance">
                  <span>{t.balance}</span>
                  <strong>{rupees(balance(rows))}</strong>
                </div>
                <div className="till-split">
                  <div className="till-tile">
                    <span>{t.income}</span>
                    <b>{rupees(totals(monthRows).income)}</b>
                  </div>
                  <div className="till-tile">
                    <span>{t.expense}</span>
                    <b>{rupees(totals(monthRows).expense)}</b>
                  </div>
                </div>
                <div className="till-list">
                  {monthRows.slice(0, 4).map((row) => (
                    <div className="till-row" key={row.id}>
                      <div>
                        {lang === 'gu' ? row.gu : row.en}
                        <small>{lang === 'gu' ? row.catGu : row.catEn}</small>
                      </div>
                      <b className={row.type}>{rupees(row.rupees)}</b>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
          {screen === 'add' ? (
            <form className="till-form" onSubmit={(event) => event.preventDefault()}>
              <h1>{t.add}</h1>
              <label>
                {t.amount}
                <input className="till-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" />
              </label>
              <label>
                {t.description}
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={lang === 'gu' ? 'શર્ટ સિલાઈ' : 'Shirt stitching'} />
              </label>
              <div className="till-pair">
                <button type="button" aria-pressed={kind === 'income'} onClick={() => setKind('income')}>{t.income}</button>
                <button type="button" aria-pressed={kind === 'expense'} onClick={() => setKind('expense')}>{t.expense}</button>
              </div>
              <button className="till-save" type="submit">{t.save}</button>
            </form>
          ) : null}
          {screen === 'ledger' ? (
            <div className="till-filters">
              <h1>{t.ledger}</h1>
              <div className="till-chiprow" role="group">
                {(['day', 'month', 'year', 'range'] as const).map((item) => (
                  <button key={item} type="button" data-period={item} aria-pressed={period === item} onClick={() => setPeriod(item)}>
                    {item === 'range' ? t.dates : item === 'day' ? t.day : t[item]}
                  </button>
                ))}
              </div>
              {period === 'range' ? (
                <div className="till-dates">
                  <label>{t.from}<input type="date" defaultValue="2026-11-01" /></label>
                  <label>{t.to}<input type="date" defaultValue="2026-11-21" /></label>
                </div>
              ) : null}
              <div className="till-split">
                <div className="till-tile"><span>{t.income}</span><b>{rupees(sum.income)}</b></div>
                <div className="till-tile"><span>{t.expense}</span><b>{rupees(sum.expense)}</b></div>
              </div>
              {shown.map((row) => (
                <div className="till-row" key={row.id}>
                  <div>
                    {lang === 'gu' ? row.gu : row.en}
                    <small>{lang === 'gu' ? row.catGu : row.catEn}</small>
                  </div>
                  <b className={row.type}>{rupees(row.rupees)}</b>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
