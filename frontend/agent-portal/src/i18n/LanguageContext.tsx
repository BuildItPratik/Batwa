import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { LANGUAGE_OPTIONS, type Copy, type LanguageCode } from './copy'
import { getCachedTranslationState, translateCopy } from './translationService'

export interface LanguageContextValue {
  language: LanguageCode
  setLanguage: (code: LanguageCode) => void
  copy: Copy
  isTranslating: boolean
  translationError: boolean
}

const LanguageContext = createContext<LanguageContextValue | null>(null)
const STORAGE_KEY = 'batwa.language'

function isLanguageCode(value: string | null): value is LanguageCode {
  return Boolean(value && LANGUAGE_OPTIONS.some((option) => option.code === value))
}

function getStoredLanguage(): LanguageCode {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (isLanguageCode(stored)) return stored
  } catch {
    // Private browsing and embedded previews may deny local storage.
  }

  if (typeof navigator !== 'undefined') {
    const browserLanguage = navigator.language.split('-')[0]
    if (isLanguageCode(browserLanguage)) return browserLanguage
  }
  return 'en'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(getStoredLanguage)
  const [copy, setCopy] = useState<Copy>(() => getCachedTranslationState(language).copy)
  const [isTranslating, setIsTranslating] = useState(() => getCachedTranslationState(language).pendingCount > 0)
  const [translationError, setTranslationError] = useState(false)

  function setLanguage(code: LanguageCode) {
    setLanguageState(code)
    const cached = getCachedTranslationState(code)
    setCopy(cached.copy)
    setIsTranslating(code !== 'en' && cached.pendingCount > 0)
    setTranslationError(false)
    try {
      window.localStorage.setItem(STORAGE_KEY, code)
    } catch {
      // The choice simply resets next visit when storage is unavailable.
    }
  }

  useEffect(() => {
    let alive = true
    const cached = getCachedTranslationState(language)
    setCopy(cached.copy)
    setIsTranslating(language !== 'en' && cached.pendingCount > 0)
    setTranslationError(false)

    if (language !== 'en' && cached.pendingCount > 0) {
      void translateCopy(language)
        .then((result) => {
          if (!alive) return
          setCopy(result.copy)
          setIsTranslating(false)
          setTranslationError(result.failedCount > 0)
        })
        .catch(() => {
          if (!alive) return
          setIsTranslating(false)
          setTranslationError(true)
        })
    }

    return () => {
      alive = false
    }
  }, [language])

  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = language
  }, [language])

  const value = useMemo(
    () => ({ language, setLanguage, copy, isTranslating, translationError }),
    [copy, isTranslating, language, translationError],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used inside LanguageProvider')
  }
  return context
}
