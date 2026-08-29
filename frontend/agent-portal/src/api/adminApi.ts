// Admin dashboard data access (Ruchir).
// GET /transactions is the Section 6 contract endpoint; GET /admin/stats is an
// additive read-only endpoint — no existing API shapes changed.

import { API_BASE_URL } from '../config/runtime'

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

async function get<T>(path: string): Promise<T> {
  let response: Response
  try {
    response = await fetch(API_BASE_URL + path)
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

export function getTransactions(): Promise<TransactionsResponse> {
  return get<TransactionsResponse>('/transactions')
}

export function getAdminStats(): Promise<AdminStats> {
  return get<AdminStats>('/admin/stats')
}
