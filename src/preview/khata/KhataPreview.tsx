import { useState } from 'react'
import { balance, inPeriod, rows, rupees, shop } from '../data'
import { text, type Lang } from '../copy'
import './khata.css'

type Screen = 'home' | 'add' | 'ledger'
type Period = 'day' | 'month' | 'year' | 'range'

const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '00'] as const

export function KhataPreview() {
  const [lang, setLang] = useState<Lang>('en')
  const [screen, setScreen] = useState<Screen>('home')
  const [period, setPeriod] = useState<Period>('month')
  const [digits, setDigits] = useState('450')
  const [note, setNote] = useState('')
  const t = text(lang)
  const name = lang === 'gu' ? shop.gu : shop.en
  const shown = rows.filter((row) => (screen === 'home' ? row.scope !== 'older' : inPeriod(row, period)))
  const figure = balance(screen === 'home' ? rows : shown)

  function press(key: string) {
    setDigits((current) => (current + key).replace(/^0+(?=\d)/, '').slice(0, 9))
  }

  return (
    <div className={`khata ${screen === 'add' ? 'khata-add' : ''}`}>
      <div className="khata-book">
        <div className={`khata-spread ${screen === 'home' ? 'is-home' : ''}`}>
          <section className="khata-page" key={`${screen}-${period}`}>
            <div className="khata-head">
              <h1>{name}</h1>
              <button type="button" className="khata-lang" data-lang={lang === 'en' ? 'gu' : 'en'} onClick={() => setLang(lang === 'en' ? 'gu' : 'en')}>
                {t.lang}
              </button>
            </div>
            <nav className="khata-index">
              {(['home', 'ledger', 'add'] as const).map((item) => (
                <button key={item} type="button" data-goto={item} aria-current={screen === item ? 'page' : undefined} onClick={() => setScreen(item)}>
                  {t[item]}
                </button>
              ))}
            </nav>
            {screen === 'ledger' ? (
              <>
                <div className="khata-index" role="group">
                  {(['day', 'month', 'year', 'range'] as const).map((item) => (
                    <button key={item} type="button" data-period={item} aria-pressed={period === item} onClick={() => setPeriod(item)}>
                      {item === 'range' ? t.dates : item === 'day' ? t.day : t[item]}
                    </button>
                  ))}
                </div>
                {period === 'range' ? (
                  <div className="khata-dates">
                    <label>{t.from}<input type="date" defaultValue="2026-11-01" /></label>
                    <label>{t.to}<input type="date" defaultValue="2026-11-21" /></label>
                  </div>
                ) : null}
              </>
            ) : null}
            <table className="khata-table">
              <thead>
                <tr>
                  <th>{t.particular}</th>
                  <th className="num">{t.income}</th>
                  <th className="num">{t.expense}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{t.opening}</td>
                  <td className="num">{rupees(25000)}</td>
                  <td />
                </tr>
                {shown.map((row) => (
                  <tr key={row.id}>
                    <td>{lang === 'gu' ? row.gu : row.en}</td>
                    <td className="num">{row.type === 'income' ? rupees(row.rupees) : ''}</td>
                    <td className="num">{row.type === 'expense' ? rupees(row.rupees) : ''}</td>
                  </tr>
                ))}
                <tr className="close">
                  <td>{t.closing}</td>
                  <td className="num" colSpan={2}>{rupees(figure)}</td>
                </tr>
              </tbody>
            </table>
          </section>
          <aside className="khata-pad">
            <button type="button" data-goto="home" onClick={() => setScreen('home')}>{t.back}</button>
            <div className="khata-display">{rupees(Number(digits || '0'))}</div>
            <input className="khata-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder={t.description} aria-label={t.description} />
            <div className="khata-keys">
              {keys.map((key) => (
                <button key={key} type="button" onClick={() => press(key)}>{key}</button>
              ))}
              <button type="button" onClick={() => setDigits('')}>{t.clear}</button>
              <button type="button" className="income" onClick={() => setDigits(digits)}>{t.income}</button>
              <button type="button" className="expense" onClick={() => setDigits(digits)}>{t.expense}</button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
