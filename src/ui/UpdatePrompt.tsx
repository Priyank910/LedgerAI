import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { App } from '@capacitor/app'
import { registerPlugin } from '@capacitor/core'
import { FOREGROUND_CHECK_MS } from '../domain/appUpdate'
import { UPDATE_CHECK_MS } from '../domain/releaseVersion'
import { translate, type MessageKey } from '../i18n'
import { useBooks } from './books'
import { checkForUpdate, isTauri, nativePlatform, type CheckResult, type LaterMark } from './updateClient'

const LATER_KEY = 'ledger-ai-update-later'

type AppUpdatePlugin = {
  install(options: { url: string }): Promise<{ status: 'installing' | 'permission' }>
  addListener(event: 'progress', handler: (event: { received: number; total: number }) => void): Promise<{ remove: () => Promise<void> }>
}

const AppUpdate = registerPlugin<AppUpdatePlugin>('AppUpdate')

type Offer = {
  version: string
  notes: string
  releaseUrl: string
  platform: 'windows' | 'android'
  install: (onProgress: (received: number, total: number) => void) => Promise<'permission' | 'installing'>
}

type UpdateApi = {
  currentVersion: string
  phase: 'idle' | 'checking' | 'current' | 'available' | 'error' | 'browser'
  reason: string
  checkNow: () => Promise<void>
}

const UpdateContext = createContext<UpdateApi | null>(null)

export function useUpdateCheck(): UpdateApi {
  const value = useContext(UpdateContext)
  if (!value) throw new Error('update')
  return value
}

function readLater(): LaterMark | null {
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

export function UpdateGate({ children }: { children: ReactNode }) {
  const { state } = useBooks()
  const [offer, setOffer] = useState<Offer | null>(null)
  const [phase, setPhase] = useState<'ask' | 'download' | 'permission' | 'failed'>('ask')
  const [progress, setProgress] = useState<{ received: number; total: number } | null>(null)
  const [currentVersion, setCurrentVersion] = useState('')
  const [status, setStatus] = useState<UpdateApi['phase']>('idle')
  const [reason, setReason] = useState('')
  const lastAuto = useRef(0)
  const t = (key: MessageKey, vars?: Record<string, string | number>) => translate(state.locale, key, vars)

  async function look(manual: boolean) {
    if (manual) setStatus('checking')
    let result: CheckResult
    try {
      result = await checkForUpdate({ manual, later: readLater() })
    } catch (error) {
      console.error('[ledger-ai update]', error)
      const message = error instanceof Error ? error.message : 'The update check failed.'
      setCurrentVersion('')
      setReason(message)
      setStatus('error')
      return
    }
    setCurrentVersion(result.currentVersion)
    if (result.status === 'browser') {
      setReason('')
      setStatus('browser')
      return
    }
    if (result.status === 'error') {
      setReason(result.reason)
      setStatus('error')
      return
    }
    if (result.status === 'current') {
      setReason('')
      setStatus('current')
      return
    }
    setReason('')
    setStatus('available')
    if (!result.quiet) setOffer((current) => current ?? offerFrom(result))
  }

  useEffect(() => {
    const run = (manual: boolean) => {
      if (!manual) {
        const now = Date.now()
        if (lastAuto.current !== 0 && now - lastAuto.current < FOREGROUND_CHECK_MS) return
        lastAuto.current = now
      }
      void look(manual).catch((error: unknown) => console.error('[ledger-ai update]', error))
    }
    run(false)
    const onVisible = () => {
      if (document.visibilityState === 'visible') run(false)
    }
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(() => run(false), UPDATE_CHECK_MS)
    let removeNative: (() => void) | undefined
    if (nativePlatform() === 'android') {
      void App.addListener('appStateChange', (next) => {
        if (next.isActive) run(false)
      }).then((handle) => {
        removeNative = () => void handle.remove()
      }).catch((error: unknown) => console.error('[ledger-ai update] resume listener', error))
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
      removeNative?.()
    }
  }, [])

  async function start() {
    if (!offer || phase === 'download') return
    setPhase('download')
    setProgress({ received: 0, total: 0 })
    try {
      const status = await offer.install((received, total) => setProgress({ received, total }))
      if (status === 'permission') setPhase('permission')
    } catch (error) {
      console.error('[ledger-ai update] install', error)
      setPhase('failed')
    }
  }

  function later() {
    if (offer) localStorage.setItem(LATER_KEY, JSON.stringify({ version: offer.version, at: Date.now() }))
    setOffer(null)
    setPhase('ask')
  }

  const api: UpdateApi = { currentVersion, phase: status, reason, checkNow: () => look(true) }
  const percent = progress && progress.total > 0 ? Math.min(100, Math.round((progress.received / progress.total) * 100)) : null

  return (
    <UpdateContext.Provider value={api}>
      {children}
      {offer ? (
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
      ) : null}
    </UpdateContext.Provider>
  )
}

function offerFrom(result: Extract<CheckResult, { status: 'available' }>): Offer {
  return {
    version: result.release.version,
    notes: result.release.notes,
    releaseUrl: result.release.releaseUrl,
    platform: result.platform,
    install: (onProgress) => (result.platform === 'windows' ? installWindows(onProgress) : installAndroid(result.release.downloadUrl, onProgress)),
  }
}

async function installWindows(onProgress: (received: number, total: number) => void): Promise<'installing'> {
  if (!isTauri()) throw new Error('Windows updates install inside the desktop app.')
  const { check } = await import('@tauri-apps/plugin-updater')
  const update = await check()
  if (!update) throw new Error('The desktop updater did not confirm a newer version.')
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
}

async function installAndroid(url: string, onProgress: (received: number, total: number) => void): Promise<'permission' | 'installing'> {
  const listener = await AppUpdate.addListener('progress', (event) => onProgress(event.received, event.total))
  try {
    return (await AppUpdate.install({ url })).status
  } finally {
    await listener.remove()
  }
}
