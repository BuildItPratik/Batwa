import { useState } from 'react'
import { blockCard, reissueCard, ApiError, type BlockResponse, type ReissueResponse } from '../api/agentApi'
import { Button, FormField, PortalFrame, StatusPanel } from '../components/ui/index'

export default function BlockReissue() {
  const [cardId, setCardId] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [confirmingBlock, setConfirmingBlock] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blockResult, setBlockResult] = useState<BlockResponse | null>(null)
  const [reissueResult, setReissueResult] = useState<ReissueResponse | null>(null)

  function resetResults() { setError(null); setBlockResult(null); setReissueResult(null) }
  async function handleBlock() {
    resetResults(); if (!cardId.trim()) { setError('Enter the card ID to block.'); return }
    setSubmitting(true)
    try { const data = await blockCard({ cardId: cardId.trim() }); setBlockResult(data); setConfirmingBlock(false); setCardId('') }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Something went wrong.') }
    finally { setSubmitting(false) }
  }
  async function handleReissue() {
    resetResults(); if (!customerId.trim()) { setError('Enter the customer ID to reissue the card.'); return }
    setSubmitting(true)
    try { const data = await reissueCard({ customerId: customerId.trim() }); setReissueResult(data); setCustomerId('') }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Something went wrong.') }
    finally { setSubmitting(false) }
  }

  return (
    <PortalFrame eyebrow="Agent Centre · Manage card" title="Keep cards safe" description="Block a lost card immediately, or issue a new card while the customer’s balance stays with them." className="agent-flow-panel">
      <div className="manage-grid">
        <section className="manage-action manage-danger">
          <p className="batwa-eyebrow">Lost or compromised</p><h2>Block a card</h2><p>Payments stop immediately. The customer’s balance is not lost.</p>
          <FormField id="manageCardId" label="Card ID"><input type="text" placeholder="CARD-XXXXXX" value={cardId} onChange={(e) => { setCardId(e.target.value); setConfirmingBlock(false) }} autoComplete="off" /></FormField>
          {!confirmingBlock ? <Button variant="danger" onClick={() => { resetResults(); if (!cardId.trim()) setError('Enter the card ID to block.'); else setConfirmingBlock(true) }} disabled={submitting}>Block this card</Button> : <div className="confirmation-panel"><strong>Confirm blocking {cardId}</strong><p>This cannot be undone for the active card. A new card can be issued separately.</p><div className="merchant-actions"><Button variant="danger" onClick={handleBlock} disabled={submitting}>{submitting ? 'Blocking…' : 'Yes, block card'}</Button><Button variant="secondary" onClick={() => setConfirmingBlock(false)} disabled={submitting}>Cancel</Button></div></div>}
          {blockResult && <StatusPanel variant="success" title="Card blocked"><p>Card status: <strong>{blockResult.card_status}</strong></p></StatusPanel>}
        </section>
        <section className="manage-action">
          {!reissueResult && <><p className="batwa-eyebrow">New card, same wallet</p><h2>Reissue a card</h2><p>All active cards are blocked and a fresh QR card carries the balance over.</p>
            <FormField id="manageCustomerId" label="Customer ID"><input type="text" placeholder="CUST-XXXXXX" value={customerId} onChange={(e) => setCustomerId(e.target.value)} autoComplete="off" /></FormField>
            <Button variant="secondary" onClick={handleReissue} disabled={submitting}>{submitting ? 'Issuing…' : 'Reissue new card'}</Button></>}
          {reissueResult && <><p className="batwa-eyebrow">New card, same wallet</p><h2>New card issued</h2><div className="qr-card qr-card-small"><StatusPanel variant="success" title="Balance carried over"><p>₹{reissueResult.balance_carried_over}</p></StatusPanel>{reissueResult.qr_code_base64 && <img src={`data:image/png;base64,${reissueResult.qr_code_base64}`} alt={`QR card for ${reissueResult.new_card_id}`} />}<strong>{reissueResult.new_card_id}</strong><Button variant="quiet" onClick={() => window.print()}>Print card</Button></div></>}
        </section>
      </div>
      {error && <StatusPanel variant="error" title="Action needs attention"><p>{error}</p></StatusPanel>}
    </PortalFrame>
  )
}
