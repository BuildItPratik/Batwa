export const DEMO_CARD_ID = 'CARD-TEST01'

export const DEMO_MERCHANTS = [
  { id: 'MER-001', name: 'Annapurna Vegetables' },
  { id: 'MER-002', name: 'Ravi Tea Stall' },
]

export function getDemoMerchant(merchantId) {
  return DEMO_MERCHANTS.find((merchant) => merchant.id === merchantId) || DEMO_MERCHANTS[0]
}

export function getCardEntryPaths(demoMode) {
  const paths = ['camera', 'manual']
  if (demoMode) paths.push('demo')
  return paths
}
