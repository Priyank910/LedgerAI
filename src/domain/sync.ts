import { compareTime } from './dates'
import type { Profile, Transaction } from './types'

export type SyncBody = {
  profile: Profile | null
  transactions: Transaction[]
}

export interface SyncTransport {
  pull(): Promise<SyncBody>
  push(body: SyncBody): Promise<void>
}

type Stamp = { updatedAt: string }

/**
 * Last write wins by timestamp. Equal timestamps keep the remote copy so two
 * devices that both saw the same instant converge on the server's row.
 */
export function pickNewer<T extends Stamp>(local: T | undefined, remote: T | undefined): { record: T; source: 'local' | 'remote' } {
  if (local && !remote) return { record: local, source: 'local' }
  if (remote && !local) return { record: remote, source: 'remote' }
  if (!local || !remote) throw new Error('nothing-to-pick')
  const order = compareTime(local.updatedAt, remote.updatedAt)
  if (order > 0) return { record: local, source: 'local' }
  return { record: remote, source: 'remote' }
}

export function mergeLedgers(local: SyncBody, remote: SyncBody): {
  merged: SyncBody
  pushProfile: boolean
  pushTransactions: Transaction[]
} {
  let profile: Profile | null = null
  let pushProfile = false
  if (local.profile || remote.profile) {
    const picked = pickNewer(local.profile ?? undefined, remote.profile ?? undefined)
    profile = picked.record
    pushProfile = picked.source === 'local'
  }

  const localMap = new Map(local.transactions.map((row) => [row.id, row]))
  const remoteMap = new Map(remote.transactions.map((row) => [row.id, row]))
  const ids = new Set([...localMap.keys(), ...remoteMap.keys()])
  const transactions: Transaction[] = []
  const pushTransactions: Transaction[] = []
  for (const id of [...ids].sort()) {
    const picked = pickNewer(localMap.get(id), remoteMap.get(id))
    transactions.push(picked.record)
    if (picked.source === 'local') pushTransactions.push(picked.record)
  }
  return { merged: { profile, transactions }, pushProfile, pushTransactions }
}

export async function syncOnce(local: SyncBody, transport: SyncTransport): Promise<SyncBody> {
  const remote = await transport.pull()
  const plan = mergeLedgers(local, remote)
  if (plan.pushProfile || plan.pushTransactions.length > 0) {
    await transport.push({
      profile: plan.pushProfile ? plan.merged.profile : null,
      transactions: plan.pushTransactions,
    })
  }
  return plan.merged
}
