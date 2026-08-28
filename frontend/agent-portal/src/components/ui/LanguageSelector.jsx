import { LANGUAGE_OPTIONS } from '../../i18n/copy.js'

export default function LanguageSelector({ value, onChange, label = 'Language' }) {
  return (
    <label className="batwa-language">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
        {LANGUAGE_OPTIONS.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
