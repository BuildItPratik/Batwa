import { useState } from 'react'
import { topUp, ApiError } from '../api/agentApi.js'

const FAILURE_MESSAGES = {
  AGENT_FLOAT_INSUFFICIENT: "Agent's float balance is too low to cover this top-up.",
  NETWORK_ERROR: 'Could not reach the server. Check your connection.',
}

// TODO(Pratik): swap this text input for html5-qrcode camera scan once
// Krishna's scan component is available to share, per the blueprint's
// "scan customer ID" instruction for this screen. Manual entry stays as
// the fallback either way.

export default function TopUp() {
  const [agentId, setAgentId] = useState('AGT-001')
  const [cardId, setCardId] = useState('')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setResult(null)

    if (!cardId.trim()) {
      setError('Enter or scan the customer\'s card ID.')
      return
    }
    const numericAmount = Number(amount)
    if (!numericAmount || numericAmount <= 0) {
      setError('Enter a valid amount greater than 0.')
      return
    }

    setSubmitting(true)
    try {
      const data = await topUp({ agentId, cardId: cardId.trim(), amount: numericAmount })
      setResult(data)
      setCardId('')
      setAmount('')
    } catch (err) {
      if (err instanceof ApiError) {
        setError(FAILURE_MESSAGES[err.failureReason] || err.message)
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="screen">
      <h2>Top-Up Customer Wallet</h2>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="agentId">Agent ID</label>
          <input
            id="agentId"
            type="text"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
          />
          <p className="helper-text">Seeded test agents: AGT-001, AGT-002</p>
        </div>

        <div className="field">
          <label htmlFor="cardId">Customer Card ID</label>
          <input
            id="cardId"
            type="text"
            placeholder="CARD-XXXXXX"
            value={cardId}
            onChange={(e) => setCardId(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="field">
          <label htmlFor="amount">Cash Amount Received (₹)</label>
          <input
            id="amount"
            type="number"
            inputMode="numeric"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        {error && (
          <div className="result-card failure">
            <p className="result-title failure">✕ Top-Up Failed</p>
            <p>{error}</p>
          </div>
        )}

        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Processing…' : 'Confirm Top-Up'}
        </button>
      </form>

      {result && (
        <div className="result-card success">
          <p className="result-title success">✓ Top-Up Successful</p>
          <div className="result-row">
            <span>Transaction ID</span>
            <strong>{result.txn_id}</strong>
          </div>
          <div className="result-row">
            <span>New Customer Balance</span>
            <strong>₹{result.new_customer_balance}</strong>
          </div>
          <div className="result-row">
            <span>Agent Float Remaining</span>
            <strong>₹{result.agent_float_remaining}</strong>
          </div>
        </div>
      )}
    </div>
  )
}
