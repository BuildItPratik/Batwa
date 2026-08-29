import { useEffect, useRef, useState } from 'react'
import { LANGUAGE_OPTIONS, type LanguageCode } from '../../i18n/copy'
import Icon from './Icon'

export interface LanguageMenuProps {
  value: LanguageCode
  onChange: (code: LanguageCode) => void
}

export default function LanguageMenu({ value, onChange }: LanguageMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const current = LANGUAGE_OPTIONS.find((option) => option.code === value) || LANGUAGE_OPTIONS[0]

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  function choose(code: LanguageCode) {
    onChange(code)
    setOpen(false)
  }

  return (
    <div className="language-menu" ref={rootRef}>
      <button className="language-trigger" type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((currentOpen) => !currentOpen)}>
        <Icon name="globe" size={20} />
        <span>{current.label}</span>
        <Icon name="chevronDown" size={16} />
      </button>
      {open && (
        <div className="language-popover" role="menu" aria-label="Choose language">
          {LANGUAGE_OPTIONS.map((option) => (
            <button className={option.code === value ? 'language-option is-selected' : 'language-option'} key={option.code} type="button" role="menuitemradio" aria-checked={option.code === value} onClick={() => choose(option.code)}>
              <span>{option.label}</span>
              {option.code === value && <Icon name="check" size={17} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
