import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DEMO_MODE } from '../config/runtime'
import { DEMO_CARD_ID } from '../config/merchantDemo'
import { useLanguage } from '../i18n/LanguageContext'
import { playResult, playVoicePrompt } from '../audio/sounds'
import { payWallet, MerchantApiError } from '../api/merchantApi'
import QrScanner from '../components/qr/QrScanner'
import {
  Button,
  FormField,
  LoadingState,
  NumericKeypad,
  ProgressSteps,
  StatusPanel,
} from '../components/ui/index'
import {
  FAILURE_ACTIONS,
  FLOW_STEPS,
  PAYMENT_FAILURE_CODES,
  PROGRESS_STEPS,
  buildPayRequest,
  formatRupees,
  getPinErrorCode,
  initialMerchantState,
  isCardId,
  merchantReducer,
  maskCardId,
  normalizeCardId,
  sanitizeAmountInput,
} from '../merchant/merchantFlow'
import Icon from '../components/ui/Icon'
import type { ReactNode, Ref } from 'react'
import type { Copy } from '../i18n/copy'
import type { FailureCode, PayResponse, ValidationErrorCode } from '../merchant/merchantFlow'

const VALIDATION_COPY_KEYS: Record<ValidationErrorCode, keyof Copy['validation']> = {
  AMOUNT_REQUIRED: 'amountRequired', AMOUNT_INVALID: 'amountInvalid', AMOUNT_OVER_LIMIT: 'amountOverLimit',
  CARD_REQUIRED: 'cardRequired', CARD_INVALID: 'cardInvalid', PIN_REQUIRED: 'pinRequired', PIN_INVALID: 'pinInvalid',
}

interface StepFrameProps {
  eyebrow: ReactNode
  title: ReactNode
  headingRef: Ref<HTMLHeadingElement>
  children?: ReactNode
}

function StepFrame({ eyebrow, title, headingRef, children }: StepFrameProps) {
  return (
    <section className="merchant-step" aria-labelledby="merchant-step-title">
      <p className="batwa-eyebrow">{eyebrow}</p>
      <h1 id="merchant-step-title" ref={headingRef} tabIndex={-1}>{title}</h1>
      {children}
    </section>
  )
}

function ErrorText({ code, copy }: { code: ValidationErrorCode | null; copy: Copy }) {
  return code ? (copy.validation[VALIDATION_COPY_KEYS[code]] || copy.validation.amountInvalid) : null
}

export interface MerchantPortalProps {
  merchantId: string
  merchantName: string
}

