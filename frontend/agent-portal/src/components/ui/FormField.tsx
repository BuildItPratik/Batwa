import { cloneElement, type ReactElement, type ReactNode } from 'react'

export interface FormFieldProps {
  id: string
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  action?: ReactNode
  children: ReactElement<Record<string, unknown>>
}

export default function FormField({ id, label, hint, error, action, children }: FormFieldProps) {
  const hintId = id + '-hint'
  const errorId = id + '-error'
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ')

  const field = cloneElement(children, {
    id,
    'aria-describedby': describedBy || undefined,
    'aria-invalid': error ? 'true' : undefined,
  })

  return (
    <div className="batwa-field">
      <div className="batwa-field-label-row">
        <label className="batwa-field-label" htmlFor={id}>{label}</label>
        {action}
      </div>
      {field}
      {hint && (
        <p className="batwa-field-hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="batwa-field-error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
