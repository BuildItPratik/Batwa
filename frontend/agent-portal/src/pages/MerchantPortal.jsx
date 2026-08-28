import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DEMO_MODE } from '../config/runtime.js'
import { DEMO_CARD_ID } from '../config/merchantDemo.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { payWallet, MerchantApiError } from '../api/merchantApi.js'
import QrScanner from '../components/qr/QrScanner.jsx'
import {
  Button,
  FormField,
  LoadingState,
  NumericKeypad,
  ProgressSteps,
  StatusPanel,
} from '../components/ui/index.js'
import {
  FAILURE_ACTIONS,
  FLOW_STEPS,
  PAYMENT_FAILURE_CODES,
  PROGRESS_STEPS,
  buildPayRequest,
  formatRupees,
  getAmountErrorCode,
  getPinErrorCode,
  initialMerchantState,
  isCardId,
  merchantReducer,
  maskCardId,
  normalizeCardId,
  sanitizeAmountInput,
} from '../merchant/merchantFlow.js'
import Icon from '../components/ui/Icon.jsx'

const VALIDATION_COPY_KEYS = {
  AMOUNT_REQUIRED: 'amountRequired', AMOUNT_INVALID: 'amountInvalid', AMOUNT_OVER_LIMIT: 'amountOverLimit',
  CARD_REQUIRED: 'cardRequired', CARD_INVALID: 'cardInvalid', PIN_REQUIRED: 'pinRequired', PIN_INVALID: 'pinInvalid',
}

function StepFrame({ eyebrow, title, headingRef, children }) {
  return (
    <section className="merchant-step" aria-labelledby="merchant-step-title">
      <p className="batwa-eyebrow">{eyebrow}</p>
      <h1 id="merchant-step-title" ref={headingRef} tabIndex={-1}>{title}</h1>
      {children}
    </section>
  )
}

function ErrorText({ code, copy }) {
  return code ? (copy.validation[VALIDATION_COPY_KEYS[code]] || copy.validation.amountInvalid) : null
}

