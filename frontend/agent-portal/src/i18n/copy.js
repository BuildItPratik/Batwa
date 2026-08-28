export const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ta', label: 'Tamil' },
]

// English is the current copy source. The provider and map are intentionally light
// so Ruchir can add final translations/audio without rewriting screen components.
export const COPY = {
  en: {
    descriptor: 'Phone-free payments, made familiar',
    currentWorkspace: 'Current workspace',
    language: 'Language',
    navigation: {
      register: 'Register',
      topup: 'Top-Up',
      manage: 'Block/Reissue',
      merchant: 'Merchant',
    },
    common: {
      back: 'Back',
      cancel: 'Cancel',
      continue: 'Continue',
      retry: 'Try again',
      newPayment: 'New payment',
      useCard: 'Use this card',
    },
    steps: {
      amount: 'Amount',
      scan: 'Scan card',
      review: 'Review',
      pin: 'PIN',
      done: 'Done',
    },
    amount: {
      eyebrow: 'Step 1 of 4',
      title: 'Enter payment amount',
      helper: 'Payments can be up to ₹100 per transaction.',
      label: 'Amount in rupees',
      placeholder: '0.00',
      continue: 'Continue to card',
      merchantLabel: 'Paying at',
      merchantIdLabel: 'Merchant ID',
    },
    scan: {
      eyebrow: 'Step 2 of 4',
      title: 'Scan the customer card',
      instruction: 'Point the camera at the customer’s QR card.',
      manualLabel: 'Enter card ID manually',
      manualPlaceholder: 'CARD-XXXXXX',
      manualHint: 'Use this option if the camera is unavailable.',
      cameraStarting: 'Starting camera…',
      cameraReady: 'Camera ready. Align the QR code inside the frame.',
      permissionDenied: 'Camera permission was denied. You can enter the card ID below.',
      noCamera: 'No camera was found on this device. Enter the card ID below.',
      unsupported: 'This browser cannot access a camera. Enter the card ID below.',
      startFailed: 'The camera could not start. Retry or enter the card ID below.',
      invalid: 'That QR code does not contain a supported Batwa card ID.',
      retryCamera: 'Retry camera',
    },
    review: {
      eyebrow: 'Step 3 of 4',
      title: 'Review payment',
      merchant: 'Merchant',
      amount: 'Amount',
      card: 'Customer card',
      verify: 'Customer, please verify the merchant and amount before entering your PIN.',
      continue: 'Continue to PIN',
    },
    pin: {
      eyebrow: 'Step 4 of 4',
      title: 'Enter customer PIN',
      instruction: 'Enter the customer’s four-digit PIN to approve this payment.',
      label: 'Four-digit PIN',
      continue: 'Pay now',
    },
    loading: {
      title: 'Processing payment',
      message: 'Please wait while we confirm the payment.',
    },
    success: {
      title: 'Payment successful',
      message: 'The payment was completed.',
      transaction: 'Transaction ID',
      balance: 'New customer balance',
    },
    failure: {
      title: 'Payment not completed',
      noPayment: 'No payment was completed.',
      uncertain: 'We could not confirm the payment. Check the connection before trying again.',
      startOver: 'Start over',
    },
    validation: {
      amountRequired: 'Enter an amount before continuing.',
      amountInvalid: 'Enter a valid amount greater than ₹0.',
      amountOverLimit: 'Payments cannot be more than ₹100.',
      cardRequired: 'Enter or scan a card ID.',
      cardInvalid: 'Enter a supported Batwa card ID, such as CARD-TEST01.',
      pinRequired: 'Enter the customer’s four-digit PIN.',
      pinInvalid: 'PIN must be exactly four digits.',
    },
    failures: {
      LIMIT_EXCEEDED: {
        title: 'Amount is too high',
        message: 'This payment is above the ₹100 per-transaction limit.',
        action: 'Change amount',
      },
      CARD_NOT_FOUND: {
        title: 'Card not found',
        message: 'We could not find this card. Check the card and try again.',
        action: 'Scan another card',
      },
      BLOCKED_CARD: {
        title: 'Card is blocked',
        message: 'This card cannot be used for payments.',
        action: 'Scan another card',
      },
      WRONG_PIN: {
        title: 'PIN did not match',
        message: 'The PIN was not accepted. Ask the customer to try again.',
        action: 'Try PIN again',
      },
      INSUFFICIENT_BALANCE: {
        title: 'Not enough balance',
        message: 'This card does not have enough balance for this payment.',
        action: 'Scan another card',
      },
      MERCHANT_NOT_FOUND: {
        title: 'Merchant is unavailable',
        message: 'This merchant is not available right now. Please try again later.',
        action: 'Start new payment',
      },
      NETWORK_ERROR: {
        title: 'Connection problem',
        message: 'The payment service could not be reached.',
        action: 'Try again',
      },
      SERVER_ERROR: {
        title: 'Payment service problem',
        message: 'The payment service returned an unexpected response.',
        action: 'Try again',
      },
      UNKNOWN_FAILURE: {
        title: 'Payment could not be completed',
        message: 'Please try again or use another card.',
        action: 'Start new payment',
      },
    },
  },
}

export function getCopy(language = 'en') {
  return COPY[language] || COPY.en
}
