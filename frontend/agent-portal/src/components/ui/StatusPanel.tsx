import type { ReactNode } from 'react'

export type StatusVariant = 'success' | 'error' | 'warning' | 'info'

const ICONS: Record<StatusVariant, string> = {
  success: '✓',
  error: '!',
  warning: '!',
  info: 'i',
}

export interface StatusPanelProps {
  variant?: StatusVariant
  title: ReactNode
  children?: ReactNode
  className?: string
}

export default function StatusPanel({ variant = 'info', title, children, className = '' }: StatusPanelProps) {
  const role = variant === 'error' ? 'alert' : 'status'
  return (
    <section className={'batwa-status batwa-status-' + variant + ' ' + className.trim()} role={role}>
      <span className="batwa-status-icon" aria-hidden="true">
        {ICONS[variant] || ICONS.info}
      </span>
      <div>
        <h3>{title}</h3>
        {children && <div className="batwa-status-body">{children}</div>}
      </div>
    </section>
  )
}
