import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getCopy, LANGUAGE_OPTIONS, type Copy, type LanguageCode } from './copy'

export interface LanguageContextValue {
  language: LanguageCode
  setLanguage: (code: LanguageCode) => void
  copy: Copy
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

  function setLanguage(code: LanguageCode) {
    setLanguageState(code)
    try {
      window.localStorage.setItem(STORAGE_KEY, code)
    } catch {
      // The choice simply resets next visit when storage is unavailable.
    }
  }

  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = language
  }, [language])

  const copy = useMemo(() => getCopy(language), [language])

  const value = useMemo(
    () => ({ language, setLanguage, copy }),
    [copy, language],
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
