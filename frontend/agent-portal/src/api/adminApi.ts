// Admin dashboard data access (Ruchir).
// GET /transactions is the Section 6 contract endpoint; GET /admin/stats is an
// additive read-only endpoint — no existing API shapes changed.

import { API_BASE_URL } from '../config/runtime'

const ADMIN_TOKEN_KEY = 'batwa.adminToken'

export class AdminApiError extends Error {
  status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'AdminApiError'
    this.status = status
  }
}

// Shapes mirror backend/models.py exactly.

export type TransactionType = 'TOPUP' | 'PAYMENT' | 'REISSUE' | 'BLOCK'
export type TransactionStatus = 'SUCCESS' | 'FAILED'

export interface TransactionItem {
  txn_id: string
  type: TransactionType
  amount: number | null
  status: TransactionStatus
  timestamp: string
  customer_id: string | null
  counterparty_id: string | null
  failure_reason: string | null
}

export interface TransactionsResponse {
  transactions: TransactionItem[]
}

export interface AdminStats {
  cash_digitized: number
  payments_received: number
  active_cards: number
  blocked_cards: number
  total_customers: number
  total_transactions: number
}

export interface IssuedCard {
  card_id: string
  customer_id: string
  customer_name: string | null
  phone: string | null
  status: 'active' | 'blocked' | string
  balance: number
  language_pref: string
  created_at: string | null
}

export interface IssuedCardsResponse {
  cards: IssuedCard[]
  total: number
  active_cards: number
  blocked_cards: number
}

// Shapes mirror backend/models.py (Analytics*) — the CSV artifacts published
// by the offline analytics pipeline (analytics/run.py all).

export interface AnalyticsKpis {
  cash_digitized: number
  payments_received: number
  txn_count: number
  success_count: number
  failed_count: number
  active_customers: number
  active_cards: number
  blocked_cards: number
  first_txn_date: string | null
  last_txn_date: string | null
}

export interface AnalyticsDailyVolumeRow {
  date_key: string
  type: TransactionType
  status: TransactionStatus
  txn_count: number
  amount_total: number
}

export interface AnalyticsFailureReasonRow {
  failure_reason: string | null
  attempts: number
  pct_of_failures: number
}

export interface AnalyticsTopMerchantRow {
  merchant_name: string
  payments: number
  total_received: number
}

export interface AnalyticsRunStatus {
  run_id: string
  source: string
  ran_at: string
  quality_checks: {
    passed: number
    total: number
    ok: boolean | null
  }
}

export interface AnalyticsResponse {
  kpis: AnalyticsKpis
  daily_volume: AnalyticsDailyVolumeRow[]
  failure_by_reason: AnalyticsFailureReasonRow[]
  top_merchants: AnalyticsTopMerchantRow[]
  run_status: AnalyticsRunStatus | null
}

async function get<T>(path: string, token?: string): Promise<T> {
  let response: Response
  try {
    response = await fetch(API_BASE_URL + path, {
      headers: adminHeaders(token),
    })
  } catch {
    throw new AdminApiError('Could not reach the server.')
  }
  let data: T & { detail?: string }
  try {
    data = (await response.json()) as T & { detail?: string }
  } catch {
    throw new AdminApiError('The server sent an unexpected response.', response.status)
  }
  if (!response.ok) {
    throw new AdminApiError(data?.detail || 'Request failed.', response.status)
  }
  return data
}

function adminHeaders(token?: string): Record<string, string> {
  const accessToken = token || getAdminToken()
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

export function getAdminToken(): string | null {
  try {
    return window.sessionStorage.getItem(ADMIN_TOKEN_KEY)
  } catch {
    return null
  }
}

export function clearAdminToken() {
  try {
    window.sessionStorage.removeItem(ADMIN_TOKEN_KEY)
  } catch {
    // Embedded previews may deny session storage.
  }
}

export async function authenticateAdmin(pin: string): Promise<string> {
  let response: Response
  try {
    response = await fetch(API_BASE_URL + '/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    })
  } catch {
    throw new AdminApiError('Could not reach the server.')
  }

  let data: { access_token?: string; detail?: string }
  try {
    data = (await response.json()) as { access_token?: string; detail?: string }
  } catch {
    throw new AdminApiError('The server sent an unexpected response.', response.status)
  }
  if (!response.ok || !data.access_token) {
    throw new AdminApiError(data.detail || 'Admin authentication failed.', response.status)
  }

  try {
    window.sessionStorage.setItem(ADMIN_TOKEN_KEY, data.access_token)
  } catch {
    // The current session can still use the token from memory if storage is unavailable.
  }
  return data.access_token
}

export function getTransactions(token?: string): Promise<TransactionsResponse> {
  return get<TransactionsResponse>('/transactions', token)
}

export function getAdminStats(token?: string): Promise<AdminStats> {
  return get<AdminStats>('/admin/stats', token)
}

export function getIssuedCards(params?: { status?: 'active' | 'blocked' }, token?: string): Promise<IssuedCardsResponse> {
  const qs = params?.status ? `?status=${params.status}` : ''
  return get<IssuedCardsResponse>(`/admin/cards${qs}`, token)
}

export function getAnalytics(token?: string): Promise<AnalyticsResponse> {
  return get<AnalyticsResponse>('/admin/analytics', token)
}
