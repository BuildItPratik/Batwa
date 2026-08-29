import { test } from 'vitest'
import assert from 'node:assert/strict'
import { BASE_COPY, COPY, LANGUAGE_OPTIONS, getCopy } from '../src/i18n/copy'
import { flattenCopy } from '../src/i18n/translationService'

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

test('language options include Marathi and retain a synchronous English fallback', () => {
  for (const option of LANGUAGE_OPTIONS) {
    assert.ok(COPY[option.code], `COPY is missing language "${option.code}"`)
  }
  assert.equal(LANGUAGE_OPTIONS.some((option) => option.code === 'mr'), true)
  assert.equal(getCopy('mr'), BASE_COPY)
})

test('the English source tree contains non-empty string leaves', () => {
  const paths = collectKeyPaths(BASE_COPY)
  assert.ok(paths.length > 100)
  assert.equal(new Set(flattenCopy(BASE_COPY).keys()).size, flattenCopy(BASE_COPY).size)
})

test('unknown languages fall back to English', () => {
  assert.equal(getCopy('xx'), COPY.en)
  assert.equal(getCopy(), COPY.en)
})
