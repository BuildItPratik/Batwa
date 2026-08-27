import { useState } from 'react'
import { blockCard, reissueCard, ApiError } from '../api/agentApi.js'

export default function BlockReissue() {
  const [cardId, setCardId] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [confirmingBlock, setConfirmingBlock] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [blockResult, setBlockResult] = useState(null)
  const [reissueResult, setReissueResult] = useState(null)

  function resetResults() {
    setError(null)
    setBlockResult(null)
    setReissueResult(null)
  }

  async function handleBlock() {
    resetResults()

    if (!cardId.trim()) {
      setError('Enter the card ID to block.')
      return
    }

    setSubmitting(true)

    try {
      const data = await blockCard({
        cardId: cardId.trim(),
      })

      setBlockResult(data)
      setConfirmingBlock(false)
      setCardId('')
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Something went wrong.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReissue() {
    resetResults()

    if (!customerId.trim()) {
      setError('Enter the customer ID to reissue the card.')
      return
    }

    setSubmitting(true)

    try {
      const data = await reissueCard({
        customerId: customerId.trim(),
      })

      setReissueResult(data)
      setCustomerId('')
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Something went wrong.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="screen">
      <h2>Block or Reissue Card</h2>

      {/* BLOCK CARD */}
      <div className="field">
        <label htmlFor="manageCardId">Card ID</label>

        <input
          id="manageCardId"
          type="text"
          placeholder="CARD-XXXXXX"
          value={cardId}
          onChange={(e) => {
            setCardId(e.target.value)
            setConfirmingBlock(false)
          }}
          autoComplete="off"
        />
      </div>

      {error && (
        <div className="result-card failure">
          <p className="result-title failure">✕ Action Failed</p>
          <p>{error}</p>
        </div>
      )}

      {!confirmingBlock ? (
        <button
          className="btn btn-danger"
          type="button"
          onClick={() => {
            resetResults()

            if (!cardId.trim()) {
              setError('Enter the card ID to block.')
              return
            }

            setConfirmingBlock(true)
          }}
          disabled={submitting}
        >
          Block This Card
        </button>
      ) : (
        <div className="result-card failure">
          <p className="result-title failure">Confirm Block</p>

          <p>
            This will immediately stop this card from being used
            for payments. The customer's balance is not lost.
          </p>

          <button
            className="btn btn-danger"
            type="button"
            onClick={handleBlock}
            disabled={submitting}
          >
            {submitting ? 'Blocking…' : 'Yes, Block Card'}
          </button>

          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => setConfirmingBlock(false)}
            disabled={submitting}
          >
            Cancel
          </button>
        </div>
      )}

      {blockResult && (
        <div className="result-card success">
          <p className="result-title success">
            ✓ Card Blocked
          </p>

          <div className="result-row">
            <span>Card Status</span>
            <strong>{blockResult.card_status}</strong>
          </div>
        </div>
      )}

      {/* REISSUE CARD */}
      <div className="field">
        <label htmlFor="manageCustomerId">Customer ID</label>

        <input
          id="manageCustomerId"
          type="text"
          placeholder="CUST-XXXXXX"
          value={customerId}
          onChange={(e) => {
            setCustomerId(e.target.value)
          }}
          autoComplete="off"
        />
      </div>

      <button
        className="btn btn-secondary"
        type="button"
        onClick={handleReissue}
        disabled={submitting}
      >
        {submitting ? 'Processing…' : 'Reissue New Card'}
      </button>

      <p className="helper-text">
        Reissue blocks all active cards belonging to this customer
        and generates a new card. The customer's balance remains unchanged.
      </p>

      {reissueResult && (
        <div className="result-card success">
          <p className="result-title success">
            ✓ New Card Issued
          </p>

          <div className="result-row">
            <span>Customer ID</span>
            <strong>{reissueResult.customer_id}</strong>
          </div>

          <div className="result-row">
            <span>New Card ID</span>
            <strong>{reissueResult.new_card_id}</strong>
          </div>

          <div className="result-row">
            <span>Balance Carried Over</span>
            <strong>
              ₹{reissueResult.balance_carried_over}
            </strong>
          </div>

          {reissueResult.qr_code_base64 && (
            <div className="qr-box">
              <img
                src={`data:image/png;base64,${reissueResult.qr_code_base64}`}
                alt={`New QR card ${reissueResult.new_card_id}`}
              />

              <div className="qr-caption">
                {reissueResult.new_card_id}
              </div>

              <p className="helper-text">
                Print this new card and hand it to the customer.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}