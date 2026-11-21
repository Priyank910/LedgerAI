import type { Profile, Transaction } from '../src/domain/types'
import { acceptServerWrite } from './rules'

export type SessionUser = { id: string; email: string }

export interface AuthStore {
  findUserByEmail(email: string): Promise<{ id: string; email: string; passwordHash: string } | null>
  insertUser(user: { id: string; email: string; passwordHash: string; createdAt: string }): Promise<void>
  insertSession(session: { tokenHash: string; userId: string; expiresAt: string }): Promise<void>
  findSession(tokenHash: string, nowIso: string): Promise<SessionUser | null>
  deleteSession(tokenHash: string): Promise<void>
}

export interface LedgerStore {
  getProfile(userId: string): Promise<Profile | null>
  listTransactions(userId: string, since: string | null): Promise<Transaction[]>
  saveProfile(userId: string, profile: Profile): Promise<boolean>
  saveTransactions(userId: string, rows: Transaction[]): Promise<number>
}

export class MemoryAuth implements AuthStore {
  users: { id: string; email: string; passwordHash: string; createdAt: string }[] = []
  sessions: { tokenHash: string; userId: string; expiresAt: string }[] = []

  async findUserByEmail(email: string) {
    return this.users.find((user) => user.email === email) ?? null
  }

  async insertUser(user: { id: string; email: string; passwordHash: string; createdAt: string }) {
    this.users.push(user)
  }

  async insertSession(session: { tokenHash: string; userId: string; expiresAt: string }) {
    this.sessions.push(session)
  }

  async findSession(tokenHash: string, nowIso: string) {
    const session = this.sessions.find((row) => row.tokenHash === tokenHash && row.expiresAt > nowIso)
    if (!session) return null
    const user = this.users.find((row) => row.id === session.userId)
    return user ? { id: user.id, email: user.email } : null
  }

  async deleteSession(tokenHash: string) {
    this.sessions = this.sessions.filter((row) => row.tokenHash !== tokenHash)
  }
}

export class MemoryLedger implements LedgerStore {
  profiles = new Map<string, Profile>()
  transactions = new Map<string, Transaction[]>()

  async getProfile(userId: string) {
    return this.profiles.get(userId) ?? null
  }

  async listTransactions(userId: string, since: string | null) {
    const rows = this.transactions.get(userId) ?? []
    if (!since) return rows
    return rows.filter((row) => row.updatedAt > since)
  }

  async saveProfile(userId: string, profile: Profile) {
    const existing = this.profiles.get(userId) ?? null
    if (!acceptServerWrite(existing?.updatedAt ?? null, profile.updatedAt)) return false
    this.profiles.set(userId, profile)
    return true
  }

  async saveTransactions(userId: string, rows: Transaction[]) {
    const current = this.transactions.get(userId) ?? []
    let written = 0
    for (const row of rows) {
      const index = current.findIndex((item) => item.id === row.id)
      const existing = index >= 0 ? current[index] : undefined
      if (!acceptServerWrite(existing?.updatedAt ?? null, row.updatedAt)) continue
      if (index >= 0) current[index] = row
      else current.push(row)
      written += 1
    }
    this.transactions.set(userId, current)
    return written
  }
}
