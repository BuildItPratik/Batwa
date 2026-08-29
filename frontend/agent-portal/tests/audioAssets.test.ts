import { test } from 'vitest'
import assert from 'node:assert/strict'
import { existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { AUDIO_LANGUAGES, VOICE_PROMPT_KEYS, voicePromptUrl } from '../src/audio/sounds'

const AUDIO_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio')

function assertAudioFile(file: string) {
  assert.ok(existsSync(file), `missing audio asset: ${file}`)
  assert.ok(statSync(file).size > 500, `audio asset looks empty: ${file}`)
}

test('every language ships every pre-recorded voice prompt', () => {
  for (const lang of AUDIO_LANGUAGES) {
    for (const key of VOICE_PROMPT_KEYS) {
      assertAudioFile(path.join(AUDIO_DIR, lang, `${key}.mp3`))
    }
  }
})

test('result tones exist for success and failure', () => {
  assertAudioFile(path.join(AUDIO_DIR, 'success.mp3'))
  assertAudioFile(path.join(AUDIO_DIR, 'failure.mp3'))
})

test('voice prompt URLs stay on the /audio path and fall back to English', () => {
  assert.equal(voicePromptUrl('hi', 'enter_pin'), '/audio/hi/enter_pin.mp3')
  assert.equal(voicePromptUrl('mr', 'enter_pin'), '/audio/mr/enter_pin.mp3')
  assert.equal(voicePromptUrl('xx', 'enter_pin'), '/audio/en/enter_pin.mp3')
})
