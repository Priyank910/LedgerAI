import { useState, type FormEvent } from 'react'
import { todayLocal } from '../../domain/dates'
import { importDailyLedger, ImportError } from '../../domain/importDailyLedger'
import { parseOpeningToPaise } from '../../domain/money'
import { translate, type MessageKey } from '../../i18n'
import type { Locale } from '../../domain/types'
import { useBooks } from '../books'

const locales: Locale[] = ['en', 'hi', 'gu']
const localeName: Record<Locale, string> = { en: 'English', hi: 'हिन्दी', gu: 'ગુજરાતી' }

export function WelcomeScreen() {
  const books = useBooks()
  const { state, dispatch, notify, signIn, signUp, syncStatus } = books
  const t = (key: MessageKey, vars?: Record<string, string | number>) => translate(state.locale, key, vars)
  const [shopName, setShopName] = useState('')
  const [opening, setOpening] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const now = () => new Date().toISOString()

  function start(event: FormEvent) {
    event.preventDefault()
    const openingBalancePaise = parseOpeningToPaise(opening)
    if (!shopName.trim() || openingBalancePaise === null) return
    dispatch({ type: 'start', shopName, openingBalancePaise, setupDate: todayLocal(), now: now() })
  }

  async function onImport(file: File | undefined) {
    if (!file) return
    try {
      const imported = importDailyLedger(await file.text())
      const agreed = window.confirm(t('replaceBooks', { shop: imported.shopName, count: imported.transactions.length }))
      if (!agreed) return
      dispatch({ type: 'import-daily', imported, now: now() })
      notify(t('imported'))
    } catch (error) {
      notify(error instanceof ImportError ? t('importFailed') : t('importFailed'))
    }
  }

  async function submitAuth(kind: 'in' | 'up') {
    const result = kind === 'in' ? await signIn(email, password) : await signUp(email, password)
    setAuthMessage(result ? t(result as MessageKey) : '')
  }

  return (
    <main className="welcome">
      <LanguageSwitch />
      <h1>{t('welcomeTitle')}</h1>
      <p className="lede">{t('welcomeBody')}</p>
      <form className="stack" onSubmit={start}>
        <label className="field">
          {t('shopName')}
          <input required value={shopName} onChange={(event) => setShopName(event.target.value)} />
        </label>
        <label className="field">
          {t('openingBalance')}
          <input required inputMode="decimal" value={opening} onChange={(event) => setOpening(event.target.value)} />
        </label>
        <p className="help">{t('openingHint')}</p>
        <button className="primary" type="submit">
          {t('start')}
        </button>
      </form>
      <button
        type="button"
        className="text-button"
        onClick={() => {
          if (!window.confirm(t('sampleHint'))) return
          dispatch({ type: 'use-demo', today: todayLocal(), now: now() })
        }}
      >
        {t('sample')}
      </button>
      <section className="block">
        <h2>{t('importTitle')}</h2>
        <p className="help">{t('importHelp')}</p>
        <label className="file">
          {t('importPick')}
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const input = event.currentTarget
              void onImport(input.files?.[0])
              input.value = ''
            }}
          />
        </label>
      </section>
      <section className="block">
        <h2>{t('accountTitle')}</h2>
        {syncStatus.kind === 'unconfigured' ? (
          <p className="help">{t('syncUnconfigured')}</p>
        ) : (
          <>
            <p className="help">{t('accountBody')}</p>
            <label className="field">
              {t('email')}
              <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className="field">
              {t('password')}
              <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <p className="help">{t('passwordHint')}</p>
            <div className="row-2">
              <button type="button" className="primary" onClick={() => void submitAuth('in')}>
                {t('signIn')}
              </button>
              <button type="button" className="ghost-ink" onClick={() => void submitAuth('up')}>
                {t('signUp')}
              </button>
            </div>
            {authMessage ? <p role="alert">{authMessage}</p> : null}
          </>
        )}
      </section>
    </main>
  )
}

export function LanguageSwitch() {
  const { state, dispatch } = useBooks()
  const t = (key: MessageKey) => translate(state.locale, key)
  return (
    <div className="lang" role="group" aria-label={t('language')}>
      {locales.map((locale) => (
        <button key={locale} type="button" aria-pressed={state.locale === locale} onClick={() => dispatch({ type: 'set-locale', locale })}>
          {localeName[locale]}
        </button>
      ))}
    </div>
  )
}