export default function MerchantPortal({ merchantId, merchantName }) {
  const { copy } = useLanguage()
  const navigate = useNavigate()
  const [state, dispatch] = useReducer(merchantReducer, initialMerchantState)
  const [cardMode, setCardMode] = useState('choice')
  const headingRef = useRef(null)
  const submitLockRef = useRef(false)

  useEffect(() => {
    const timer = window.setTimeout(() => headingRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [state.step])

  useEffect(() => {
    if (state.step === FLOW_STEPS.SCAN_CARD) setCardMode('choice')
  }, [state.step])

  const handleCardValue = useCallback((value) => {
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
      .catch((error) => {
        const candidate = error instanceof MerchantApiError ? error.failureReason : 'UNKNOWN_FAILURE'
        const knownCode = PAYMENT_FAILURE_CODES.includes(candidate) || ['NETWORK_ERROR', 'SERVER_ERROR'].includes(candidate)
          ? candidate : 'UNKNOWN_FAILURE'
        dispatch({ type: 'FAILURE', code: knownCode })
      })
      .finally(() => { submitLockRef.current = false })
  }

  function startNewPayment() {
    submitLockRef.current = false
    dispatch({ type: 'NEW_PAYMENT' })
  }

  function handleFailureAction() {
    dispatch({ type: FAILURE_ACTIONS[state.failureCode] || 'NEW_PAYMENT' })
  }

  const progressSteps = PROGRESS_STEPS.map((step) => ({ id: step.id, label: copy.steps[step.labelKey] }))
  const progressStep = state.step === FLOW_STEPS.FAILURE ? FLOW_STEPS.ENTER_PIN : state.step
  let content

  if (state.step === FLOW_STEPS.ENTER_AMOUNT) {
    content = (
      <StepFrame eyebrow="01 · Amount" title="Start with the amount" headingRef={headingRef}>
        <div className="merchant-party-card">
          <div><span className="merchant-party-label">Paying at</span><strong>{merchantName}</strong></div>
          <span className="merchant-id">{merchantId}</span>
        </div>
        <div className="merchant-amount-display" aria-live="polite">
          <span>{copy.amount.label}</span><output>{formatRupees(state.amountInput)}</output>
        </div>
        <FormField id="merchant-amount" label={copy.amount.label} hint="Up to ₹100 per payment. Exactly ₹100 is allowed." error={<ErrorText code={state.amountError} copy={copy} />}>
          <input type="text" inputMode="decimal" value={state.amountInput} onChange={(e) => dispatch({ type: 'SET_AMOUNT', value: sanitizeAmountInput(e.target.value) })} placeholder="0.00" autoComplete="off" spellCheck="false" />
        </FormField>
        <NumericKeypad value={state.amountInput} onChange={(value) => dispatch({ type: 'SET_AMOUNT', value })} allowDecimal maxLength={8} label="Amount keypad" />
        <div className="merchant-actions"><Button onClick={() => dispatch({ type: 'ADVANCE_AMOUNT' })} disabled={Boolean(state.amountError) || !state.amountInput}>Continue to card</Button></div>
      </StepFrame>
    )
  }

  if (state.step === FLOW_STEPS.SCAN_CARD) {
    content = (
      <StepFrame eyebrow="02 · Card" title="Choose how to read the card" headingRef={headingRef}>
        <p className="batwa-lede">Scan the customer’s printed Batwa QR card, or enter the card number if scanning is unavailable.</p>
        {cardMode === 'choice' && (
          <div className="card-path-grid">
            <button className="card-path" type="button" onClick={() => setCardMode('camera')}>
              <span className="card-path-icon"><Icon name="scan" size={30} /></span><strong>Scan Batwa card</strong><span>Use the camera with a printed card or another screen.</span>
            </button>
            <button className="card-path" type="button" onClick={() => setCardMode('manual')}>
              <span className="card-path-icon"><Icon name="card" size={30} /></span><strong>Enter card number</strong><span>Type the card ID directly at the counter.</span>
            </button>
            {DEMO_MODE && <button className="card-path card-path-demo" type="button" onClick={() => handleCardValue(DEMO_CARD_ID)}>
              <span className="card-path-icon"><Icon name="wallet" size={30} /></span><strong>Use demo card</strong><span>Demo only · {DEMO_CARD_ID}</span>
            </button>}
          </div>
        )}
        {cardMode === 'camera' && <QrScanner active onValue={handleCardValue} validate={isCardId} invalidMessage={copy.scan.invalid} labels={{ ...copy.scan, useCard: 'Use this card' }} />}
        {cardMode === 'manual' && <QrScanner active={false} showCamera={false} onValue={handleCardValue} validate={isCardId} invalidMessage={copy.scan.invalid} labels={{ ...copy.scan, useCard: 'Continue with this card', manualLabel: 'Card number', manualHint: 'Example: CARD-TEST01' }} />}
        {cardMode !== 'choice' && <Button variant="quiet" onClick={() => setCardMode('choice')}>Choose another way</Button>}
        <div className="merchant-actions merchant-actions-secondary"><Button variant="quiet" onClick={() => dispatch({ type: 'BACK_TO_AMOUNT' })}>Back</Button><Button variant="secondary" onClick={startNewPayment}>Cancel</Button></div>
      </StepFrame>
    )
  }

  if (state.step === FLOW_STEPS.REVIEW_PAYMENT) {
    content = (
      <StepFrame eyebrow="03 · Check" title="Review before PIN" headingRef={headingRef}>
        <dl className="merchant-summary">
          <div><dt>Merchant</dt><dd>{merchantName}<span>{merchantId}</span></dd></div>
          <div><dt>Amount</dt><dd>{formatRupees(state.amountInput)}</dd></div>
          <div><dt>Customer card</dt><dd>{maskCardId(state.cardId)}</dd></div>
        </dl>
        <StatusPanel variant="info" title="Please verify the amount with the customer." />
        <div className="merchant-actions"><Button variant="secondary" onClick={() => dispatch({ type: 'BACK_TO_SCAN' })}>Back</Button><Button onClick={() => dispatch({ type: 'ADVANCE_TO_PIN' })}>Continue to PIN</Button></div>
        <Button variant="quiet" onClick={startNewPayment}>Cancel</Button>
      </StepFrame>
    )
  }

  if (state.step === FLOW_STEPS.ENTER_PIN) {
    content = (
      <StepFrame eyebrow="04 · Confirm" title="Customer enters PIN" headingRef={headingRef}>
        <div className="merchant-pin-summary"><strong>{formatRupees(state.amountInput)}</strong><span>{merchantName}</span></div>
        <p className="merchant-instruction">The customer should enter their four-digit PIN privately.</p>
        <FormField id="merchant-pin" label="Four-digit PIN" error={<ErrorText code={state.pinError} copy={copy} />}>
          <input type="password" inputMode="numeric" value={state.pin} onChange={(e) => dispatch({ type: 'SET_PIN', value: e.target.value })} maxLength={4} autoComplete="off" />
        </FormField>
        <NumericKeypad value={state.pin} onChange={(value) => dispatch({ type: 'SET_PIN', value })} maxLength={4} label="PIN keypad" />
        <div className="merchant-actions"><Button variant="secondary" onClick={() => dispatch({ type: 'BACK_TO_SCAN' })}>Back</Button><Button onClick={handlePay} disabled={state.pin.length !== 4}>Pay now</Button></div>
        <Button variant="quiet" onClick={startNewPayment}>Cancel</Button>
      </StepFrame>
    )
  }

  if (state.step === FLOW_STEPS.SUBMITTING) {
    content = <StepFrame eyebrow="Confirming" title="Processing payment" headingRef={headingRef}><LoadingState title="Processing payment" message="Please wait while we confirm the payment." /></StepFrame>
  }

  if (state.step === FLOW_STEPS.SUCCESS) {
    const response = state.response || {}
    content = (
      <StepFrame eyebrow="Complete" title="Payment successful" headingRef={headingRef}>
        <StatusPanel variant="success" title="Payment completed.">
          <div className="merchant-result-details"><div><span>Amount</span><strong>{formatRupees(state.submittedAmount)}</strong></div><div><span>Transaction ID</span><strong>{response.txn_id}</strong></div>{typeof response.new_customer_balance === 'number' && <div><span>New customer balance</span><strong>{formatRupees(response.new_customer_balance)}</strong></div>}</div>
        </StatusPanel>
        <p className="merchant-success-note">{merchantName} · {merchantId}</p><Button onClick={startNewPayment}>New payment</Button>
      </StepFrame>
    )
  }

  if (state.step === FLOW_STEPS.FAILURE) {
    const failure = copy.failures[state.failureCode] || copy.failures.UNKNOWN_FAILURE
    const isBusinessFailure = PAYMENT_FAILURE_CODES.includes(state.failureCode)
    content = <StepFrame eyebrow="Payment not completed" title={failure.title} headingRef={headingRef}><StatusPanel variant="error" title="Payment not completed"><p>{failure.message}</p><p>{isBusinessFailure ? 'No payment was completed.' : copy.failure.uncertain}</p></StatusPanel><div className="merchant-actions"><Button onClick={handleFailureAction}>{failure.action}</Button><Button variant="secondary" onClick={startNewPayment}>Start over</Button></div></StepFrame>
  }

  return <div className="merchant-page"><div className="merchant-page-header"><div><p className="merchant-kicker">Merchant Counter</p><p className="merchant-page-descriptor">{copy.descriptor}</p></div>{DEMO_MODE ? <button className="merchant-switch-link" type="button" onClick={() => navigate('/merchant/setup')}>Switch merchant · {merchantName}</button> : <span className="merchant-switch-link">{merchantName} · {merchantId}</span>}</div><ProgressSteps steps={progressSteps} currentStep={progressStep} /><div className="merchant-step-card">{content}</div><div className="merchant-counter-floor" aria-label="Payment counter guidance"><span><Icon name="card" size={19} /> Card or manual ID</span><span><Icon name="shield" size={19} /> Customer verifies amount</span><span><Icon name="receipt" size={19} /> Confirm before next sale</span></div></div>
}
