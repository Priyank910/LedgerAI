import { useEffect, useState } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { App } from '@capacitor/app'
import { UPDATE_CHECK_MS, shouldOfferUpdate } from '../domain/releaseVersion'
import { translate, type MessageKey } from '../i18n'
import { useBooks } from './books'

const LATER_KEY = 'ledger-ai-update-later'
const UPDATE_ORIGIN = 'https://ledger-ai.priyank-chavda.workers.dev'

type Offer = {
  version: string
  notes: string
  releaseUrl: string
  platform: 'windows' | 'android'
  install: (onProgress: (received: number, total: number) => void) => Promise<'permission' | 'installing'>
}

type AppUpdatePlugin = {
  install(options: { url: string }): Promise<{ status: 'installing' | 'permission' }>
  addListener(
    event: 'progress',
    handler: (event: { received: number; total: number }) => void,
  ): Promise<{ remove: () => Promise<void> }>
}

const AppUpdate = registerPlugin<AppUpdatePlugin>('AppUpdate')

function updateBase(): string {
  const configured = import.meta.env.VITE_API_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  if (import.meta.env.DEV) return ''
  return UPDATE_ORIGIN
}

function readLater(): { version: string; at: number } | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(LATER_KEY) ?? '')
    if (typeof parsed !== 'object' || parsed === null) return null
    const row = parsed as { version?: unknown; at?: unknown }
    if (typeof row.version !== 'string' || typeof row.at !== 'number') return null
    return { version: row.version, at: row.at }
  } catch {
    return null
  }
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function UpdatePrompt() {
  const { state } = useBooks()
  const [offer, setOffer] = useState<Offer | null>(null)
  const [phase, setPhase] = useState<'ask' | 'download' | 'permission' | 'failed'>('ask')
  const [progress, setProgress] = useState<{ received: number; total: number } | null>(null)
  const t = (key: MessageKey, vars?: Record<string, string | number>) => translate(state.locale, key, vars)

  useEffect(() => {
    let stopped = false
    const look = () => {
      void findOffer().then((next) => {
        if (!stopped && next) setOffer((current) => current ?? next)
      })
    }
    look()
    const timer = window.setInterval(look, UPDATE_CHECK_MS)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [])

  async function start() {
    if (!offer || phase === 'download') return
    setPhase('download')
    setProgress({ received: 0, total: 0 })
    try {
      const status = await offer.install((received, total) => setProgress({ received, total }))
      if (status === 'permission') setPhase('permission')
    } catch {
      setPhase('failed')
    }
  }

  function later() {
    if (offer) localStorage.setItem(LATER_KEY, JSON.stringify({ version: offer.version, at: Date.now() }))
    setOffer(null)
    setPhase('ask')
  }

  if (!offer) return null
  const percent = progress && progress.total > 0 ? Math.min(100, Math.round((progress.received / progress.total) * 100)) : null
  return (
    <div className="update-backdrop">
      <section className="update-card" role="dialog" aria-labelledby="update-title">
        <h2 id="update-title">{t('updateAvailable')}</h2>
        <p className="update-version">{t('updateVersion', { version: offer.version })}</p>
        {offer.notes ? (
          <>
            <h3>{t('updateNotes')}</h3>
            <p className="update-notes">{offer.notes}</p>
          </>
        ) : null}
        {offer.platform === 'android' ? <p className="help">{t('updateAndroidPermission')}</p> : null}
        {phase === 'failed' ? <p role="alert">{t('updateFailed')}</p> : null}
        {phase === 'download' ? (
          <div className="update-progress">
            <p>{percent === 100 ? t('updateInstalling') : t('updateDownloading')}</p>
            {percent != null ? (
              <div className="update-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                <span style={{ width: `${percent}%` }} />
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="row-2">
          <button type="button" className="primary" onClick={() => void start()} disabled={phase === 'download'}>
            {t('updateNow')}
          </button>
          <button type="button" className="ghost-ink" onClick={later} disabled={phase === 'download'}>
            {t('updateLater')}
          </button>
        </div>
        {phase === 'failed' ? (
          <button type="button" className="text-button" onClick={() => window.open(offer.releaseUrl, '_blank', 'noopener')}>
            {t('updateOpenRelease')}
          </button>
        ) : null}
      </section>
    </div>
  )
}

async function findOffer(): Promise<Offer | null> {
  const later = readLater()
  const now = Date.now()
  if (isTauri()) return windowsOffer(later, now)
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') return androidOffer(later, now)
  return null
}

async function windowsOffer(later: { version: string; at: number } | null, now: number): Promise<Offer | null> {
  const { check } = await import('@tauri-apps/plugin-updater')
  const update = await check()
  if (!update) return null
  if (!shouldOfferUpdate({ currentVersion: '0.0.0', latestVersion: update.version, laterVersion: later?.version ?? null, laterAt: later?.at ?? null, now })) {
    return null
  }
  return {
    version: update.version,
    notes: update.body ?? '',
    releaseUrl: `https://github.com/Priyank910/LedgerAI/releases/tag/v${update.version}`,
    platform: 'windows',
    install: async (onProgress) => {
      let received = 0
      let total = 0
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength ?? 0
          onProgress(0, total)
        } else if (event.event === 'Progress') {
          received += event.data.chunkLength
          onProgress(received, total)
        }
      })
      const { relaunch } = await import('@tauri-apps/plugin-process')
      await relaunch()
      return 'installing'
    },
  }
}

async function androidOffer(later: { version: string; at: number } | null, now: number): Promise<Offer | null> {
  const info = await App.getInfo()
  const response = await fetch(`${updateBase()}/app/latest?platform=android`)
  if (!response.ok) return null
  const body: unknown = await response.json()
  if (typeof body !== 'object' || body === null) return null
  const row = body as { version?: unknown; notes?: unknown; url?: unknown; releaseUrl?: unknown }
  if (typeof row.version !== 'string' || typeof row.url !== 'string') return null
  if (!shouldOfferUpdate({ currentVersion: info.version, latestVersion: row.version, laterVersion: later?.version ?? null, laterAt: later?.at ?? null, now })) {
    return null
  }
  const releaseUrl = typeof row.releaseUrl === 'string' ? row.releaseUrl : 'https://github.com/Priyank910/LedgerAI/releases'
  return {
    version: row.version,
    notes: typeof row.notes === 'string' ? row.notes : '',
    releaseUrl,
    platform: 'android',
    install: async (onProgress) => {
      const listener = await AppUpdate.addListener('progress', (event) => onProgress(event.received, event.total))
      try {
        return (await AppUpdate.install({ url: row.url as string })).status
      } finally {
        await listener.remove()
      }
    },
  }
}
