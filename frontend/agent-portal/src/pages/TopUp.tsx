import { useState, type FormEvent } from 'react'
import { topUp, ApiError, type TopupResponse } from '../api/agentApi'
import QrScanner from '../components/qr/QrScanner'
import { Button, FormField, PortalFrame, StatusPanel } from '../components/ui/index'
import { isCardId, normalizeCardId } from '../merchant/merchantFlow'
import { DEMO_MODE, getConfiguredAgent } from '../config/runtime'
import { DEMO_CARD_ID } from '../config/merchantDemo'
import { playResultTone } from '../audio/sounds'
import Icon from '../components/ui/Icon'
import { useLanguage } from '../i18n/LanguageContext'

export default function TopUp() {
  const agent = getConfiguredAgent()
  const { copy } = useLanguage()
  const [agentId, setAgentId] = useState(agent.id)
  const [cardId, setCardId] = useState('')
  const [amount, setAmount] = useState('')
  const [cardMode, setCardMode] = useState<'choice' | 'camera' | 'manual'>('choice')
  const [reviewing, setReviewing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TopupResponse | null>(null)

  function handleCardValue(value: string) { setCardId(normalizeCardId(value)); setCardMode('choice') }
  function validate(): string | null {
    if (!cardId.trim() || !isCardId(cardId)) return copy.validation.cardInvalid
    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return copy.validation.amountInvalid
    return null
  }
  function beginReview(event: FormEvent) { event.preventDefault(); setError(null); const message = validate(); if (message) { setError(message); return }; setReviewing(true) }
  async function handleSubmit() {
    setError(null); const message = validate(); if (message) { setError(message); return }
    setSubmitting(true)
    try {
      const data = await topUp({ agentId: agentId.trim(), cardId: normalizeCardId(cardId), amount: Number(amount) })
      setResult(data); setCardId(''); setAmount(''); setReviewing(false)
      playResultTone(true)
    } catch (err) {
      setError(err instanceof ApiError ? copy.failures[err.failureReason as keyof typeof copy.failures]?.message || err.message : copy.common.somethingWrong)
      playResultTone(false)
    }
    finally { setSubmitting(false) }
  }

  return (
    <PortalFrame eyebrow={copy.topup.eyebrow} title={copy.topup.title} description={copy.topup.description} className="agent-flow-panel">
      {!reviewing && !result && <form className="batwa-form" onSubmit={beginReview}>
        <FormField id="agentId" label={copy.topup.agentId} hint={`${copy.topup.currentCounter}: ${agent.name}`}><input type="text" value={agentId} onChange={(e) => setAgentId(e.target.value)} /></FormField>
        <div className="form-section-heading"><h2>{copy.topup.findCard}</h2><p>{copy.topup.findCardHelp}</p></div>
        {cardMode === 'choice' && <div className={`card-path-grid${DEMO_MODE ? '' : ' card-path-grid-two'}`}><button className="card-path" type="button" onClick={() => setCardMode('camera')}><span className="card-path-icon"><Icon name="scan" size={28} /></span><strong>{copy.topup.scanCard}</strong><span>{copy.topup.scanCardHelp}</span></button><button className="card-path" type="button" onClick={() => setCardMode('manual')}><span className="card-path-icon"><Icon name="card" size={28} /></span><strong>{copy.topup.enterCardNumber}</strong><span>{copy.topup.enterCardNumberHelp}</span></button>{DEMO_MODE && <button className="card-path card-path-demo" type="button" onClick={() => handleCardValue(DEMO_CARD_ID)}><span className="card-path-icon"><Icon name="wallet" size={28} /></span><strong>{copy.topup.useDemoCard}</strong><span>{copy.topup.demoOnly} · {DEMO_CARD_ID}</span></button>}</div>}
        {cardMode === 'camera' && <QrScanner active onValue={handleCardValue} validate={isCardId} labels={{ ...copy.scan, instruction: copy.topup.cameraLabel, manualLabel: copy.topup.manualLabel, manualHint: copy.topup.cameraHint, useCard: copy.topup.useCard, or: copy.common.or }} />}
        {cardMode === 'manual' && <QrScanner active={false} showCamera={false} onValue={handleCardValue} validate={isCardId} labels={{ ...copy.scan, manualLabel: copy.topup.manualCardLabel, manualHint: copy.topup.manualHint, useCard: copy.topup.useCard, or: copy.common.or }} />}
        {cardId && <div className="selected-card"><span>{copy.topup.selectedCard}</span><strong>{cardId}</strong><Button variant="quiet" onClick={() => setCardId('')}>{copy.common.change}</Button></div>}
        <FormField id="topup-amount" label={copy.topup.cashAmount}><input type="number" inputMode="decimal" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></FormField>
        {error && <StatusPanel variant="error" title={copy.topup.attention}><p>{error}</p></StatusPanel>}
        <Button type="submit" disabled={submitting || !cardId}>{copy.topup.reviewTopup}</Button>
      </form>}
      {reviewing && <section className="review-block"><div className="form-section-heading"><p className="batwa-eyebrow">{copy.topup.checkHandover}</p><h2>{copy.topup.confirmTitle}</h2><p>{copy.topup.confirmDescription}</p></div><dl className="merchant-summary"><div><dt>{copy.topup.customerCard}</dt><dd>{cardId}</dd></div><div><dt>{copy.topup.cashAmount}</dt><dd>₹{Number(amount).toFixed(2)}</dd></div><div><dt>{copy.topup.agent}</dt><dd>{agentId}</dd></div></dl>{error && <StatusPanel variant="error" title={copy.topup.attention}><p>{error}</p></StatusPanel>}<div className="merchant-actions"><Button variant="secondary" onClick={() => setReviewing(false)} disabled={submitting}>{copy.common.back}</Button><Button onClick={handleSubmit} disabled={submitting}>{submitting ? copy.common.processing : copy.topup.confirmTopup}</Button></div></section>}
      {result && <section className="batwa-result-card" aria-live="polite"><StatusPanel variant="success" title={copy.topup.successTitle}><p>{copy.topup.successDescription}</p></StatusPanel><div className="result-grid"><div><span>{copy.topup.transactionId}</span><strong>{result.txn_id}</strong></div><div><span>{copy.topup.newBalance}</span><strong>₹{result.new_customer_balance}</strong></div><div><span>{copy.topup.agentFloatRemaining}</span><strong>₹{result.agent_float_remaining}</strong></div></div><Button variant="secondary" onClick={() => setResult(null)}>{copy.topup.anotherTopup}</Button></section>}
    </PortalFrame>
  )
}