export default function MerchantPortal({ merchantId, merchantName }: MerchantPortalProps) {
  const { copy, language } = useLanguage()
  const navigate = useNavigate()
  const [state, dispatch] = useReducer(merchantReducer, initialMerchantState)
  const [cardMode, setCardMode] = useState<'choice' | 'camera' | 'manual'>('choice')
  const headingRef = useRef<HTMLHeadingElement>(null)
  const submitLockRef = useRef(false)
  const locale = `${language}-IN`

  useEffect(() => {
    const timer = window.setTimeout(() => headingRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [state.step])

  // Voice guidance per step uses the selected language's static prompts.
  // Success/failure additionally get a tone so the outcome is distinguishable
  // by sound, not text or color alone.
  useEffect(() => {
    if (state.step === FLOW_STEPS.ENTER_AMOUNT) playVoicePrompt(language, 'enter_amount')
    else if (state.step === FLOW_STEPS.SCAN_CARD) playVoicePrompt(language, 'scan_card')
    else if (state.step === FLOW_STEPS.ENTER_PIN) playVoicePrompt(language, 'enter_pin')
    else if (state.step === FLOW_STEPS.SUCCESS) playResult(language, true)
    else if (state.step === FLOW_STEPS.FAILURE) playResult(language, false)
  }, [state.step, language])

  // Receipt timestamp is fixed at the moment a payment response arrives.
  const receiptDate = useMemo(() => new Date(), [state.response])

  useEffect(() => {
    if (state.step === FLOW_STEPS.SCAN_CARD) setCardMode('choice')
  }, [state.step])

  const handleCardValue = useCallback((value: string) => {
    const cardId = normalizeCardId(value)
    if (!isCardId(cardId)) {
      dispatch({ type: 'CARD_INVALID' })
      return
    }
    dispatch({ type: 'CARD_SCANNED', cardId })
  }, [])

  function handlePay() {
    if (state.step !== FLOW_STEPS.ENTER_PIN || submitLockRef.current) return
    const pinError = getPinErrorCode(state.pin)
    if (pinError) {
      dispatch({ type: 'SET_PIN_ERROR', code: pinError })
      return
    }

    const request = buildPayRequest({ merchantId, cardId: state.cardId, amountInput: state.amountInput, pin: state.pin })
    submitLockRef.current = true
    dispatch({ type: 'SUBMIT' })
    payWallet(request)
      .then((response) => dispatch({ type: 'SUCCESS', response }))
      .catch((error: unknown) => {
        const candidate = error instanceof MerchantApiError ? error.failureReason : 'UNKNOWN_FAILURE'
        const knownCode: FailureCode = PAYMENT_FAILURE_CODES.includes(candidate) || ['NETWORK_ERROR', 'SERVER_ERROR'].includes(candidate)
          ? (candidate as FailureCode) : 'UNKNOWN_FAILURE'
        dispatch({ type: 'FAILURE', code: knownCode })
      })
      .finally(() => { submitLockRef.current = false })
  }

  function startNewPayment() {
    submitLockRef.current = false
    dispatch({ type: 'NEW_PAYMENT' })
  }

  function handleFailureAction() {
    dispatch({ type: state.failureCode ? FAILURE_ACTIONS[state.failureCode] : 'NEW_PAYMENT' })
  }

  function printReceipt() {
    // Print CSS shows only the .payment-receipt block while this class is set.
    document.body.classList.add('print-receipt-mode')
    const cleanup = () => {
      document.body.classList.remove('print-receipt-mode')
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup)
    window.print()
    window.setTimeout(cleanup, 1000) // fallback when afterprint never fires
  }

  const progressSteps = PROGRESS_STEPS.map((step) => ({ id: step.id, label: copy.steps[step.labelKey] }))
  const progressStep = state.step === FLOW_STEPS.FAILURE ? FLOW_STEPS.ENTER_PIN : state.step
  let content: ReactNode = null

  if (state.step === FLOW_STEPS.ENTER_AMOUNT) {
    content = (
      <StepFrame eyebrow={copy.eyebrows.amount} title={copy.amount.title} headingRef={headingRef}>
        <div className="merchant-party-card">
          <div><span className="merchant-party-label">{copy.amount.merchantLabel}</span><strong>{merchantName}</strong></div>
          <span className="merchant-id">{merchantId}</span>
        </div>
        <div className="merchant-amount-display" aria-live="polite">
           <span>{copy.amount.label}</span><output>{formatRupees(state.amountInput, locale)}</output>
        </div>
        <FormField id="merchant-amount" label={copy.amount.label} hint={copy.amount.hint} error={<ErrorText code={state.amountError} copy={copy} />}>
          <input type="text" inputMode="decimal" value={state.amountInput} onChange={(e) => dispatch({ type: 'SET_AMOUNT', value: sanitizeAmountInput(e.target.value) })} placeholder={copy.amount.placeholder} autoComplete="off" spellCheck="false" />
        </FormField>
        <NumericKeypad value={state.amountInput} onChange={(value) => dispatch({ type: 'SET_AMOUNT', value })} allowDecimal maxLength={8} label={copy.common.amountKeypad} clearLabel={copy.common.clearValue} deleteLabel={copy.common.deleteLastDigit} />
        <div className="merchant-actions"><Button onClick={() => dispatch({ type: 'ADVANCE_AMOUNT' })} disabled={Boolean(state.amountError) || !state.amountInput}>{copy.amount.continue}</Button></div>
      </StepFrame>
    )
  }

  if (state.step === FLOW_STEPS.SCAN_CARD) {
    content = (
      <StepFrame eyebrow={copy.eyebrows.card} title={copy.scan.title} headingRef={headingRef}>
        <p className="batwa-lede">{copy.scan.lede}</p>
        {cardMode === 'choice' && (
          <div className="card-path-grid">
            <button className="card-path" type="button" onClick={() => setCardMode('camera')}>
              <span className="card-path-icon"><Icon name="scan" size={30} /></span><strong>{copy.scan.scanOptionTitle}</strong><span>{copy.scan.scanOptionText}</span>
            </button>
            <button className="card-path" type="button" onClick={() => setCardMode('manual')}>
              <span className="card-path-icon"><Icon name="card" size={30} /></span><strong>{copy.scan.manualOptionTitle}</strong><span>{copy.scan.manualOptionText}</span>
            </button>
            {DEMO_MODE && <button className="card-path card-path-demo" type="button" onClick={() => handleCardValue(DEMO_CARD_ID)}>
              <span className="card-path-icon"><Icon name="wallet" size={30} /></span><strong>{copy.scan.demoOptionTitle}</strong><span>{copy.scan.demoOptionText} · {DEMO_CARD_ID}</span>
            </button>}
          </div>
        )}
        {cardMode === 'camera' && <QrScanner active onValue={handleCardValue} validate={isCardId} invalidMessage={copy.scan.invalid} labels={{ ...copy.scan, useCard: copy.common.useCard, or: copy.common.or }} />}
        {cardMode === 'manual' && <QrScanner active={false} showCamera={false} onValue={handleCardValue} validate={isCardId} invalidMessage={copy.scan.invalid} labels={{ ...copy.scan, useCard: copy.common.useCard, manualLabel: copy.scan.manualOptionTitle, manualHint: copy.scan.manualExample, or: copy.common.or }} />}
        {cardMode !== 'choice' && <Button variant="quiet" onClick={() => setCardMode('choice')}>{copy.scan.chooseAnother}</Button>}
        <div className="merchant-actions merchant-actions-secondary"><Button variant="quiet" onClick={() => dispatch({ type: 'BACK_TO_AMOUNT' })}>{copy.common.back}</Button><Button variant="secondary" onClick={startNewPayment}>{copy.common.cancel}</Button></div>
      </StepFrame>
    )
  }

  if (state.step === FLOW_STEPS.REVIEW_PAYMENT) {
    content = (
      <StepFrame eyebrow={copy.eyebrows.check} title={copy.review.title} headingRef={headingRef}>
        <dl className="merchant-summary">
          <div><dt>{copy.review.merchant}</dt><dd>{merchantName}<span>{merchantId}</span></dd></div>
           <div><dt>{copy.review.amount}</dt><dd>{formatRupees(state.amountInput, locale)}</dd></div>
          <div><dt>{copy.review.card}</dt><dd>{maskCardId(state.cardId)}</dd></div>
        </dl>
        <StatusPanel variant="info" title={copy.review.verify} />
        <div className="merchant-actions"><Button variant="secondary" onClick={() => dispatch({ type: 'BACK_TO_SCAN' })}>{copy.common.back}</Button><Button onClick={() => dispatch({ type: 'ADVANCE_TO_PIN' })}>{copy.review.continue}</Button></div>
        <Button variant="quiet" onClick={startNewPayment}>{copy.common.cancel}</Button>
      </StepFrame>
    )
  }

  if (state.step === FLOW_STEPS.ENTER_PIN) {
    content = (
      <StepFrame eyebrow={copy.eyebrows.confirm} title={copy.pin.title} headingRef={headingRef}>
         <div className="merchant-pin-summary"><strong>{formatRupees(state.amountInput, locale)}</strong><span>{merchantName}</span></div>
        <p className="merchant-instruction">{copy.pin.instruction}</p>
        <FormField id="merchant-pin" label={copy.pin.label} error={<ErrorText code={state.pinError} copy={copy} />}>
          <input type="password" inputMode="numeric" value={state.pin} onChange={(e) => dispatch({ type: 'SET_PIN', value: e.target.value })} maxLength={4} autoComplete="off" />
        </FormField>
        <NumericKeypad value={state.pin} onChange={(value) => dispatch({ type: 'SET_PIN', value })} maxLength={4} label={copy.common.pinKeypad} clearLabel={copy.common.clearValue} deleteLabel={copy.common.deleteLastDigit} />
        <div className="merchant-actions"><Button variant="secondary" onClick={() => dispatch({ type: 'BACK_TO_SCAN' })}>{copy.common.back}</Button><Button onClick={handlePay} disabled={state.pin.length !== 4}>{copy.pin.continue}</Button></div>
        <Button variant="quiet" onClick={startNewPayment}>{copy.common.cancel}</Button>
      </StepFrame>
    )
  }

  if (state.step === FLOW_STEPS.SUBMITTING) {
    content = <StepFrame eyebrow={copy.eyebrows.processing} title={copy.loading.title} headingRef={headingRef}><LoadingState title={copy.loading.title} message={copy.loading.message} /></StepFrame>
  }

  if (state.step === FLOW_STEPS.SUCCESS) {
    const response: Partial<PayResponse> = state.response || {}
    content = (
      <StepFrame eyebrow={copy.eyebrows.done} title={copy.success.title} headingRef={headingRef}>
        <StatusPanel variant="success" title={copy.success.message}>
           <div className="merchant-result-details"><div><span>{copy.success.amount}</span><strong>{formatRupees(state.submittedAmount, locale)}</strong></div><div><span>{copy.success.transaction}</span><strong>{response.txn_id}</strong></div>{typeof response.new_customer_balance === 'number' && <div><span>{copy.success.balance}</span><strong>{formatRupees(response.new_customer_balance, locale)}</strong></div>}</div>
        </StatusPanel>
        <section className="payment-receipt" aria-label={copy.receipt.title}>
          <header><span className="payment-receipt-brand">बटवा</span><strong>{copy.receipt.title}</strong></header>
          <dl>
            <div><dt>{copy.receipt.merchant}</dt><dd>{merchantName} · {merchantId}</dd></div>
             <div><dt>{copy.receipt.date}</dt><dd>{receiptDate.toLocaleString(locale)}</dd></div>
            <div><dt>{copy.receipt.txnId}</dt><dd>{response.txn_id}</dd></div>
            <div><dt>{copy.receipt.card}</dt><dd>{maskCardId(state.submittedCardId)}</dd></div>
             <div><dt>{copy.receipt.amount}</dt><dd>{formatRupees(state.submittedAmount, locale)}</dd></div>
             {typeof response.new_customer_balance === 'number' && <div><dt>{copy.receipt.newBalance}</dt><dd>{formatRupees(response.new_customer_balance, locale)}</dd></div>}
          </dl>
          <footer>{copy.receipt.footer}</footer>
        </section>
        <p className="merchant-success-note">{merchantName} · {merchantId}</p>
        <div className="merchant-actions"><Button variant="secondary" onClick={printReceipt}>{copy.receipt.print}</Button><Button onClick={startNewPayment}>{copy.common.newPayment}</Button></div>
      </StepFrame>
    )
  }

  if (state.step === FLOW_STEPS.FAILURE) {
    const failure = (state.failureCode && copy.failures[state.failureCode]) || copy.failures.UNKNOWN_FAILURE
    const isBusinessFailure = PAYMENT_FAILURE_CODES.includes(state.failureCode ?? '')
    content = <StepFrame eyebrow={copy.eyebrows.failed} title={failure.title} headingRef={headingRef}><StatusPanel variant="error" title={copy.failure.title}><p>{failure.message}</p><p>{isBusinessFailure ? copy.failure.noPayment : copy.failure.uncertain}</p></StatusPanel><div className="merchant-actions"><Button onClick={handleFailureAction}>{failure.action}</Button><Button variant="secondary" onClick={startNewPayment}>{copy.failure.startOver}</Button></div></StepFrame>
  }

  return <div className="merchant-page"><div className="merchant-page-header"><div><p className="merchant-kicker">{copy.workspace.merchant}</p><p className="merchant-page-descriptor">{copy.descriptor}</p></div>{DEMO_MODE ? <button className="merchant-switch-link" type="button" onClick={() => navigate('/merchant/setup')}>{copy.workspace.switchMerchant} · {merchantName}</button> : <span className="merchant-switch-link">{merchantName} · {merchantId}</span>}</div><ProgressSteps steps={progressSteps} currentStep={progressStep} ariaLabel={copy.common.paymentProgress} /><div className="merchant-step-card">{content}</div><div className="merchant-counter-floor" aria-label={copy.workspace.merchant}><span><Icon name="card" size={19} /> {copy.merchantFloor.card}</span><span><Icon name="shield" size={19} /> {copy.merchantFloor.verify}</span><span><Icon name="receipt" size={19} /> {copy.merchantFloor.confirm}</span></div></div>
}
