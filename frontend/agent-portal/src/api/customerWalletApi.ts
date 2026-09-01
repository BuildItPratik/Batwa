import { API_BASE_URL } from '../config/runtime'

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

export interface BalanceResponse {
  customer_id: string
  balance: number
  card_status: string
}

export class CustomerWalletApiError extends Error {
  status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'CustomerWalletApiError'
    this.status = status
  }
}

async function get<T>(path: string): Promise<T> {
  let response: Response

  try {
    response = await fetch(API_BASE_URL + path)
  } catch {
    throw new CustomerWalletApiError(
      'Could not reach the server. Check your connection.'
    )
  }

  let data: T & { detail?: string }

  try {
    data = (await response.json()) as T & { detail?: string }
  } catch {
    throw new CustomerWalletApiError(
      'The server sent an unexpected response.',
      response.status
    )
  }

  if (!response.ok) {
    throw new CustomerWalletApiError(
      data?.detail || 'Request failed.',
      response.status
    )
  }

  return data
}

export function getCustomerBalance(
  customerId: string,
): Promise<BalanceResponse> {
  return get<BalanceResponse>(
    `/wallet/balance/${encodeURIComponent(customerId)}`,
  )
}

export function getCustomerTransactions(
  customerId: string,
): Promise<TransactionsResponse> {
  return get<TransactionsResponse>(
    `/transactions?customer_id=${encodeURIComponent(customerId)}`,
  )
}