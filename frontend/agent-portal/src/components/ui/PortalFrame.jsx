export default function PortalFrame({ eyebrow, title, description, children, className = '', headingRef }) {
  return (
    <section className={`batwa-panel ${className}`.trim()} aria-labelledby="page-title">
      <div className="batwa-panel-heading">
        {eyebrow && <p className="batwa-eyebrow">{eyebrow}</p>}
        <h1 id="page-title" ref={headingRef} tabIndex={-1}>{title}</h1>
        {description && <p className="batwa-lede">{description}</p>}
      </div>
      {children}
    </section>
  )
}
