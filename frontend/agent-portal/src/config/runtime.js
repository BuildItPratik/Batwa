import { DEMO_MERCHANTS, getDemoMerchant } from './merchantDemo.js'
const env = import.meta.env || {}

// Keep environment-backed values in one place. Backend names and contracts stay unchanged.
export const API_BASE_URL = env.VITE_API_BASE_URL || 'http://localhost:8000'
export const MERCHANT_ID = env.VITE_MERCHANT_ID || 'MER-001'
export const MERCHANT_NAME = env.VITE_MERCHANT_NAME || 'Annapurna Vegetables'
export const AGENT_ID = env.VITE_AGENT_ID || 'AGT-001'
export const AGENT_NAME = env.VITE_AGENT_NAME || 'Agent Priya - Downtown'
export const DEMO_MODE = env.VITE_DEMO_MODE === undefined
  ? true
  : String(env.VITE_DEMO_MODE).toLowerCase() === 'true'

const DEMO_MERCHANT_KEY = 'batwa.demoMerchantId'

export function getConfiguredMerchant() {
  if (!DEMO_MODE) return { id: MERCHANT_ID, name: MERCHANT_NAME }

  let selectedId = null
  try {
    selectedId = window.sessionStorage.getItem(DEMO_MERCHANT_KEY)
  } catch {
    // Private browsing and embedded previews may deny session storage.
  }

  return getDemoMerchant(selectedId)
}

// The backend has no authenticated agent-session endpoint yet. These defaults
// match seed.py and remain configurable for a real provisioned agent later.
export function getConfiguredAgent() {
  return { id: AGENT_ID, name: AGENT_NAME }
}

export function selectDemoMerchant(merchantId) {
  if (!DEMO_MODE || !DEMO_MERCHANTS.some((merchant) => merchant.id === merchantId)) return
  try {
    window.sessionStorage.setItem(DEMO_MERCHANT_KEY, merchantId)
  } catch {
    // The next route load falls back to MER-001 when session storage is unavailable.
  }
}

export function clearDemoMerchant() {
  try {
    window.sessionStorage.removeItem(DEMO_MERCHANT_KEY)
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
