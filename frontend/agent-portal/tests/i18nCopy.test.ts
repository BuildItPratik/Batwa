import { test } from 'vitest'
import assert from 'node:assert/strict'
import { COPY, LANGUAGE_OPTIONS, getCopy } from '../src/i18n/copy'

function collectKeyPaths(tree: object, prefix = ''): string[] {
  const paths: string[] = []
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object') {
      paths.push(...collectKeyPaths(value as object, path))
    } else {
      paths.push(path)
      assert.equal(typeof value, 'string', `${path} must be a string`)
      assert.ok(value.trim().length > 0, `${path} must not be empty`)
    }
  }
  return paths.sort()
}

test('every language option has a full copy tree (no silent English fallback)', () => {
  for (const option of LANGUAGE_OPTIONS) {
    assert.ok(COPY[option.code], `COPY is missing language "${option.code}"`)
  }
})

test('hi and ta stay key-for-key in sync with en', () => {
  const enKeys = collectKeyPaths(COPY.en)
  for (const code of ['hi', 'ta'] as const) {
    const langKeys = collectKeyPaths(COPY[code])
    const missing = enKeys.filter((key) => !langKeys.includes(key))
    const extra = langKeys.filter((key) => !enKeys.includes(key))
    assert.deepEqual(missing, [], `${code} is missing keys`)
    assert.deepEqual(extra, [], `${code} has keys en does not`)
  }
})

test('unknown languages fall back to English', () => {
  assert.equal(getCopy('xx'), COPY.en)
  assert.equal(getCopy(), COPY.en)
})
