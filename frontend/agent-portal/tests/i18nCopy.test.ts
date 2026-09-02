import { test } from 'vitest'
import assert from 'node:assert/strict'
import { BASE_COPY, COPY, LANGUAGE_OPTIONS, getCopy } from '../src/i18n/copy'

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

test('every supported language carries the full copy tree', () => {
  const englishPaths = collectKeyPaths(BASE_COPY)
  assert.ok(englishPaths.length > 100)

  for (const option of LANGUAGE_OPTIONS) {
    const localePaths = collectKeyPaths(COPY[option.code])
    assert.deepEqual(localePaths, englishPaths, `${option.code} keys must match English`)
  }
})

test('unknown languages fall back to English', () => {
  assert.equal(getCopy('xx'), COPY.en)
  assert.equal(getCopy(), COPY.en)
})

test('non-English locales are not identical to English', () => {
  assert.notEqual(COPY.hi.common.back, COPY.en.common.back)
  assert.notEqual(COPY.ta.common.back, COPY.en.common.back)
  assert.notEqual(COPY.mr.common.back, COPY.en.common.back)
})
