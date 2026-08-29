import { API_BASE_URL } from '../config/runtime'
import type { PayRequestBody, PayResponse } from '../merchant/merchantFlow'

const GENERIC_FAILURE = 'The payment service could not complete this payment.'

export class MerchantApiError extends Error {
  failureReason: string
  status: number | null

  constructor(message: string, failureReason: string = 'UNKNOWN_FAILURE', status: number | null = null) {
    super(message)
    this.name = 'MerchantApiError'
    this.failureReason = failureReason
    this.status = status
  }
}

export async function payWallet({ merchant_id, card_id, amount, pin }: PayRequestBody): Promise<PayResponse> {
  const body: PayRequestBody = {
    merchant_id,
    card_id,
    amount,
    pin,
  }

  let response: Response
  try {
    response = await fetch(API_BASE_URL + '/wallet/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new MerchantApiError(
      'Could not reach the payment service. Check your connection.',
      'NETWORK_ERROR',
    )
  }

  let data: PayResponse
  try {
    data = (await response.json()) as PayResponse
  } catch {
    throw new MerchantApiError(GENERIC_FAILURE, 'SERVER_ERROR', response.status)
  }

  if (!response.ok) {
    const failureReason =
      typeof data?.failure_reason === 'string' ? data.failure_reason : 'SERVER_ERROR'
    throw new MerchantApiError(GENERIC_FAILURE, failureReason, response.status)
  }

  if (data?.status === 'FAILED') {
    throw new MerchantApiError(GENERIC_FAILURE, data.failure_reason || 'UNKNOWN_FAILURE', response.status)
  }

  if (data?.status !== 'SUCCESS') {
    throw new MerchantApiError(GENERIC_FAILURE, 'UNKNOWN_FAILURE', response.status)
  }

  return data
}
