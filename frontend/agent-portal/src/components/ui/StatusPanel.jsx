const ICONS = {
  success: '✓',
  error: '!',
  warning: '!',
  info: 'i',
}

export default function StatusPanel({ variant = 'info', title, children, className = '' }) {
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
