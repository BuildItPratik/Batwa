import { LANGUAGE_OPTIONS, type LanguageCode } from '../../i18n/copy'

export interface LanguageSelectorProps {
  value: LanguageCode
  onChange: (code: LanguageCode) => void
  label?: string
}

export default function LanguageSelector({ value, onChange, label = 'Language' }: LanguageSelectorProps) {
  return (
    <label className="batwa-language">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value as LanguageCode)} aria-label={label}>
        {LANGUAGE_OPTIONS.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
