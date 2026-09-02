import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/LanguageContext'
import { AdminApiError, clearAdminToken, getAdminToken, getIssuedCards, type IssuedCard } from '../api/adminApi'
import { Button, Icon, StatusPanel } from '../components/ui/index'
import { formatRupees } from '../merchant/merchantFlow'

function parseTimestamp(value: string | null): Date | null {
  if (!value) return null
  const date = new Date(String(value).replace(' ', 'T') + 'Z')
  return Number.isNaN(date.getTime()) ? null : date
}

function formatIssuedOn(value: string | null, locale: string): string {
  const date = parseTimestamp(value)
  if (!date) return '—'
  return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' }) +
    ' · ' + date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

type StatusFilter = 'all' | 'active' | 'blocked'

export default function AdminCards() {
  const { copy, language } = useLanguage()
  const locale = `${language}-IN`
  const [token] = useState(getAdminToken)
  const [cards, setCards] = useState<IssuedCard[] | null>(null)
  const [total, setTotal] = useState(0)
  const [activeCount, setActiveCount] = useState(0)
  const [blockedCount, setBlockedCount] = useState(0)
  const [failed, setFailed] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [copied, setCopied] = useState<string | null>(null)
  const inFlightRef = useRef(false)

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    try {
      const data = await getIssuedCards(undefined, token || undefined)
      setCards(data.cards)
      setTotal(data.total)
      setActiveCount(data.active_cards)
      setBlockedCount(data.blocked_cards)
      setLastUpdated(new Date())
      setFailed(false)
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        clearAdminToken()
        // hard redirect to /admin to re-auth
        window.location.href = '/admin'
        return
      }
      setFailed(true)
    } finally {
      inFlightRef.current = false
    }
  }, [token])

  useEffect(() => {
    if (!token) {
      window.location.href = '/admin'
      return
    }
    refresh()
    const timer = window.setInterval(refresh, 5000)
    return () => window.clearInterval(timer)
  }, [token, refresh])

  const filtered = useMemo(() => {
    if (!cards) return []
    const q = search.trim().toLowerCase()
    return cards.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (!q) return true
      return (
        c.card_id.toLowerCase().includes(q) ||
        c.customer_id.toLowerCase().includes(q) ||
        (c.customer_name || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q)
      )
    })
  }, [cards, search, statusFilter])

  function handleCopy(value: string) {
    navigator.clipboard?.writeText(value).catch(() => {})
    setCopied(value)
    window.setTimeout(() => setCopied(null), 1400)
  }

  function handleExport() {
    if (!filtered.length) return
    const header = ['Card ID', 'Customer', 'Customer ID', 'Phone', 'Status', 'Balance', 'Language', 'Issued on']
    const rows = filtered.map((c) => [
      c.card_id,
      c.customer_name || '',
      c.customer_id,
      c.phone || '',
      c.status,
      String(c.balance),
      c.language_pref,
      c.created_at || '',
    ])
    const csv = [header, ...rows].map((r) => r.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `batwa-issued-cards-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!token) {
    return null
  }

  return (
    <div className="admin-page admin-cards-page">
      <div className="admin-page-header">
        <div>
          <Link to="/admin" className="admin-back-link">
            <Icon name="arrowLeft" size={16} /> {copy.admin.backToDashboard}
          </Link>
          <p className="batwa-eyebrow">{copy.admin.eyebrow}</p>
          <h1>{copy.admin.cardsTitle}</h1>
          <p className="admin-description">{copy.admin.cardsDescription}</p>
        </div>
        <div className="admin-refresh">
          <span className="admin-live-dot" aria-hidden="true" />
          <div>
            <span>{copy.admin.live}</span>
            {lastUpdated && <small>{copy.admin.updated} · {lastUpdated.toLocaleTimeString(locale)}</small>}
          </div>
          <div className="admin-refresh-actions">
            <Button variant="quiet" onClick={refresh}>{copy.admin.refresh}</Button>
            <Button variant="quiet" onClick={() => { clearAdminToken(); window.location.href = '/admin' }}>{copy.admin.lock}</Button>
          </div>
        </div>
      </div>

      {failed && <StatusPanel variant="error" title={copy.admin.cardsError} />}

      {/* Summary strip */}
      <div className="admin-cards-summary" aria-live="polite">
        <div className="admin-cards-summary-main">
          <strong>{total}</strong>
          <span>{copy.admin.totalIssued} · {copy.admin.issuedCardsCount}</span>
          <small>{activeCount} {copy.admin.filterActive} · {blockedCount} {copy.admin.filterBlocked}</small>
        </div>
        <div className="admin-cards-summary-actions">
          <Button variant="secondary" onClick={handleExport} disabled={!filtered.length}>
            <Icon name="receipt" size={16} /> {copy.admin.exportCsv}
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className="admin-cards-controls">
        <label className="admin-search">
          <Icon name="scan" size={18} />
          <input
            type="search"
            placeholder={copy.admin.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={copy.admin.searchPlaceholder}
          />
          {search && (
            <button type="button" className="admin-search-clear" onClick={() => setSearch('')} aria-label="Clear">
              <Icon name="close" size={14} />
            </button>
          )}
        </label>

        <div className="admin-filter-pills" role="tablist" aria-label="Card status filter">
          {(['all', 'active', 'blocked'] as StatusFilter[]).map((key) => {
            const isActive = statusFilter === key
            const label = key === 'all' ? copy.admin.filterAll : key === 'active' ? copy.admin.filterActive : copy.admin.filterBlocked
            const count = key === 'all' ? total : key === 'active' ? activeCount : blockedCount
            return (
              <button
                key={key}
                role="tab"
                aria-selected={isActive}
                className={`admin-pill ${isActive ? 'is-active' : ''}`}
                onClick={() => setStatusFilter(key)}
                type="button"
              >
                {label} <span className="admin-pill-count">{count}</span>
              </button>
            )
          })}
        </div>

        <div className="admin-showing">
          {cards !== null && (
            <span>
              {copy.admin.showing} <strong>{filtered.length}</strong> {copy.admin.of} <strong>{total}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      {cards === null && !failed && (
        <div className="admin-cards-loading">
          <div className="batwa-spinner" aria-hidden="true" />
          <p>{copy.admin.loadingCards}</p>
        </div>
      )}

      {cards !== null && filtered.length === 0 && (
        <p className="admin-empty">{copy.admin.noMatchingCards}</p>
      )}

      {filtered.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="admin-cards-table-wrap">
            <table className="admin-cards-table">
              <thead>
                <tr>
                  <th>{copy.admin.cardId}</th>
                  <th>{copy.admin.customerName}</th>
                  <th>{copy.admin.customerId}</th>
                  <th>{copy.admin.phone}</th>
                  <th>{copy.admin.status}</th>
                  <th>{copy.admin.balance}</th>
                  <th>{copy.admin.language}</th>
                  <th>{copy.admin.issuedOn}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((card) => {
                  const initials = (card.customer_name || card.customer_id).slice(0, 2).toUpperCase()
                  const isActive = card.status === 'active'
                  return (
                    <tr key={card.card_id}>
                      <td>
                        <button className="admin-mono admin-copy-btn" onClick={() => handleCopy(card.card_id)} title={copied === card.card_id ? copy.admin.copied : copy.admin.copyId}>
                          {card.card_id}
                          <span className="admin-copy-icon" aria-hidden="true">
                            {copied === card.card_id ? <Icon name="check" size={12} /> : <Icon name="card" size={12} />}
                          </span>
                        </button>
                      </td>
                      <td>
                        <span className="admin-customer-cell">
                          <span className="admin-avatar" aria-hidden="true">{initials}</span>
                          <span>
                            <strong>{card.customer_name || '—'}</strong>
                            <small className="admin-lang">{card.language_pref.toUpperCase()}</small>
                          </span>
                        </span>
                      </td>
                      <td>
                        <button className="admin-mono admin-copy-btn" onClick={() => handleCopy(card.customer_id)} title={copied === card.customer_id ? copy.admin.copied : copy.admin.copyId}>
                          {card.customer_id}
                        </button>
                      </td>
                      <td className="admin-mono">{card.phone || '—'}</td>
                      <td>
                        <span className={`admin-chip ${isActive ? 'admin-chip-success' : 'admin-chip-failed'}`}>
                          <Icon name={isActive ? 'check' : 'close'} size={12} />
                          {isActive ? copy.admin.filterActive : copy.admin.filterBlocked}
                        </span>
                      </td>
                      <td><strong>{formatRupees(card.balance, locale)}</strong></td>
                      <td>
                        <span className="admin-lang-pill">{card.language_pref}</span>
                      </td>
                      <td className="admin-date">{formatIssuedOn(card.created_at, locale)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="admin-cards-mobile">
            {filtered.map((card) => {
              const initials = (card.customer_name || card.customer_id).slice(0, 2).toUpperCase()
              const isActive = card.status === 'active'
              return (
                <article key={card.card_id} className={`admin-mobile-card ${isActive ? 'is-active' : 'is-blocked'}`}>
                  <div className="admin-mobile-card-head">
                    <span className="admin-avatar">{initials}</span>
                    <div>
                      <strong>{card.customer_name || '—'}</strong>
                      <span className="admin-mono">{card.card_id}</span>
                    </div>
                    <span className={`admin-chip ${isActive ? 'admin-chip-success' : 'admin-chip-failed'}`}>
                      <Icon name={isActive ? 'check' : 'close'} size={12} />
                      {card.status}
                    </span>
                  </div>
                  <dl className="admin-mobile-card-grid">
                    <div><dt>{copy.admin.customerId}</dt><dd className="admin-mono">{card.customer_id}</dd></div>
                    <div><dt>{copy.admin.phone}</dt><dd className="admin-mono">{card.phone || '—'}</dd></div>
                    <div><dt>{copy.admin.balance}</dt><dd><strong>{formatRupees(card.balance, locale)}</strong></dd></div>
                    <div><dt>{copy.admin.language}</dt><dd>{card.language_pref}</dd></div>
                    <div className="full"><dt>{copy.admin.issuedOn}</dt><dd>{formatIssuedOn(card.created_at, locale)}</dd></div>
                  </dl>
                </article>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
