import { test } from 'vitest'
import assert from 'node:assert/strict'
import { joinAppPath, normalizeBasePath } from '../src/config/appBase'

test('normalizes root and deployed base URLs', () => {
  assert.equal(normalizeBasePath('/'), undefined)
  assert.equal(normalizeBasePath('/Batwa/'), '/Batwa')
  assert.equal(normalizeBasePath('Batwa'), '/Batwa')
  assert.equal(normalizeBasePath('./'), undefined)
})

test('joins navigation paths inside the deployed application', () => {
  assert.equal(joinAppPath('/admin', '/Batwa'), '/Batwa/admin')
  assert.equal(joinAppPath('admin', '/Batwa/'), '/Batwa/admin')
  assert.equal(joinAppPath('/', undefined), '/')
})
