import { useState } from 'react'
import { blockCard, reissueCard, ApiError, type BlockResponse, type ReissueResponse } from '../api/agentApi'
import { Button, FormField, PortalFrame, StatusPanel } from '../components/ui/index'
import { useLanguage } from '../i18n/LanguageContext'

export default function BlockReissue() {
  const { copy } = useLanguage()
  const [cardId, setCardId] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [confirmingBlock, setConfirmingBlock] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blockResult, setBlockResult] = useState<BlockResponse | null>(null)
  const [reissueResult, setReissueResult] = useState<ReissueResponse | null>(null)

  function resetResults() { setError(null); setBlockResult(null); setReissueResult(null) }
  async function handleBlock() {
    resetResults(); if (!cardId.trim()) { setError(copy.manage.enterCardError); return }
    setSubmitting(true)
    try { const data = await blockCard({ cardId: cardId.trim() }); setBlockResult(data); setConfirmingBlock(false); setCardId('') }
    catch (err) { setError(err instanceof ApiError ? err.message : copy.common.somethingWrong) }
    finally { setSubmitting(false) }
  }
  async function handleReissue() {
    resetResults(); if (!customerId.trim()) { setError(copy.manage.enterCustomerError); return }
    setSubmitting(true)
    try { const data = await reissueCard({ customerId: customerId.trim() }); setReissueResult(data); setCustomerId('') }
    catch (err) { setError(err instanceof ApiError ? err.message : copy.common.somethingWrong) }
    finally { setSubmitting(false) }
  }

  return (
    <PortalFrame eyebrow={copy.manage.eyebrow} title={copy.manage.title} description={copy.manage.description} className="agent-flow-panel">
      <div className="manage-grid">
        <section className="manage-action manage-danger">
           <p className="batwa-eyebrow">{copy.manage.lostEyebrow}</p><h2>{copy.manage.blockTitle}</h2><p>{copy.manage.blockDescription}</p>
           <FormField id="manageCardId" label={copy.manage.cardId}><input type="text" placeholder="CARD-XXXXXX" value={cardId} onChange={(e) => { setCardId(e.target.value); setConfirmingBlock(false) }} autoComplete="off" /></FormField>
           {!confirmingBlock ? <Button variant="danger" onClick={() => { resetResults(); if (!cardId.trim()) setError(copy.manage.enterCardError); else setConfirmingBlock(true) }} disabled={submitting}>{copy.manage.blockButton}</Button> : <div className="confirmation-panel"><strong>{copy.manage.confirmBlock} {cardId}</strong><p>{copy.manage.confirmBlockDescription}</p><div className="merchant-actions"><Button variant="danger" onClick={handleBlock} disabled={submitting}>{submitting ? copy.manage.blocking : copy.manage.yesBlock}</Button><Button variant="secondary" onClick={() => setConfirmingBlock(false)} disabled={submitting}>{copy.common.cancel}</Button></div></div>}
           {blockResult && <StatusPanel variant="success" title={copy.manage.blockedTitle}><p>{copy.manage.cardStatus}: <strong>{blockResult.card_status}</strong></p></StatusPanel>}
        </section>
        <section className="manage-action">
           {!reissueResult && <><p className="batwa-eyebrow">{copy.manage.newCardEyebrow}</p><h2>{copy.manage.reissueTitle}</h2><p>{copy.manage.reissueDescription}</p>
             <FormField id="manageCustomerId" label={copy.manage.customerId}><input type="text" placeholder="CUST-XXXXXX" value={customerId} onChange={(e) => setCustomerId(e.target.value)} autoComplete="off" /></FormField>
             <Button variant="secondary" onClick={handleReissue} disabled={submitting}>{submitting ? copy.manage.issuing : copy.manage.reissueButton}</Button></>}
           {reissueResult && <><p className="batwa-eyebrow">{copy.manage.newCardEyebrow}</p><h2>{copy.manage.newCardTitle}</h2><div className="qr-card qr-card-small"><StatusPanel variant="success" title={copy.manage.balanceCarried}><p>₹{reissueResult.balance_carried_over}</p></StatusPanel>{reissueResult.qr_code_base64 && <img src={`data:image/png;base64,${reissueResult.qr_code_base64}`} alt={`${copy.register.qrAlt} ${reissueResult.new_card_id}`} />}<strong>{reissueResult.new_card_id}</strong><Button variant="quiet" onClick={() => window.print()}>{copy.manage.printCard}</Button></div></>}
        </section>
      </div>
       {error && <StatusPanel variant="error" title={copy.manage.actionAttention}><p>{error}</p></StatusPanel>}
    </PortalFrame>
  )
}
