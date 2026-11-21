import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { SyncBody, SyncTransport } from '../domain/sync'
import type { Profile, Transaction } from '../domain/types'

export function readSupabaseEnv(): { url: string; anonKey: string } | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!url || !anonKey) return null
  return { url, anonKey }
}

export function createSupabase(env: { url: string; anonKey: string }): SupabaseClient {
  return createClient(env.url, env.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
}

type ProfileRow = {
  user_id: string
  shop_name: string
  opening_balance_paise: number | string
  setup_date: string
  updated_at: string
  extra: Record<string, unknown> | null
}

type TransactionRow = {
  id: string
  user_id: string
  type: 'income' | 'expense'
  title: string
  amount_paise: number | string
  occurred_on: string
  payment: string
  note: string | null
  category: string
  updated_at: string
  deleted_at: string | null
  extra: Record<string, unknown> | null
}

function asPaise(value: number | string): number {
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isSafeInteger(amount)) throw new Error('amount')
  return amount
}

function asIso(value: string): string {
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? value : new Date(parsed).toISOString()
}

function profileFromRow(row: ProfileRow): Profile {
  return {
    shopName: row.shop_name,
    openingBalancePaise: asPaise(row.opening_balance_paise),
    setupDate: row.setup_date,
    updatedAt: asIso(row.updated_at),
    ...(row.extra ? { extra: row.extra } : {}),
  }
}

function transactionFromRow(row: TransactionRow): Transaction {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    amountPaise: asPaise(row.amount_paise),
    date: row.occurred_on,
    payment: row.payment,
    category: row.category,
    note: row.note ?? '',
    updatedAt: asIso(row.updated_at),
    deletedAt: row.deleted_at ? asIso(row.deleted_at) : null,
    ...(row.extra ? { extra: row.extra } : {}),
  }
}

export function createTransport(client: SupabaseClient, userId: string): SyncTransport {
  return {
    async pull() {
      const profileResult = await client.from('shop_profiles').select('*').maybeSingle()
      if (profileResult.error) throw new Error(profileResult.error.message)
      const txResult = await client.from('transactions').select('*').eq('user_id', userId)
      if (txResult.error) throw new Error(txResult.error.message)
      return {
        profile: profileResult.data ? profileFromRow(profileResult.data as ProfileRow) : null,
        transactions: ((txResult.data ?? []) as TransactionRow[]).map(transactionFromRow),
      }
    },
    async push(body) {
      if (body.profile) {
        const result = await client.from('shop_profiles').upsert({
          user_id: userId,
          shop_name: body.profile.shopName,
          opening_balance_paise: body.profile.openingBalancePaise,
          setup_date: body.profile.setupDate,
          updated_at: body.profile.updatedAt,
          extra: body.profile.extra ?? null,
        })
        if (result.error) throw new Error(result.error.message)
      }
      for (let index = 0; index < body.transactions.length; index += 200) {
        const chunk = body.transactions.slice(index, index + 200).map((row) => ({
          id: row.id,
          user_id: userId,
          type: row.type,
          title: row.title,
          amount_paise: row.amountPaise,
          occurred_on: row.date,
          payment: row.payment,
          note: row.note,
          category: row.category,
          updated_at: row.updatedAt,
          deleted_at: row.deletedAt,
          extra: row.extra ?? null,
        }))
        const result = await client.from('transactions').upsert(chunk, { onConflict: 'user_id,id' })
        if (result.error) throw new Error(result.error.message)
      }
    },
  }
}

export type { SyncBody }
