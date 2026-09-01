export type LanguageCode = 'en' | 'hi' | 'ta' | 'mr'

export interface LanguageOption {
  code: LanguageCode
  label: string
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'mr', label: 'मराठी' },
]

export type { Copy } from './locales/en'
export { en } from './locales/en'
import { en, type Copy } from './locales/en'
import { hi } from './locales/hi'
import { ta } from './locales/ta'
import { mr } from './locales/mr'

export const BASE_COPY: Copy = en

export const COPY: Record<LanguageCode, Copy> = { en, hi, ta, mr }

export type FailureCopy = Copy['failures'][keyof Copy['failures']]

export function getCopy(language: string = 'en'): Copy {
  return COPY[language as LanguageCode] || COPY.en
}
