import { useState, type FormEvent } from 'react'
import { Moon, Sun } from 'lucide-react'
import { balanceOf, categories, draftParticular, inr, other, readPreviewQuery, sampleRows, shop, sum, t, text, todayLabel, type Kind, type Lang, type SampleRow, type ThemeName } from './sample'
import './entry-line.css'

export function EntryLine() {
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
    <div className="entry-line" data-theme={theme}>
      <aside className="line-side">
        <p className="line-app">Ledger AI</p>
        <h1>{text(lang, shop)}</h1>
        <nav aria-label={t(lang, 'home')}>
          <button type="button" aria-current={adding ? undefined : 'page'} onClick={() => setAdding(false)}>{t(lang, 'home')}</button>
          <button type="button" aria-current={adding ? 'page' : undefined} onClick={() => setAdding(true)}>{t(lang, 'newEntry')}</button>
        </nav>
        <div className="line-tools">
          <button type="button" aria-pressed={lang === 'gu'} onClick={() => setLang(lang === 'gu' ? 'en' : 'gu')}>
            {lang === 'gu' ? 'English' : 'ગુજરાતી'}
          </button>
          <button type="button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
            {theme === 'light' ? <Moon size={16} strokeWidth={1.75} aria-hidden /> : <Sun size={16} strokeWidth={1.75} aria-hidden />}
            {theme === 'light' ? t(lang, 'dark') : t(lang, 'light')}
          </button>
        </div>
      </aside>
      <main className="line-main">
        <p className="sr-only" role="status">{notice}</p>
        <div className="line-metrics" aria-label={t(lang, 'balance')}>
          <p><span>{t(lang, 'balance')}</span><strong>{inr(balanceOf(rows))}</strong></p>
          <p><span>{t(lang, 'todayIn')}</span><strong>{inr(sum(rows, 'in', 'today'))}</strong></p>
          <p><span>{t(lang, 'todayOut')}</span><strong>{inr(sum(rows, 'out', 'today'))}</strong></p>
          <p className="line-when">{text(lang, todayLabel)}</p>
          {adding ? null : (
            <button type="button" className="line-new" onClick={() => setAdding(true)}>{t(lang, 'newEntry')}</button>
          )}
        </div>
        {adding ? <LineWrite lang={lang} onCancel={() => setAdding(false)} onSave={save} /> : null}
        <div className="line-table" role="table" aria-label={t(lang, 'recent')}>
          <div className="line-head" role="row">
            <span role="columnheader">{t(lang, 'particular')}</span>
            <span role="columnheader">{t(lang, 'category')}</span>
            <span role="columnheader">{t(lang, 'kind')}</span>
            <span role="columnheader">{t(lang, 'amount')}</span>
          </div>
          {rows.map((row) => (
            <div className="line-row" role="row" key={row.id}>
              <span role="cell">
                <strong>{text(lang, row.particular)}</strong>
                <small>{other(lang, row.particular)}</small>
              </span>
              <span role="cell">{text(lang, row.category)}</span>
              <span role="cell">{row.kind === 'in' ? t(lang, 'inWord') : t(lang, 'outWord')}</span>
              <span role="cell" className="num">{inr(row.paise)}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

function LineWrite({ lang, onCancel, onSave }: { lang: Lang; onCancel: () => void; onSave: (row: SampleRow) => void }) {
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
    <form className="line-write" onSubmit={submit}>
      <label>
        <span className="sr-only">{t(lang, 'what')}</span>
        <input value={particular} onChange={(event) => setParticular(event.target.value)} required />
      </label>
      <label>
        <span className="sr-only">{t(lang, 'category')}</span>
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          {categories.map((item) => (
            <option value={item.en} key={item.en}>{text(lang, item)}</option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">{t(lang, 'jama')}</span>
        <select value={kind} onChange={(event) => setKind(event.target.value as Kind)}>
          <option value="in">{t(lang, 'inWord')}</option>
          <option value="out">{t(lang, 'outWord')}</option>
        </select>
      </label>
      <label>
        <span className="sr-only">{t(lang, 'amount')}</span>
        <input className="num" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} aria-invalid={error ? true : undefined} />
      </label>
      <button type="submit">{t(lang, 'save')}</button>
      <button type="button" onClick={onCancel}>{t(lang, 'cancel')}</button>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  )
}
