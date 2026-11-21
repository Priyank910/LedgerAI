import type { Profile, Transaction, TxType } from '../src/domain/types'
import type { AuthStore, LedgerStore, SessionUser } from './store'

type Statement = {
  bind(...values: unknown[]): {
    first<T>(): Promise<T | null>
    all<T>(): Promise<{ results?: T[] }>
    run(): Promise<{ meta?: { changes?: number } }>
  }
}

export interface D1Like {
  prepare(sql: string): Statement
}

type UserRow = { id: string; email: string; password_hash: string; created_at: string }
type SessionRow = { id: string; email: string }
type ProfileRow = {
  shop_name: string
  opening_balance_paise: number
  setup_date: string
  updated_at: string
  extra: string | null
}
type TxRow = {
  id: string
  type: TxType
  title: string
  amount_paise: number
  occurred_on: string
  payment: string
  note: string
  category: string
  updated_at: string
  deleted_at: string | null
  extra: string | null
}

function parseExtra(value: string | null): Record<string, unknown> | undefined {
  if (!value) return undefined
  const parsed: unknown = JSON.parse(value)
  if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) return parsed as Record<string, unknown>
  return undefined
}

function profileFrom(row: ProfileRow): Profile {
  const extra = parseExtra(row.extra)
  return {
    shopName: row.shop_name,
    openingBalancePaise: row.opening_balance_paise,
    setupDate: row.setup_date,
    updatedAt: row.updated_at,
    ...(extra ? { extra } : {}),
  }
}

function transactionFrom(row: TxRow): Transaction {
  const extra = parseExtra(row.extra)
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    amountPaise: row.amount_paise,
    date: row.occurred_on,
    payment: row.payment,
    note: row.note,
    category: row.category,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    ...(extra ? { extra } : {}),
  }
}

export class D1Auth implements AuthStore {
  constructor(private readonly db: D1Like) {}

  async findUserByEmail(email: string) {
    const row = await this.db.prepare('SELECT id, email, password_hash, created_at FROM users WHERE email = ?').bind(email).first<UserRow>()
    return row ? { id: row.id, email: row.email, passwordHash: row.password_hash } : null
  }

  async insertUser(user: { id: string; email: string; passwordHash: string; createdAt: string }) {
    await this.db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)').bind(user.id, user.email, user.passwordHash, user.createdAt).run()
  }

  async insertSession(session: { tokenHash: string; userId: string; expiresAt: string }) {
    await this.db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(session.tokenHash, session.userId, session.expiresAt).run()
  }

  async findSession(tokenHash: string, nowIso: string): Promise<SessionUser | null> {
    const row = await this.db
      .prepare(
        `SELECT users.id AS id, users.email AS email
         FROM sessions JOIN users ON users.id = sessions.user_id
         WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
      )
      .bind(tokenHash, nowIso)
      .first<SessionRow>()
    return row ?? null
  }

  async deleteSession(tokenHash: string) {
    await this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run()
  }
}

export class D1Ledger implements LedgerStore {
  constructor(private readonly db: D1Like) {}

  async getProfile(userId: string) {
    const row = await this.db
      .prepare('SELECT shop_name, opening_balance_paise, setup_date, updated_at, extra FROM shop_profiles WHERE user_id = ?')
      .bind(userId)
      .first<ProfileRow>()
    return row ? profileFrom(row) : null
  }

  async listTransactions(userId: string, since: string | null) {
    const query = since
      ? this.db
          .prepare(
            `SELECT id, type, title, amount_paise, occurred_on, payment, note, category, updated_at, deleted_at, extra
             FROM transactions WHERE user_id = ? AND updated_at > ? ORDER BY updated_at`,
          )
          .bind(userId, since)
      : this.db
          .prepare(
            `SELECT id, type, title, amount_paise, occurred_on, payment, note, category, updated_at, deleted_at, extra
             FROM transactions WHERE user_id = ? ORDER BY updated_at`,
          )
          .bind(userId)
    const result = await query.all<TxRow>()
    return (result.results ?? []).map(transactionFrom)
  }

  async saveProfile(userId: string, profile: Profile) {
    const result = await this.db
      .prepare(
        `INSERT INTO shop_profiles (user_id, shop_name, opening_balance_paise, setup_date, updated_at, extra)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           shop_name = excluded.shop_name,
           opening_balance_paise = excluded.opening_balance_paise,
           setup_date = excluded.setup_date,
           updated_at = excluded.updated_at,
           extra = excluded.extra
         WHERE excluded.updated_at > shop_profiles.updated_at`,
      )
      .bind(userId, profile.shopName, profile.openingBalancePaise, profile.setupDate, profile.updatedAt, profile.extra ? JSON.stringify(profile.extra) : null)
      .run()
    return (result.meta?.changes ?? 0) > 0
  }

  async saveTransactions(userId: string, rows: Transaction[]) {
    let written = 0
    for (const row of rows) {
      const result = await this.db
        .prepare(
          `INSERT INTO transactions (user_id, id, type, title, amount_paise, occurred_on, payment, note, category, updated_at, deleted_at, extra)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id, id) DO UPDATE SET
             type = excluded.type,
             title = excluded.title,
             amount_paise = excluded.amount_paise,
             occurred_on = excluded.occurred_on,
             payment = excluded.payment,
             note = excluded.note,
             category = excluded.category,
             updated_at = excluded.updated_at,
             deleted_at = excluded.deleted_at,
             extra = excluded.extra
           WHERE excluded.updated_at > transactions.updated_at`,
        )
        .bind(
          userId,
          row.id,
          row.type,
          row.title,
          row.amountPaise,
          row.date,
          row.payment,
          row.note,
          row.category,
          row.updatedAt,
          row.deletedAt,
          row.extra ? JSON.stringify(row.extra) : null,
        )
        .run()
      if ((result.meta?.changes ?? 0) > 0) written += 1
    }
    return written
  }
}
