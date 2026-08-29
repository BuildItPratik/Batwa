import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { COPY, getCopy, type Copy, type LanguageCode } from './copy'

export interface LanguageContextValue {
  language: LanguageCode
  setLanguage: (code: LanguageCode) => void
  copy: Copy
}

const LanguageContext = createContext<LanguageContextValue | null>(null)
const STORAGE_KEY = 'batwa.language'

function getStoredLanguage(): LanguageCode {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored && stored in COPY ? (stored as LanguageCode) : 'en'
  } catch {
    // Private browsing and embedded previews may deny local storage.
    return 'en'
  }
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

  const value = useMemo(
    () => ({ language, setLanguage, copy: getCopy(language) }),
    [language],
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
