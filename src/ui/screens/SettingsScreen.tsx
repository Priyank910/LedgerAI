import { useState } from 'react'
import { BackupError, createBackup, parseBackup } from '../../domain/backup'
import { importDailyLedger, ImportError } from '../../domain/importDailyLedger'
import { parseOpeningToPaise } from '../../domain/money'
import { translate, type MessageKey } from '../../i18n'
import { saveOrShare } from '../../export/share'
import { useBooks, type SyncStatus } from '../books'
import { useUpdateCheck } from '../UpdatePrompt'
import { LanguageSwitch, ThemeSwitch } from './WelcomeScreen'

function syncText(status: SyncStatus, t: (key: MessageKey, vars?: Record<string, string | number>) => string): string {
  switch (status.kind) {
    case 'unconfigured':
      return t('syncUnconfigured')
    case 'signed-out':
      return t('syncSignedOut')
    case 'offline':
      return t('syncOffline')
    case 'syncing':
      return t('syncing')
    case 'synced':
      return t('synced', { time: status.at })
    case 'error':
      return t('syncError')
    default: {
      const neverStatus: never = status
      return neverStatus
    }
  }
}

export function SettingsScreen() {
  const books = useBooks()
  const updates = useUpdateCheck()
  const { state, dispatch, notify, email, syncStatus, signIn, signUp, signOut } = books
  const profile = state.profile
  const t = (key: MessageKey, vars?: Record<string, string | number>) => translate(state.locale, key, vars)
  const [shopName, setShopName] = useState(profile?.shopName ?? '')
  const [opening, setOpening] = useState(profile ? String(profile.openingBalancePaise / 100) : '')
  const [authEmail, setAuthEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  if (!profile) return null

  async function onImport(file: File | undefined) {
    if (!file) return
    try {
      const imported = importDailyLedger(await file.text())
      if (!window.confirm(t('replaceBooks', { shop: imported.shopName, count: imported.transactions.length }))) return
      dispatch({ type: 'import-daily', imported, now: new Date().toISOString() })
      notify(t('imported'))
    } catch (error) {
      notify(error instanceof ImportError ? t('importFailed') : t('importFailed'))
    }
  }

  async function onRestore(file: File | undefined) {
    if (!file) return
    try {
      const restored = parseBackup(await file.text())
      if (!window.confirm(t('replaceBooks', { shop: restored.profile.shopName, count: restored.transactions.length }))) return
      dispatch({ type: 'restore', ...restored, now: new Date().toISOString() })
      notify(t('restored'))
    } catch (error) {
      notify(error instanceof BackupError ? t('backupFailed') : t('backupFailed'))
    }
  }

  async function submitAuth(kind: 'in' | 'up') {
    const result = kind === 'in' ? await signIn(authEmail, password) : await signUp(authEmail, password)
    setAuthMessage(result ? t(result as MessageKey) : '')
  }

  return (
    <section className="page">
      <h1>{t('settings')}</h1>
      <LanguageSwitch />
      <ThemeSwitch />
      <section className="block">
        <h2>{t('checkUpdates')}</h2>
        <p className="status" role="status">
          {updates.currentVersion ? t('updateCurrent', { version: updates.currentVersion }) : t('updateChecking')}
          {updates.phase === 'current' ? ` ${t('updateUpToDate')}` : ''}
          {updates.phase === 'available' ? ` ${t('updateAvailable')}` : ''}
          {updates.phase === 'error' ? ` ${t('updateCheckFailed', { reason: updates.reason })}` : ''}
        </p>
        <button type="button" className="ghost-ink" onClick={() => void updates.checkNow()} disabled={updates.phase === 'checking'}>
          {updates.phase === 'checking' ? t('updateChecking') : t('checkUpdates')}
        </button>
      </section>
      <form
        className="block"
        onSubmit={(event) => {
          event.preventDefault()
          const openingBalancePaise = parseOpeningToPaise(opening)
          if (openingBalancePaise === null) return
          dispatch({ type: 'save-shop', shopName, openingBalancePaise, now: new Date().toISOString() })
          notify(t('saved'))
        }}
      >
        <h2>{t('shop')}</h2>
        <label className="field">
          {t('shopName')}
          <input value={shopName} onChange={(event) => setShopName(event.target.value)} required />
        </label>
        <label className="field">
          {t('openingBalance')}
          <input value={opening} inputMode="decimal" onChange={(event) => setOpening(event.target.value)} required />
        </label>
        <p className="help">{t('openingHint')}</p>
        <button className="primary" type="submit">
          {t('saveShop')}
        </button>
      </form>
      <section className="block">
        <h2>{t('accountTitle')}</h2>
        <p className="status" role="status">
          {syncText(syncStatus, t)}
        </p>
        {email ? <p>{t('signedInAs', { email })}</p> : null}
        {syncStatus.kind !== 'unconfigured' && !email ? (
          <>
            <label className="field">
              {t('email')}
              <input type="email" autoComplete="username" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} />
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
        ) : null}
        {email ? (
          <button type="button" className="ghost-ink" onClick={() => void signOut()}>
            {t('signOut')}
          </button>
        ) : null}
      </section>
      <section className="block">
        <h2>{t('backupTitle')}</h2>
        <p className="help">{t('backupHelp')}</p>
        <div className="row-2">
          <button
            type="button"
            className="ghost-ink"
            onClick={() => {
              const json = createBackup(state, new Date().toISOString())
              void saveOrShare(`ledger-ai-backup-${todayStamp()}.json`, new Blob([json], { type: 'application/json' })).then(
                () => notify(t('saved')),
                () => notify(t('exportFailed')),
              )
            }}
          >
            {t('exportBackup')}
          </button>
          <label className="file">
            {t('restoreBackup')}
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const input = event.currentTarget
                void onRestore(input.files?.[0])
                input.value = ''
              }}
            />
          </label>
        </div>
      </section>
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
    </section>
  )
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10)
}
