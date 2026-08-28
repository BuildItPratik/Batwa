import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FAILURE_ACTIONS,
  FLOW_STEPS,
  PAYMENT_FAILURE_CODES,
  buildPayRequest,
  getAmountErrorCode,
  getCardIdErrorCode,
  getPinErrorCode,
  initialMerchantState,
  isCardId,
  maskCardId,
  merchantReducer,
  normalizeCardId,
  sanitizeAmountInput,
} from '../src/merchant/merchantFlow.js'

test('accepts exactly ₹100 and rejects amounts above the backend limit', () => {
  assert.equal(getAmountErrorCode('100'), null)
  assert.equal(getAmountErrorCode('100.00'), null)
  assert.equal(getAmountErrorCode('100.01'), 'AMOUNT_OVER_LIMIT')
  assert.equal(getAmountErrorCode('0'), 'AMOUNT_INVALID')
  assert.equal(getAmountErrorCode('-1'), 'AMOUNT_INVALID')
})

test('sanitizes keyboard amount input without changing the limit rule', () => {
  assert.equal(sanitizeAmountInput('₹1,2a3.456'), '123.45')
  assert.equal(sanitizeAmountInput('0008'), '8')
})

test('normalizes and validates the existing card identifier format', () => {
  assert.equal(normalizeCardId(' card-test01 '), 'CARD-TEST01')
  assert.equal(isCardId('CARD-TEST01'), true)
  assert.equal(isCardId('CUSTOMER-001'), false)
  assert.equal(getCardIdErrorCode(''), 'CARD_REQUIRED')
  assert.equal(getCardIdErrorCode('CARD-TOO-SHORT'), 'CARD_INVALID')
})

test('requires a four-digit PIN', () => {
  assert.equal(getPinErrorCode(''), 'PIN_REQUIRED')
  assert.equal(getPinErrorCode('12a4'), 'PIN_INVALID')
  assert.equal(getPinErrorCode('1234'), null)
})

test('builds the exact wallet payment request and does not add response fields', () => {
  assert.deepEqual(
    buildPayRequest({
      merchantId: 'MER-001',
      cardId: 'CARD-TEST01',
      amountInput: '100',
      pin: '1234',
    }),
    { merchant_id: 'MER-001', card_id: 'CARD-TEST01', amount: 100, pin: '1234' },
  )
})

test('reducer clears sensitive PIN state around submit, retry and reset', () => {
  let state = initialMerchantState
  state = merchantReducer(state, { type: 'SET_AMOUNT', value: '100' })
  state = merchantReducer(state, { type: 'ADVANCE_AMOUNT' })
  state = merchantReducer(state, { type: 'CARD_SCANNED', cardId: 'CARD-TEST01' })
  state = merchantReducer(state, { type: 'ADVANCE_TO_PIN' })
  state = merchantReducer(state, { type: 'SET_PIN', value: '1234' })
  state = merchantReducer(state, { type: 'SUBMIT' })
  assert.equal(state.step, FLOW_STEPS.SUBMITTING)
  assert.equal(state.pin, '')

  state = merchantReducer(state, {
    type: 'FAILURE',
    code: 'WRONG_PIN',
  })
  assert.equal(state.step, FLOW_STEPS.FAILURE)
  state = merchantReducer(state, { type: 'RETRY_PIN' })
  assert.equal(state.step, FLOW_STEPS.ENTER_PIN)
  assert.equal(state.pin, '')

  state = merchantReducer(state, { type: 'SET_PIN', value: '1234' })
  state = merchantReducer(state, { type: 'NEW_PAYMENT' })
  assert.deepEqual(state, initialMerchantState)
})

test('every confirmed payment failure code has a deliberate recovery action', () => {
  for (const code of PAYMENT_FAILURE_CODES) {
    assert.ok(FAILURE_ACTIONS[code], `missing recovery action for ${code}`)
  }
})

test('masks card identifiers while preserving the final two characters', () => {
  assert.equal(maskCardId('CARD-TEST01'), 'CARD-••••01')
  assert.equal(maskCardId(''), '••••')
})
