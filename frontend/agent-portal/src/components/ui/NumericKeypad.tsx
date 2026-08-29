const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

export interface NumericKeypadProps {
  value?: string
  onChange: (value: string) => void
  allowDecimal?: boolean
  maxLength?: number
  masked?: boolean
  disabled?: boolean
  label?: string
  clearLabel?: string
  deleteLabel?: string
}

export default function NumericKeypad({
  value = '',
  onChange,
  allowDecimal = false,
  maxLength = 4,
  masked = false,
  disabled = false,
  label = 'Numeric keypad',
  clearLabel = 'Clear value',
  deleteLabel = 'Delete last digit',
}: NumericKeypadProps) {
  const keys = allowDecimal ? [...DIGITS, '.', '0', 'backspace'] : [...DIGITS, 'clear', '0', 'backspace']

  function press(key: string) {
    if (disabled) return
    if (key === 'clear') {
      onChange('')
      return
    }
    if (key === 'backspace') {
      onChange(value.slice(0, -1))
      return
    }
    if (key === '.' && (!allowDecimal || value.includes('.'))) return
    if (value.length >= maxLength) return
    onChange(value + key)
  }

  return (
    <div className="batwa-keypad" role="group" aria-label={label}>
      {keys.map((key) => {
        const isUtility = key === 'clear' || key === 'backspace'
        const display = key === 'backspace' ? '⌫' : key === 'clear' ? clearLabel : key
        const ariaLabel =
          key === 'backspace' ? deleteLabel : key === 'clear' ? clearLabel : key

        return (
          <button
            className={'batwa-key' + (isUtility ? ' batwa-key-utility' : '')}
            key={key}
            type="button"
            onClick={() => press(key)}
            disabled={disabled}
            aria-label={ariaLabel}
          >
            {masked && !isUtility && key !== '.' ? '•' : display}
          </button>
        )
      })}
    </div>
  )
}
