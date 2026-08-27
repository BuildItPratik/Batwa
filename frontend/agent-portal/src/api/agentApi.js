// Single source of truth for talking to the backend.
// Field names here MUST match backend/models.py exactly — see MEMORY.md
// "Architecture Decisions Log > Decision 1" for why card_id != customer_id.
//
// If Harsh changes a shape again, this file is the only place that
// should need to change for the Agent Portal to keep working.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

class ApiError extends Error {
  constructor(message, failureReason, status) {
    super(message)
    this.failureReason = failureReason // e.g. AGENT_FLOAT_INSUFFICIENT
    this.status = status
  }
}

async function post(path, body) {
  let res
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (err) {
    throw new ApiError('Could not reach the server. Check your connection.', 'NETWORK_ERROR', null)
  }

  let data
  try {
    data = await res.json()
  } catch (err) {
    throw new ApiError('Server sent back something unexpected.', 'BAD_RESPONSE', res.status)
  }

  if (!res.ok) {
    throw new ApiError(data?.detail || 'Request failed.', data?.failure_reason || null, res.status)
  }

  // Business-logic failures still come back as 200 with status: "FAILED"
  if (data.status === 'FAILED') {
    throw new ApiError(data.failure_reason || 'Request failed.', data.failure_reason, res.status)
  }

  return data
}

async function get(path) {
  let res
  try {
    res = await fetch(`${API_BASE_URL}${path}`)
  } catch (err) {
    throw new ApiError('Could not reach the server. Check your connection.', 'NETWORK_ERROR', null)
  }
  const data = await res.json()
  if (!res.ok) {
    throw new ApiError(data?.detail || 'Request failed.', null, res.status)
  }
  return data
}

/**
 * Register a new customer.
 * Request:  { name, phone, pin, language_pref }
 * Response: { customer_id, card_id, qr_code_base64, status }
 *   (per Decision 1 — response now returns BOTH customer_id and card_id)
 */
export function registerCustomer({ name, phone, pin, languagePref }) {
  return post('/customers/register', {
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
export function topUp({ agentId, cardId, amount }) {
  return post('/wallet/topup', {
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
export function blockCard({ cardId }) {
  return post('/cards/block', { card_id: cardId })
}

/**
 * Reissue cards for a customer.
 * All active cards belonging to the customer are blocked,
 * and a new card is created with the same customer's balance.
 *
 * Request:  { customer_id }
 * Response: { customer_id, new_card_id, qr_code_base64, balance_carried_over }
 */

export function reissueCard({ customerId }) {
  return post('/cards/reissue', {
    customer_id: customerId,
  })
}
/**
 * Look up a customer/card's current balance.
 * Response: { customer_id, balance, status }
 *
 * ⚠️ UNCONFIRMED: the blueprint's original path is /wallet/balance/{customer_id}.
 * Decision 1 in MEMORY.md didn't explicitly say whether this endpoint was
 * repointed to take card_id instead. This function currently sends whatever
 * id you pass it under the `id` param name below — confirm with Harsh which
 * one the live endpoint actually expects before relying on this in a demo.
 */
export function getBalance(id) {
  return get(`/wallet/balance/${encodeURIComponent(id)}`)
}

export { ApiError, API_BASE_URL }
