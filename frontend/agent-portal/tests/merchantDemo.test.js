import test from 'node:test'
import assert from 'node:assert/strict'
import { DEMO_MERCHANTS, getCardEntryPaths, getDemoMerchant } from '../src/config/merchantDemo.js'

test('demo merchant catalogue matches the seeded identities and has a safe default', () => {
  assert.deepEqual(DEMO_MERCHANTS, [
    { id: 'MER-001', name: 'Annapurna Vegetables' },
    { id: 'MER-002', name: 'Ravi Tea Stall' },
  ])
  assert.deepEqual(getDemoMerchant('MER-002'), { id: 'MER-002', name: 'Ravi Tea Stall' })
  assert.deepEqual(getDemoMerchant('unknown'), DEMO_MERCHANTS[0])
})

test('card entry paths keep manual access in every mode and hide demo card in normal mode', () => {
  assert.deepEqual(getCardEntryPaths(false), ['camera', 'manual'])
  assert.deepEqual(getCardEntryPaths(true), ['camera', 'manual', 'demo'])
})
