import { useState, type FormEvent } from 'react'
import { Moon, Sun } from 'lucide-react'
import { balanceOf, categories, draftParticular, inr, other, readPreviewQuery, sampleRows, shop, sum, t, text, todayLabel, type Kind, type Lang, type SampleRow, type ThemeName } from './sample'
import './open-khata.css'

export function OpenKhata() {
  const initial = readPreviewQuery()
  const [lang, setLang] = useState<Lang>(initial.lang)
  const [theme, setTheme] = useState<ThemeName>(initial.theme)
  const [adding, setAdding] = useState(initial.view === 'add')
  const [rows, setRows] = useState<SampleRow[]>(sampleRows)
  const [notice, setNotice] = useState('')
  const balance = balanceOf(rows)
  const todayIn = sum(rows, 'in', 'today')
  const todayOut = sum(rows, 'out', 'today')

  function save(row: SampleRow) {
    setRows((current) => [row, ...current])
    setAdding(false)
    setNotice(t(lang, 'saved'))
  }

  return (
    <div className="open-khata" data-theme={theme}>
      <aside className="khata-spine">
        <p className="khata-mark">Ledger AI</p>
        <h1>{text(lang, shop)}</h1>
        <p className="khata-date">{text(lang, todayLabel)}</p>
        <nav className="khata-nav" aria-label={t(lang, 'home')}>
          <button type="button" aria-current={adding ? undefined : 'page'} onClick={() => setAdding(false)}>
            {t(lang, 'home')}
          </button>
          <button type="button" aria-current={adding ? 'page' : undefined} onClick={() => setAdding(true)}>
            {t(lang, 'newEntry')}
          </button>
        </nav>
        <div className="khata-tools">
          <div className="khata-switch" role="group" aria-label={t(lang, 'english')}>
            <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>{t(lang, 'english')}</button>
            <button type="button" aria-pressed={lang === 'gu'} onClick={() => setLang('gu')}>{t(lang, 'gujarati')}</button>
          </div>
          <button type="button" className="khata-theme" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
            {theme === 'light' ? <Moon size={18} strokeWidth={1.75} aria-hidden /> : <Sun size={18} strokeWidth={1.75} aria-hidden />}
            {theme === 'light' ? t(lang, 'dark') : t(lang, 'light')}
          </button>
        </div>
      </aside>
      <main className="khata-page">
        <p className="sr-only" role="status">{notice}</p>
        <div className="khata-close">
          <p>{t(lang, 'balance')}</p>
          <strong>{inr(balance)}</strong>
        </div>
        <p className="khata-today">
          <span>{t(lang, 'todayIn')} {inr(todayIn)}</span>
          <span>{t(lang, 'todayOut')} {inr(todayOut)}</span>
        </p>
        <div className="khata-sheet" role="table" aria-label={t(lang, 'recent')}>
          <div className="khata-head" role="row">
            <span role="columnheader">{t(lang, 'particular')}</span>
            <span role="columnheader">{t(lang, 'jama')}</span>
            <span role="columnheader">{t(lang, 'kharch')}</span>
          </div>
          {adding ? <KhataWrite lang={lang} onCancel={() => setAdding(false)} onSave={save} /> : null}
          {rows.map((row) => (
            <div className="khata-row" role="row" key={row.id}>
              <span role="cell">
                <strong>{text(lang, row.particular)}</strong>
                <small>{other(lang, row.particular)} · {text(lang, row.category)}</small>
              </span>
              <span role="cell" className="num">{row.kind === 'in' ? inr(row.paise) : ''}</span>
              <span role="cell" className="num">{row.kind === 'out' ? inr(row.paise) : ''}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

function KhataWrite({ lang, onCancel, onSave }: { lang: Lang; onCancel: () => void; onSave: (row: SampleRow) => void }) {
  const [particular, setParticular] = useState(text(lang, draftParticular))
  const [amount, setAmount] = useState('600')
  const [kind, setKind] = useState<Kind>('in')
  const [category, setCategory] = useState(categories[0].en)
  const [error, setError] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    const rupees = Number(amount)
    if (!Number.isFinite(rupees) || rupees <= 0) {
      setError(t(lang, 'needAmount'))
      return
    }
    const chosen = categories.find((item) => item.en === category) ?? categories[0]
    onSave({
      id: `new-${Date.now()}`,
      particular: { en: particular, gu: particular },
      category: chosen,
      kind,
      paise: Math.round(rupees * 100),
      day: 'today',
    })
  }

  return (
    <form className="khata-write" onSubmit={submit}>
      <label>
        <span className="sr-only">{t(lang, 'what')}</span>
        <input value={particular} onChange={(event) => setParticular(event.target.value)} required />
      </label>
      <label>
        <span className="sr-only">{t(lang, 'amount')}</span>
        <input className="num" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} aria-invalid={error ? true : undefined} />
      </label>
      <div className="khata-write-actions">
        <select value={kind} onChange={(event) => setKind(event.target.value as Kind)} aria-label={t(lang, 'jama')}>
          <option value="in">{t(lang, 'jama')}</option>
          <option value="out">{t(lang, 'kharch')}</option>
        </select>
        <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label={t(lang, 'category')}>
          {categories.map((item) => (
            <option value={item.en} key={item.en}>{text(lang, item)}</option>
          ))}
        </select>
        <button type="submit">{t(lang, 'save')}</button>
        <button type="button" onClick={onCancel}>{t(lang, 'cancel')}</button>
      </div>
      {error ? <p className="khata-error" role="alert">{error}</p> : null}
    </form>
  )
}
