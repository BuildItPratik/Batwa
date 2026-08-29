export interface Merchant {
  id: string
  name: string
}

export const DEMO_CARD_ID = 'CARD-TEST01'

export const DEMO_MERCHANTS: Merchant[] = [
  { id: 'MER-001', name: 'Annapurna Vegetables' },
  { id: 'MER-002', name: 'Ravi Tea Stall' },
]

export function getDemoMerchant(merchantId?: string | null): Merchant {
  return DEMO_MERCHANTS.find((merchant) => merchant.id === merchantId) || DEMO_MERCHANTS[0]
}

export type CardEntryPath = 'camera' | 'manual' | 'demo'

export function getCardEntryPaths(demoMode: boolean): CardEntryPath[] {
  const paths: CardEntryPath[] = ['camera', 'manual']
  if (demoMode) paths.push('demo')
  return paths
}
