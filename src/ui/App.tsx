import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'
import { BarChart3, BookOpen, CircleHelp, Home, LogOut, MessageCircle, Search, Settings } from 'lucide-react'
import { translate } from '../i18n'
import type { Transaction, TxType } from '../domain/types'
import { BooksProvider, useBooks } from './books'
import { draftFrom, EntrySheet, type Draft } from './EntrySheet'
import { AskScreen } from './screens/AskScreen'
import { HomeScreen } from './screens/HomeScreen'
import { InsightsScreen } from './screens/InsightsScreen'
import { LedgerScreen } from './screens/LedgerScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { WelcomeScreen } from './screens/WelcomeScreen'
import { UpdatePrompt } from './UpdatePrompt'

type Page = 'home' | 'ledger' | 'insights' | 'ask' | 'settings'

function readPage(): Page {
  const name = location.hash.replace(/^#\/?/, '')
  if (name === 'ledger' || name === 'insights' || name === 'ask' || name === 'settings') return name
  return 'home'
}

class BooksBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="welcome">
          <h1>Ledger AI</h1>
          <p>{translate('en', 'crash')}</p>
          <p>{translate('gu', 'crash')}</p>
        </main>
      )
    }
    return this.props.children
  }
}

function Shell() {
  const { state, notice, dispatch, notify, email, signOut, syncStatus } = useBooks()
  const [page, setPage] = useState<Page>(readPage)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [query, setQuery] = useState('')
  const [help, setHelp] = useState(false)
  const t = (key: 'home' | 'ledger' | 'insights' | 'ask' | 'settings') => translate(state.locale, key)
  const label = (key: 'menuLabel' | 'generalLabel' | 'helpLabel' | 'helpBody' | 'signOut' | 'searchEntries' | 'getAndroid' | 'getWindows' | 'signInToSync' | 'addIncome') => translate(state.locale, key)

  useEffect(() => {
    const onHash = () => setPage(readPage())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  function go(next: Page) {
    location.hash = next === 'home' ? '#/' : `#/${next}`
    setPage(next)
  }

  function add(type: TxType) {
    setDraft(draftFrom(type))
  }

  function open(row: Transaction) {
    setDraft(draftFrom(row.type, row))
  }

  function ask(question: string) {
    sessionStorage.setItem('ledger-ai-pending-ask', question)
    go('ask')
  }

  function remove(row: Transaction) {
    dispatch({ type: 'remove', id: row.id, now: new Date().toISOString() })
    notify(translate(state.locale, 'deleted'))
  }

  const items = [
    ['home', Home],
    ['ledger', BookOpen],
    ['insights', BarChart3],
    ['ask', MessageCircle],
    ['settings', Settings],
  ] as const
  const todayCount = state.transactions.filter((row) => !row.deletedAt && row.date === new Date().toISOString().slice(0, 10)).length

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        document.getElementById('entry-search')?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="shell">
      <nav className="rail" aria-label={label('menuLabel')}>
        <p className="rail-logo">Ledger AI</p>
        <p className="rail-label">{label('menuLabel')}</p>
        {items.slice(0, 4).map(([id, Icon]) => (
          <button key={id} type="button" aria-current={page === id ? 'page' : undefined} onClick={() => go(id)}>
            <Icon size={18} />
            <span>{t(id)}</span>
            {id === 'ledger' ? <span className="rail-count">{todayCount}</span> : null}
          </button>
        ))}
        <p className="rail-label">{label('generalLabel')}</p>
        <button type="button" aria-current={page === 'settings' ? 'page' : undefined} onClick={() => go('settings')}>
          <Settings size={18} />
          <span>{t('settings')}</span>
        </button>
        <button type="button" onClick={() => setHelp(true)}>
          <CircleHelp size={18} />
          <span>{label('helpLabel')}</span>
        </button>
        <button type="button" onClick={() => void signOut()}>
          <LogOut size={18} />
          <span>{label('signOut')}</span>
        </button>
        <div className="rail-promo">
          <a className="promo-desk" href="https://github.com/Priyank910/LedgerAI/releases/latest">{label('getAndroid')}</a>
          <a className="promo-phone" href="https://github.com/Priyank910/LedgerAI/releases/latest">{label('getWindows')}</a>
        </div>
      </nav>
      <div className="desk-main">
      <header className="topbar">
        <form className="top-search" onSubmit={(event) => { event.preventDefault(); sessionStorage.setItem('ledger-ai-search', query); go('ledger') }}>
          <Search size={16} aria-hidden />
          <label className="sr-only" htmlFor="entry-search">{label('searchEntries')}</label>
          <input id="entry-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={label('searchEntries')} />
          <kbd>Ctrl K</kbd>
        </form>
        <p className="icon-btn" role="status" title={syncStatus.kind}>{syncStatus.kind === 'synced' ? '●' : '○'}</p>
        <button type="button" className="who" onClick={() => go('settings')}>
          <span className="avatar">{(state.profile?.shopName ?? 'L').slice(0, 1)}</span>
          <span>
            <strong>{state.profile?.shopName}</strong>
            <small>{email ?? label('signInToSync')}</small>
          </span>
        </button>
      </header>
      <div key={page} className="stage page-swap">
        {page === 'home' ? <HomeScreen onDraft={setDraft} onLedger={() => go('ledger')} onAsk={ask} onDelete={remove} /> : null}
        {page === 'ledger' ? <LedgerScreen onAdd={add} onOpen={open} /> : null}
        {page === 'insights' ? <InsightsScreen /> : null}
        {page === 'ask' ? <AskScreen /> : null}
        {page === 'settings' ? <SettingsScreen /> : null}
      </div>
      </div>
      <button type="button" className="sticky-add" onClick={() => add('income')}>{label('addIncome')}</button>
      <nav className="tabbar" aria-label={t('home')}>
        {items.map(([id, Icon]) => (
          <button key={id} type="button" aria-current={page === id ? 'page' : undefined} onClick={() => go(id)}>
            <Icon />
            <span>{t(id)}</span>
          </button>
        ))}
      </nav>
      {draft ? <EntrySheet key={`${draft.mode}-${draft.id ?? draft.type}`} draft={draft} onClose={() => setDraft(null)} /> : null}
      {notice ? <p className="toast" role="status">{notice}</p> : null}
      {help ? (
        <div className="help-card" role="presentation" onClick={() => setHelp(false)}>
          <section role="dialog" aria-labelledby="help-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="help-title">{label('helpLabel')}</h2>
            <p>{label('helpBody')}</p>
            <button type="button" className="primary" onClick={() => setHelp(false)}>{translate(state.locale, 'close')}</button>
          </section>
        </div>
      ) : null}
    </div>
  )
}

function Frame() {
  const { state } = useBooks()
  return (
    <>
      {state.profile ? <Shell /> : <WelcomeScreen />}
      <UpdatePrompt />
    </>
  )
}

export function App() {
  return (
    <BooksBoundary>
      <BooksProvider>
        <Frame />
      </BooksProvider>
    </BooksBoundary>
  )
}
