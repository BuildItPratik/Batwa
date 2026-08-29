// Single source of truth for talking to the backend.
// Field names here MUST match backend/models.py exactly. Card IDs and customer
// IDs are deliberately separate because cards can be reissued.
//
// If Harsh changes a shape again, this file is the only place that
// should need to change for the Agent Portal to keep working.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

class ApiError extends Error {
  failureReason: string | null
  status: number | null

  constructor(message: string, failureReason: string | null, status: number | null) {
    super(message)
    this.failureReason = failureReason // e.g. AGENT_FLOAT_INSUFFICIENT
    this.status = status
  }
}

// Response shapes — field names mirror backend/models.py exactly.

export interface RegisterResponse {
  customer_id: string
  card_id: string
  qr_code_base64: string
  status: string
}

export interface TopupResponse {
  status: string
  new_customer_balance?: number | null
  agent_float_remaining?: number | null
  txn_id?: string | null
  failure_reason?: string | null
}

export interface BlockResponse {
  status: string
  card_status: string
}

export interface ReissueResponse {
  customer_id: string
  new_card_id: string
  qr_code_base64: string
  balance_carried_over: number
}

export interface BalanceResponse {
  customer_id: string
  balance: number
  card_status: string
}

interface FailureBody {
  status?: string
  failure_reason?: string | null
  detail?: string
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (err) {
    throw new ApiError('Could not reach the server. Check your connection.', 'NETWORK_ERROR', null)
  }

  let data: T & FailureBody
  try {
    data = (await res.json()) as T & FailureBody
  } catch {
    throw new ApiError('Server sent back something unexpected.', 'BAD_RESPONSE', res.status)
  }

  if (!res.ok) {
    throw new ApiError(data?.detail || 'Request failed.', data?.failure_reason || null, res.status)
  }

  // Business-logic failures still come back as 200 with status: "FAILED"
  if (data.status === 'FAILED') {
    throw new ApiError(data.failure_reason || 'Request failed.', data.failure_reason || null, res.status)
  }

  return data
}

async function get<T>(path: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}${path}`)
  } catch {
    throw new ApiError('Could not reach the server. Check your connection.', 'NETWORK_ERROR', null)
  }
  const data = (await res.json()) as T & FailureBody
  if (!res.ok) {
    throw new ApiError(data?.detail || 'Request failed.', null, res.status)
  }
  return data
}

/**
 * Register a new customer.
 * Request:  { name, phone, pin, language_pref (en|hi|ta|mr) }
 * Response: { customer_id, card_id, qr_code_base64, status }
 *   (per Decision 1 — response now returns BOTH customer_id and card_id)
 */
export function registerCustomer({
  name,
  phone,
  pin,
  languagePref,
}: {
  name: string
  phone: string | null
  pin: string
  languagePref: string
}): Promise<RegisterResponse> {
  return post<RegisterResponse>('/customers/register', {
    name,
    phone,
    pin,
    language_pref: languagePref,
  })
}

/**
 * Top up a customer's wallet from the agent's float.
 * Request:  { agent_id, card_id, amount }
 * Response: { status, new_customer_balance, agent_float_remaining, txn_id }
 *   or on failure: { status: "FAILED", failure_reason: "AGENT_FLOAT_INSUFFICIENT" }
 */
export function topUp({
  agentId,
  cardId,
  amount,
}: {
  agentId: string
  cardId: string
  amount: number
}): Promise<TopupResponse> {
  return post<TopupResponse>('/wallet/topup', {
    agent_id: agentId,
    card_id: cardId,
    amount,
  })
}

/**
 * Block a card.
 * Request:  { card_id }
 * Response: { status, card_status }
 */
export function blockCard({ cardId }: { cardId: string }): Promise<BlockResponse> {
  return post<BlockResponse>('/cards/block', { card_id: cardId })
}

/**
 * Reissue cards for a customer.
 * All active cards belonging to the customer are blocked,
 * and a new card is created with the same customer's balance.
 *
 * Request:  { customer_id }
 * Response: { customer_id, new_card_id, qr_code_base64, balance_carried_over }
 */

export function reissueCard({ customerId }: { customerId: string }): Promise<ReissueResponse> {
  return post<ReissueResponse>('/cards/reissue', {
    customer_id: customerId,
  })
}
/**
 * Look up a customer's current balance.
 * Response: { customer_id, balance, card_status }
 *
 * CONFIRMED (from backend/routes/wallet.py): this endpoint takes CUSTOMER_ID,
 * not card_id — it queries the customers table directly and reports the
 * status of the customer's active card.
 */
export function getBalance(customerId: string): Promise<BalanceResponse> {
  return get<BalanceResponse>(`/wallet/balance/${encodeURIComponent(customerId)}`)
}

export { ApiError, API_BASE_URL }
