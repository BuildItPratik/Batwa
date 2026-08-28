import { useState } from 'react'
import { topUp, ApiError } from '../api/agentApi.js'
import QrScanner from '../components/qr/QrScanner.jsx'
import { Button, FormField, PortalFrame, StatusPanel } from '../components/ui/index.js'
import { isCardId, normalizeCardId } from '../merchant/merchantFlow.js'
import { DEMO_MODE, getConfiguredAgent } from '../config/runtime.js'
import { DEMO_CARD_ID } from '../config/merchantDemo.js'
import Icon from '../components/ui/Icon.jsx'

const FAILURE_MESSAGES = {
  AGENT_FLOAT_INSUFFICIENT: "The agent’s float balance is too low to cover this top-up.",
  NETWORK_ERROR: 'Could not reach the server. Check your connection.',
}

export default function TopUp() {
  const agent = getConfiguredAgent()
  const [agentId, setAgentId] = useState(agent.id)
  const [cardId, setCardId] = useState('')
  const [amount, setAmount] = useState('')
  const [cardMode, setCardMode] = useState('choice')
  const [reviewing, setReviewing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  function handleCardValue(value) { setCardId(normalizeCardId(value)); setCardMode('choice') }
  function validate() {
    if (!cardId.trim() || !isCardId(cardId)) return 'Enter or scan a supported customer card ID.'
    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return 'Enter a valid amount greater than ₹0.'
    return null
  }
  function beginReview(event) { event.preventDefault(); setError(null); const message = validate(); if (message) { setError(message); return }; setReviewing(true) }
  async function handleSubmit() {
    setError(null); const message = validate(); if (message) { setError(message); return }
    setSubmitting(true)
    try {
      const data = await topUp({ agentId: agentId.trim(), cardId: normalizeCardId(cardId), amount: Number(amount) })
      setResult(data); setCardId(''); setAmount(''); setReviewing(false)
    } catch (err) { setError(err instanceof ApiError ? FAILURE_MESSAGES[err.failureReason] || err.message : 'Something went wrong. Please try again.') }
    finally { setSubmitting(false) }
  }

  return (
    <PortalFrame eyebrow="Agent Centre · Add money" title="Put cash into a wallet" description="Scan the customer’s card or enter its number, then confirm the amount before the cash changes hands." className="agent-flow-panel">
      {!reviewing && !result && <form className="batwa-form" onSubmit={beginReview}>
        <FormField id="agentId" label="Agent ID" hint={`Current counter: ${agent.name}`}><input type="text" value={agentId} onChange={(e) => setAgentId(e.target.value)} /></FormField>
        <div className="form-section-heading"><h2>Find the customer card</h2><p>Use a printed QR card, or type the card ID when a camera is not available.</p></div>
        {cardMode === 'choice' && <div className={`card-path-grid${DEMO_MODE ? '' : ' card-path-grid-two'}`}><button className="card-path" type="button" onClick={() => setCardMode('camera')}><span className="card-path-icon"><Icon name="scan" size={28} /></span><strong>Scan card</strong><span>Open the camera only when you choose.</span></button><button className="card-path" type="button" onClick={() => setCardMode('manual')}><span className="card-path-icon"><Icon name="card" size={28} /></span><strong>Enter card number</strong><span>Use the printed ID directly.</span></button>{DEMO_MODE && <button className="card-path card-path-demo" type="button" onClick={() => handleCardValue(DEMO_CARD_ID)}><span className="card-path-icon"><Icon name="wallet" size={28} /></span><strong>Use demo card</strong><span>Demo only · {DEMO_CARD_ID}</span></button>}</div>}
        {cardMode === 'camera' && <QrScanner active onValue={handleCardValue} validate={isCardId} labels={{ instruction: 'Point the camera at the customer’s QR card.', manualLabel: 'Enter card ID instead', manualHint: 'Camera access is optional.', useCard: 'Use this card' }} />}
        {cardMode === 'manual' && <QrScanner active={false} showCamera={false} onValue={handleCardValue} validate={isCardId} labels={{ manualLabel: 'Customer card ID', manualHint: 'Example: CARD-TEST01', useCard: 'Use this card' }} />}
        {cardId && <div className="selected-card"><span>Selected card</span><strong>{cardId}</strong><Button variant="quiet" onClick={() => setCardId('')}>Change</Button></div>}
        <FormField id="topup-amount" label="Cash amount received (₹)"><input type="number" inputMode="decimal" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></FormField>
        {error && <StatusPanel variant="error" title="Top-up needs attention"><p>{error}</p></StatusPanel>}
        <Button type="submit" disabled={submitting || !cardId}>Review top-up</Button>
      </form>}
      {reviewing && <section className="review-block"><div className="form-section-heading"><p className="batwa-eyebrow">Check the cash handover</p><h2>Confirm top-up</h2><p>Make sure the customer, amount and agent are correct before confirming.</p></div><dl className="merchant-summary"><div><dt>Customer card</dt><dd>{cardId}</dd></div><div><dt>Cash received</dt><dd>₹{Number(amount).toFixed(2)}</dd></div><div><dt>Agent</dt><dd>{agentId}</dd></div></dl>{error && <StatusPanel variant="error" title="Top-up needs attention"><p>{error}</p></StatusPanel>}<div className="merchant-actions"><Button variant="secondary" onClick={() => setReviewing(false)} disabled={submitting}>Back</Button><Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Processing…' : 'Confirm top-up'}</Button></div></section>}
      {result && <section className="batwa-result-card" aria-live="polite"><StatusPanel variant="success" title="Top-up successful"><p>The customer balance and agent float were updated together.</p></StatusPanel><div className="result-grid"><div><span>Transaction ID</span><strong>{result.txn_id}</strong></div><div><span>New customer balance</span><strong>₹{result.new_customer_balance}</strong></div><div><span>Agent float remaining</span><strong>₹{result.agent_float_remaining}</strong></div></div><Button variant="secondary" onClick={() => setResult(null)}>Another top-up</Button></section>}
    </PortalFrame>
  )
}
