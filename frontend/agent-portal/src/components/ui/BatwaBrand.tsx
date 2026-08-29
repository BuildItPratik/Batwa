export interface BatwaBrandProps {
  compact?: boolean
  descriptor?: string
}

export default function BatwaBrand({ compact = false, descriptor = 'Phone-free payments, made familiar' }: BatwaBrandProps) {
  return (
    <div className={'batwa-brand' + (compact ? ' batwa-brand-compact' : '')} aria-label="Batwa">
      <span className="batwa-brand-wordmark" lang="hi">
        बटवा
      </span>
      <span className="batwa-brand-sublabel">Batwa</span>
      {!compact && <span className="batwa-brand-descriptor">{descriptor}</span>}
    </div>
  )
}
