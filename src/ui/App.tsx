import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'
import { BarChart3, BookOpen, Home, MessageCircle, Settings } from 'lucide-react'
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
  const { state, notice, dispatch, notify } = useBooks()
  const [page, setPage] = useState<Page>(readPage)
  const [draft, setDraft] = useState<Draft | null>(null)
  const t = (key: 'home' | 'ledger' | 'insights' | 'ask' | 'settings') => translate(state.locale, key)

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

  return (
    <div className="shell">
      <nav className="rail" aria-label={t('home')}>
        {items.map(([id, Icon]) => (
          <button key={id} type="button" aria-current={page === id ? 'page' : undefined} onClick={() => go(id)}>
            <Icon />
            <span>{t(id)}</span>
          </button>
        ))}
      </nav>
      <div key={page} className="stage page-swap">
        <div className="tape" aria-hidden="true" />
        {page === 'home' ? <HomeScreen onDraft={setDraft} onLedger={() => go('ledger')} onAsk={ask} onDelete={remove} /> : null}
        {page === 'ledger' ? <LedgerScreen onAdd={add} onOpen={open} /> : null}
        {page === 'insights' ? <InsightsScreen /> : null}
        {page === 'ask' ? <AskScreen /> : null}
        {page === 'settings' ? <SettingsScreen /> : null}
      </div>
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
    </div>
  )
}

function Frame() {
  const { state } = useBooks()
  if (!state.profile) return <WelcomeScreen />
  return <Shell />
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
