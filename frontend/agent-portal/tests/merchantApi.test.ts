import assert from 'node:assert/strict'
import { afterEach, test } from 'vitest'
import { MerchantApiError, payWallet } from '../src/api/merchantApi'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

test('payWallet sends the exact merchant payment body', async () => {
  let request: { url: string; options: RequestInit } | undefined
  globalThis.fetch = (async (url: string, options: RequestInit) => {
    request = { url, options }
    return new Response(
      JSON.stringify({
        status: 'SUCCESS',
        new_customer_balance: 60,
        txn_id: 'TXN-TEST',
        failure_reason: null,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }) as typeof fetch

  const result = await payWallet({
    merchant_id: 'MER-001',
    card_id: 'CARD-TEST01',
    amount: 40,
    pin: '1234',
  })

  assert.ok(request, 'fetch was not called')
  assert.equal(request.url, 'http://localhost:8000/wallet/pay')
  const serializedBody = JSON.parse(String(request.options.body))
  assert.deepEqual(serializedBody, {
    merchant_id: 'MER-001',
    card_id: 'CARD-TEST01',
    amount: 40,
    pin: '1234',
  })
  assert.deepEqual(Object.keys(serializedBody).sort(), [
    'amount',
    'card_id',
    'merchant_id',
    'pin',
  ])
  assert.equal(typeof serializedBody.merchant_id, 'string')
  assert.equal(typeof serializedBody.card_id, 'string')
  assert.equal(typeof serializedBody.amount, 'number')
  assert.equal(typeof serializedBody.pin, 'string')
  assert.equal(serializedBody.pin.length, 4)
  assert.equal(result.txn_id, 'TXN-TEST')
})

test('payWallet exposes normal-JSON business failures as typed errors', async () => {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        status: 'FAILED',
        new_customer_balance: null,
        txn_id: null,
        failure_reason: 'WRONG_PIN',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )) as typeof fetch

  await assert.rejects(
    payWallet({ merchant_id: 'MER-001', card_id: 'CARD-TEST01', amount: 40, pin: '0000' }),
    (error: unknown) => error instanceof MerchantApiError && error.failureReason === 'WRONG_PIN',
  )
})

test('payWallet classifies transport and malformed-server failures without exposing raw details', async () => {
  globalThis.fetch = (async () => {
    throw new Error('private transport detail')
  }) as typeof fetch

  await assert.rejects(
    payWallet({ merchant_id: 'MER-001', card_id: 'CARD-TEST01', amount: 40, pin: '1234' }),
    (error: unknown) =>
      error instanceof MerchantApiError &&
      error.failureReason === 'NETWORK_ERROR' &&
      !error.message.includes('private transport detail'),
  )

  globalThis.fetch = (async () => new Response('not json', { status: 502 })) as typeof fetch
  await assert.rejects(
    payWallet({ merchant_id: 'MER-001', card_id: 'CARD-TEST01', amount: 40, pin: '1234' }),
    (error: unknown) => error instanceof MerchantApiError && error.failureReason === 'SERVER_ERROR',
  )
})
