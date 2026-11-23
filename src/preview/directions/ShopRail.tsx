import { useState, type FormEvent } from 'react'
import { Moon, Sun } from 'lucide-react'
import { balanceOf, categories, draftParticular, inr, other, readPreviewQuery, sampleRows, shop, sum, t, text, todayLabel, type Kind, type Lang, type SampleRow, type ThemeName } from './sample'
import './shop-rail.css'

export function ShopRail() {
  const initial = readPreviewQuery()
  const [lang, setLang] = useState<Lang>(initial.lang)
  const [theme, setTheme] = useState<ThemeName>(initial.theme)
  const [adding, setAdding] = useState(initial.view === 'add')
  const [rows, setRows] = useState<SampleRow[]>(sampleRows)
  const [notice, setNotice] = useState('')

  function save(row: SampleRow) {
    setRows((current) => [row, ...current])
    setAdding(false)
    setNotice(t(lang, 'saved'))
  }

  return (
    <div className="shop-rail" data-theme={theme}>
      <aside className="rail-nav">
        <p className="rail-app">Ledger AI</p>
        <h1>{text(lang, shop)}</h1>
        <nav aria-label={t(lang, 'home')}>
          <button type="button" aria-current={adding ? undefined : 'page'} onClick={() => setAdding(false)}>{t(lang, 'home')}</button>
          <button type="button" aria-current={adding ? 'page' : undefined} onClick={() => setAdding(true)}>{t(lang, 'newEntry')}</button>
        </nav>
        <div className="rail-tools">
          <div role="group" aria-label={t(lang, 'english')}>
            <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>English</button>
            <button type="button" aria-pressed={lang === 'gu'} onClick={() => setLang('gu')}>ગુજરાતી</button>
          </div>
          <button type="button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
            {theme === 'light' ? <Moon size={18} strokeWidth={1.75} aria-hidden /> : <Sun size={18} strokeWidth={1.75} aria-hidden />}
            {theme === 'light' ? t(lang, 'dark') : t(lang, 'light')}
          </button>
        </div>
      </aside>
      <main className="rail-main">
        <p className="sr-only" role="status">{notice}</p>
        <header className="rail-head">
          <div>
            <p className="rail-date">{text(lang, todayLabel)}</p>
            <h2>
              <span>{t(lang, 'balance')}</span>
              {inr(balanceOf(rows))}
            </h2>
            <p className="rail-today">
              {t(lang, 'todayIn')} {inr(sum(rows, 'in', 'today'))}
              <span aria-hidden> · </span>
              {t(lang, 'todayOut')} {inr(sum(rows, 'out', 'today'))}
            </p>
          </div>
          {adding ? null : (
            <button type="button" className="rail-add" onClick={() => setAdding(true)}>{t(lang, 'newEntry')}</button>
          )}
        </header>
        {adding ? <RailWrite lang={lang} onCancel={() => setAdding(false)} onSave={save} /> : null}
        <section className="rail-list" aria-label={t(lang, 'recent')}>
          <h3>{t(lang, 'recent')}</h3>
          <ul>
            {rows.map((row) => (
              <li key={row.id}>
                <span>
                  <strong>{text(lang, row.particular)}</strong>
                  <small>{other(lang, row.particular)} · {text(lang, row.category)}{row.day === 'earlier' ? ` · ${t(lang, 'earlier')}` : ''}</small>
                </span>
                <span className={row.kind === 'in' ? 'in' : 'out'}>
                  {row.kind === 'in' ? t(lang, 'inWord') : t(lang, 'outWord')} {inr(row.paise)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}

function RailWrite({ lang, onCancel, onSave }: { lang: Lang; onCancel: () => void; onSave: (row: SampleRow) => void }) {
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
    <form className="rail-write" onSubmit={submit}>
      <label>
        {t(lang, 'what')}
        <input value={particular} onChange={(event) => setParticular(event.target.value)} required />
      </label>
      <label>
        {t(lang, 'amount')}
        <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} aria-invalid={error ? true : undefined} />
      </label>
      <label>
        {t(lang, 'category')}
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          {categories.map((item) => (
            <option value={item.en} key={item.en}>{text(lang, item)}</option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>{t(lang, 'kind')}</legend>
        <button type="button" aria-pressed={kind === 'in'} onClick={() => setKind('in')}>{t(lang, 'inWord')}</button>
        <button type="button" aria-pressed={kind === 'out'} onClick={() => setKind('out')}>{t(lang, 'outWord')}</button>
      </fieldset>
      <div className="rail-write-actions">
        <button type="submit">{t(lang, 'save')}</button>
        <button type="button" onClick={onCancel}>{t(lang, 'cancel')}</button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  )
}
