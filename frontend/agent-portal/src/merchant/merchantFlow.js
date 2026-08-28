export const FLOW_STEPS = {
  ENTER_AMOUNT: 'ENTER_AMOUNT',
  SCAN_CARD: 'SCAN_CARD',
  REVIEW_PAYMENT: 'REVIEW_PAYMENT',
  ENTER_PIN: 'ENTER_PIN',
  SUBMITTING: 'SUBMITTING',
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
}

export const PROGRESS_STEPS = [
  { id: FLOW_STEPS.ENTER_AMOUNT, labelKey: 'amount' },
  { id: FLOW_STEPS.SCAN_CARD, labelKey: 'scan' },
  { id: FLOW_STEPS.REVIEW_PAYMENT, labelKey: 'review' },
  { id: FLOW_STEPS.ENTER_PIN, labelKey: 'pin' },
  { id: FLOW_STEPS.SUCCESS, labelKey: 'done' },
]

export const PAYMENT_LIMIT = 100
export const CARD_ID_PATTERN = /^CARD-[A-Z0-9]{6}$/

export const PAYMENT_FAILURE_CODES = [
  'LIMIT_EXCEEDED',
  'CARD_NOT_FOUND',
  'BLOCKED_CARD',
  'WRONG_PIN',
  'INSUFFICIENT_BALANCE',
  'MERCHANT_NOT_FOUND',
]

export const FAILURE_ACTIONS = {
  LIMIT_EXCEEDED: 'CHANGE_AMOUNT',
  CARD_NOT_FOUND: 'RETRY_SCAN',
  BLOCKED_CARD: 'RETRY_SCAN',
  WRONG_PIN: 'RETRY_PIN',
  INSUFFICIENT_BALANCE: 'RETRY_SCAN',
  MERCHANT_NOT_FOUND: 'NEW_PAYMENT',
  NETWORK_ERROR: 'RETRY_PIN',
  SERVER_ERROR: 'RETRY_PIN',
  UNKNOWN_FAILURE: 'NEW_PAYMENT',
}

export const initialMerchantState = {
  step: FLOW_STEPS.ENTER_AMOUNT,
  amountInput: '',
  amountError: null,
  cardId: '',
  pin: '',
  pinError: null,
  failureCode: null,
  response: null,
  submittedAmount: null,
  submittedCardId: '',
}

export function sanitizeAmountInput(value) {
  let next = String(value ?? '').replace(/[^\d.]/g, '')
  const decimalIndex = next.indexOf('.')
  if (decimalIndex >= 0) {
    next =
      next.slice(0, decimalIndex + 1) +
      next.slice(decimalIndex + 1).replace(/\./g, '').slice(0, 2)
  }
  if (next.includes('.')) {
    const [whole, fraction] = next.split('.')
    next = (whole.replace(/^0+(?=\d)/, '') || '0') + '.' + fraction
  } else {
    next = next.replace(/^0+(?=\d)/, '')
  }
  return next.slice(0, 8)
}

export function parseAmount(value) {
  if (String(value ?? '').trim() === '') return null
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : null
}

export function getAmountErrorCode(value) {
  if (String(value ?? '').trim() === '') return 'AMOUNT_REQUIRED'
  const amount = parseAmount(value)
  if (amount === null || amount <= 0) return 'AMOUNT_INVALID'
  if (amount > PAYMENT_LIMIT) return 'AMOUNT_OVER_LIMIT'
  return null
}

export function normalizeCardId(value) {
  return String(value ?? '').trim().toUpperCase()
}

export function isCardId(value) {
  return CARD_ID_PATTERN.test(normalizeCardId(value))
}

export function getCardIdErrorCode(value) {
  if (!normalizeCardId(value)) return 'CARD_REQUIRED'
  return isCardId(value) ? null : 'CARD_INVALID'
}

export function isPinValid(value) {
  return /^\d{4}$/.test(String(value ?? ''))
}

export function getPinErrorCode(value) {
  if (!String(value ?? '')) return 'PIN_REQUIRED'
  return isPinValid(value) ? null : 'PIN_INVALID'
}

export function maskCardId(value) {
  const normalized = normalizeCardId(value)
  if (normalized.length <= 2) return '••••'
  return 'CARD-••••' + normalized.slice(-2)
}

export function formatRupees(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '₹0.00'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function buildPayRequest({ merchantId, cardId, amountInput, pin }) {
  return {
    merchant_id: merchantId,
    card_id: normalizeCardId(cardId),
    amount: parseAmount(amountInput),
    pin,
  }
}

export function merchantReducer(state, action) {
  switch (action.type) {
    case 'SET_AMOUNT': {
      const amountInput = sanitizeAmountInput(action.value)
      return {
        ...state,
        amountInput,
        amountError: amountInput ? getAmountErrorCode(amountInput) : null,
      }
    }
    case 'ADVANCE_AMOUNT': {
      const amountError = getAmountErrorCode(state.amountInput)
      if (amountError) return { ...state, amountError }
      return { ...state, step: FLOW_STEPS.SCAN_CARD, amountError: null }
    }
    case 'CARD_INVALID':
      return { ...state, cardId: '', step: FLOW_STEPS.SCAN_CARD }
    case 'CARD_SCANNED':
      return {
        ...state,
        cardId: normalizeCardId(action.cardId),
        step: FLOW_STEPS.REVIEW_PAYMENT,
      }
    case 'BACK_TO_AMOUNT':
      return { ...state, step: FLOW_STEPS.ENTER_AMOUNT, cardId: '', pin: '', pinError: null }
    case 'BACK_TO_SCAN':
      return { ...state, step: FLOW_STEPS.SCAN_CARD, pin: '', pinError: null }
    case 'ADVANCE_TO_PIN':
      return { ...state, step: FLOW_STEPS.ENTER_PIN, pin: '', pinError: null }
    case 'SET_PIN':
      return { ...state, pin: String(action.value ?? '').replace(/\D/g, '').slice(0, 4), pinError: null }
    case 'SET_PIN_ERROR':
      return { ...state, pinError: action.code }
    case 'SUBMIT':
      return { ...state, step: FLOW_STEPS.SUBMITTING, pin: '', pinError: null }
    case 'SUCCESS':
      return {
        ...state,
        step: FLOW_STEPS.SUCCESS,
        response: action.response,
        failureCode: null,
        submittedAmount: parseAmount(state.amountInput),
        submittedCardId: state.cardId,
        pin: '',
      }
    case 'FAILURE':
      return {
        ...state,
        step: FLOW_STEPS.FAILURE,
        response: null,
        failureCode: action.code,
        submittedAmount: parseAmount(state.amountInput),
        submittedCardId: state.cardId,
        pin: '',
      }
    case 'RETRY_PIN':
      return { ...state, step: FLOW_STEPS.ENTER_PIN, pin: '', pinError: null, failureCode: null }
    case 'RETRY_SCAN':
      return { ...state, step: FLOW_STEPS.SCAN_CARD, cardId: '', pin: '', pinError: null, failureCode: null }
    case 'CHANGE_AMOUNT':
      return {
        ...state,
        step: FLOW_STEPS.ENTER_AMOUNT,
        amountInput: '',
        amountError: null,
        cardId: '',
        pin: '',
        pinError: null,
        failureCode: null,
      }
    case 'NEW_PAYMENT':
      return { ...initialMerchantState }
    default:
      return state
  }
}
