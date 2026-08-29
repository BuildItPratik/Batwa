import { useCallback, useEffect, useRef, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import { getAdminStats, getTransactions, type AdminStats, type TransactionItem } from '../api/adminApi'
import type { FailureCopy } from '../i18n/copy'
import { formatRupees } from '../merchant/merchantFlow'
import { Button, Icon, StatusPanel } from '../components/ui/index'

const REFRESH_MS = 5000
const FEED_LIMIT = 30

// SQLite CURRENT_TIMESTAMP is UTC — mark it so the browser localizes correctly.
function parseTimestamp(value: string | null): Date | null {
  if (!value) return null
  const date = new Date(String(value).replace(' ', 'T') + 'Z')
  return Number.isNaN(date.getTime()) ? null : date
}

function formatTime(value: string | null): string {
  const date = parseTimestamp(value)
  if (!date) return value || '—'
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function AdminDashboard() {
  const { copy } = useLanguage()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [transactions, setTransactions] = useState<TransactionItem[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const inFlightRef = useRef(false)

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    try {
      const [nextStats, nextTxns] = await Promise.all([getAdminStats(), getTransactions()])
      setStats(nextStats)
      setTransactions(nextTxns.transactions || [])
      setLastUpdated(new Date())
      setFailed(false)
    } catch {
      setFailed(true) // keep showing the last good data; the interval retries
    } finally {
      inFlightRef.current = false
    }
  }, [])

  useEffect(() => {
    refresh()
    const timer = window.setInterval(refresh, REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [refresh])

  const totals: { key: 'cashDigitized' | 'paymentsReceived' | 'activeCards' | 'blockedCards'; icon: string; value: string | null }[] = [
    { key: 'cashDigitized', icon: 'cash', value: stats ? formatRupees(stats.cash_digitized) : null },
    { key: 'paymentsReceived', icon: 'wallet', value: stats ? formatRupees(stats.payments_received) : null },
    { key: 'activeCards', icon: 'card', value: stats ? String(stats.active_cards) : null },
    { key: 'blockedCards', icon: 'shield', value: stats ? String(stats.blocked_cards) : null },
  ]

  const feed = (transactions || []).slice(0, FEED_LIMIT)

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="batwa-eyebrow">{copy.admin.eyebrow}</p>
          <h1>{copy.admin.title}</h1>
          <p className="admin-description">{copy.admin.description}</p>
        </div>
        <div className="admin-refresh">
          <span className="admin-live-dot" aria-hidden="true" />
          <div>
            <span>{copy.admin.live}</span>
            {lastUpdated && <small>{copy.admin.updated} · {lastUpdated.toLocaleTimeString()}</small>}
          </div>
          <Button variant="quiet" onClick={refresh}>{copy.admin.refresh}</Button>
        </div>
      </div>

      {failed && <StatusPanel variant="error" title={copy.admin.loadError} />}

      <div className="admin-totals" aria-live="polite">
        {totals.map((total) => (
          <article className={`admin-total-card admin-total-${total.key}`} key={total.key}>
            <span className="admin-total-icon"><Icon name={total.icon} size={24} /></span>
            <strong>{total.value ?? '…'}</strong>
            <span className="admin-total-label">{copy.admin[total.key]}</span>
          </article>
        ))}
      </div>

      <section className="admin-feed" aria-label={copy.admin.feedTitle}>
        <h2>{copy.admin.feedTitle}</h2>
        {transactions !== null && feed.length === 0 && <p className="admin-empty">{copy.admin.empty}</p>}
        {feed.length > 0 && (
          <div className="admin-feed-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">{copy.admin.time}</th>
                  <th scope="col">{copy.admin.type}</th>
                  <th scope="col">{copy.admin.amount}</th>
                  <th scope="col">{copy.admin.customer}</th>
                  <th scope="col">{copy.admin.counterparty}</th>
                  <th scope="col">{copy.admin.status}</th>
                </tr>
              </thead>
              <tbody>
                {feed.map((txn) => {
                  const ok = txn.status === 'SUCCESS'
                  // Show the raw code when a backend failure_reason has no copy yet.
                  const failures = copy.failures as Record<string, FailureCopy>
                  const reason = !ok && txn.failure_reason
                    ? (failures[txn.failure_reason]?.title || txn.failure_reason)
                    : null
                  return (
                    <tr key={txn.txn_id}>
                      <td>{formatTime(txn.timestamp)}</td>
                      <td>{copy.admin.types[txn.type] || txn.type}</td>
                      <td>{typeof txn.amount === 'number' ? formatRupees(txn.amount) : '—'}</td>
                      <td className="admin-mono">{txn.customer_id || '—'}</td>
                      <td className="admin-mono">{txn.counterparty_id || '—'}</td>
                      <td>
                        <span className={ok ? 'admin-chip admin-chip-success' : 'admin-chip admin-chip-failed'}>
                          <Icon name={ok ? 'check' : 'close'} size={14} />
                          {copy.admin.statuses[txn.status] || txn.status}
                        </span>
                        {reason && <span className="admin-chip-reason">{reason}</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
