import { BASE_COPY, type Copy, type LanguageCode } from './copy'

const CACHE_VERSION = 1
const CACHE_PREFIX = 'batwa.translation.'
const DEFAULT_ENDPOINT = 'https://api.mymemory.translated.net/get'
const REQUEST_CONCURRENCY = 4
const REQUEST_TIMEOUT_MS = 4000

type TranslationMap = Record<string, string>

interface CachedTranslations {
  version: number
  translations: TranslationMap
}

export interface CachedTranslationState {
  copy: Copy
  pendingCount: number
}

export interface TranslationResult {
  copy: Copy
  translatedCount: number
  failedCount: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function cacheKey(language: LanguageCode): string {
  return `${CACHE_PREFIX}${language}`
}

function readTranslations(language: LanguageCode): TranslationMap {
  const store = storage()
  if (!store) return {}

  try {
    const raw = store.getItem(cacheKey(language))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Partial<CachedTranslations>
    return parsed.version === CACHE_VERSION && isRecord(parsed.translations)
      ? Object.fromEntries(
          Object.entries(parsed.translations).filter(([, value]) => typeof value === 'string'),
        )
      : {}
  } catch {
    return {}
  }
}

function writeTranslations(language: LanguageCode, translations: TranslationMap) {
  const store = storage()
  if (!store) return

  try {
    store.setItem(cacheKey(language), JSON.stringify({ version: CACHE_VERSION, translations }))
  } catch {
    // Translation is best-effort when storage is full or unavailable.
  }
}

export function flattenCopy(tree: Copy): Map<string, string> {
  const leaves = new Map<string, string>()

  function visit(value: unknown) {
    if (typeof value === 'string') {
      leaves.set(value, value)
      return
    }
    if (!isRecord(value)) return
    Object.values(value).forEach(visit)
  }

  visit(tree)
  return leaves
}

function copyWithTranslations(tree: Copy, translations: TranslationMap): Copy {
  function visit(value: unknown): unknown {
    if (typeof value === 'string') return translations[value] || value
    if (!isRecord(value)) return value
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, visit(child)]))
  }

  return visit(tree) as Copy
}

function translatable(text: string): boolean {
  const value = text.trim()
  return /[A-Za-z]/.test(value) && value.length > 1 && !/^[A-Z0-9._/-]+$/.test(value)
}

function decodeHtmlEntities(value: string): string {
  if (typeof document !== 'undefined') {
    const element = document.createElement('textarea')
    element.innerHTML = value
    return element.value
  }

  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

async function translateText(text: string, language: LanguageCode): Promise<string> {
  const configuredEndpoint = import.meta.env.VITE_TRANSLATION_API_URL as string | undefined
  const url = new URL(configuredEndpoint || DEFAULT_ENDPOINT)
  url.searchParams.set('q', text)
  url.searchParams.set('langpair', `en|${language}`)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
  if (!response.ok) throw new Error(`Translation service returned ${response.status}`)

  const payload = (await response.json()) as {
    responseStatus?: number | string
    responseData?: { translatedText?: string }
    quotaFinished?: boolean
  }
  if (payload.quotaFinished || String(payload.responseStatus) !== '200') {
    throw new Error('Translation service quota is unavailable')
  }

  const translated = payload.responseData?.translatedText?.trim()
  if (!translated) throw new Error('Translation service returned empty text')
  return decodeHtmlEntities(translated)
}

export function getCachedTranslationState(language: LanguageCode): CachedTranslationState {
  if (language === 'en') return { copy: BASE_COPY, pendingCount: 0 }

  const translations = readTranslations(language)
  const source = flattenCopy(BASE_COPY)
  const pendingCount = [...source.keys()].filter(
    (text) => translatable(text) && !translations[text],
  ).length

  return { copy: copyWithTranslations(BASE_COPY, translations), pendingCount }
}

export async function translateCopy(language: LanguageCode): Promise<TranslationResult> {
  if (language === 'en') {
    return { copy: BASE_COPY, translatedCount: 0, failedCount: 0 }
  }

  const translations = readTranslations(language)
  const source = [...flattenCopy(BASE_COPY).keys()].filter(translatable)
  const pending = source.filter((text) => !translations[text])
  let nextIndex = 0
  let translatedCount = 0
  let failedCount = 0
  let stopRequests = false

  async function worker() {
    while (nextIndex < pending.length && !stopRequests) {
      const text = pending[nextIndex]
      nextIndex += 1
      try {
        translations[text] = await translateText(text, language)
        translatedCount += 1
      } catch {
        failedCount += 1
        // A few concurrent failures usually mean the service or network is
        // unavailable. Stop early and keep the untranslated English fallback.
        if (failedCount >= REQUEST_CONCURRENCY) stopRequests = true
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(REQUEST_CONCURRENCY, pending.length) }, () => worker()),
  )
  writeTranslations(language, translations)

  return {
    copy: copyWithTranslations(BASE_COPY, translations),
    translatedCount,
    failedCount,
  }
}
