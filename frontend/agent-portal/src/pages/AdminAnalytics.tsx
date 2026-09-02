import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/LanguageContext'
import {
  AdminApiError,
  clearAdminToken,
  getAdminToken,
  getAnalytics,
  type AnalyticsResponse,
  type AnalyticsDailyVolumeRow,
} from '../api/adminApi'
import { Button, Icon, StatusPanel } from '../components/ui/index'
import BarChart, { type BarSeries } from '../components/charts/BarChart'
import HBarChart from '../components/charts/HBarChart'
import { formatRupees } from '../merchant/merchantFlow'
import type { FailureCopy } from '../i18n/copy'

// Live view — refresh as often as the admin dashboard polls its totals.
const REFRESH_MS = 5000

// date_key is a plain YYYY-MM-DD gold-layer key — parse it as a local date.
function formatDay(dateKey: string, locale: string): string {
  const date = new Date(`${dateKey}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? dateKey
    : date.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
}

// Compact ₹ for axis ticks: ₹1.5k instead of ₹1,500.00.
function formatRupeesCompact(value: number): string {
  if (value >= 1000) return `₹${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`
  return `₹${value}`
}

export default function AdminAnalytics() {
  const { copy, language } = useLanguage()
  const locale = `${language}-IN`
  const [token] = useState(getAdminToken)
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const refresh = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const next = await getAnalytics(token)
      setData(next)
      setFailed(false)
      setLastUpdated(new Date())
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        clearAdminToken()
        window.location.href = '/admin'
        return
      }
      setFailed(true) // keep showing the last good data; the poll retries
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (!token) {
      window.location.href = '/admin'
      return
    }
    refresh()
    const timer = window.setInterval(refresh, REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [token, refresh])

  // Daily volume: successful top-up and payment amounts per day.
  const daily = useMemo(() => {
    const byDate = new Map<string, { topup: number; payment: number }>()
    for (const row of (data?.daily_volume ?? []) as AnalyticsDailyVolumeRow[]) {
      if (row.status !== 'SUCCESS' || (row.type !== 'TOPUP' && row.type !== 'PAYMENT')) continue
      const bucket = byDate.get(row.date_key) ?? { topup: 0, payment: 0 }
      if (row.type === 'TOPUP') bucket.topup += row.amount_total
      else bucket.payment += row.amount_total
      byDate.set(row.date_key, bucket)
    }
    const dates = [...byDate.keys()].sort()
    return {
      labels: dates.map((d) => formatDay(d, locale)),
      topups: dates.map((d) => byDate.get(d)?.topup ?? 0),
      payments: dates.map((d) => byDate.get(d)?.payment ?? 0),
    }
  }, [data, locale])

  const failureRows = useMemo(() => {
    const failures = copy.failures as Record<string, FailureCopy>
    return (data?.failure_by_reason ?? []).map((row) => ({
      label: row.failure_reason ? (failures[row.failure_reason]?.title || row.failure_reason) : '—',
      value: row.attempts,
    }))
  }, [data, copy.failures])

  if (!token) {
    return null
  }

  const kpis = data?.kpis

  const tiles: { key: string; icon: string; value: string | null }[] = [
    { key: 'cashDigitized', icon: 'cash', value: kpis ? formatRupees(kpis.cash_digitized, locale) : null },
    { key: 'paymentsReceived', icon: 'wallet', value: kpis ? formatRupees(kpis.payments_received, locale) : null },
    { key: 'txnCount', icon: 'receipt', value: kpis ? String(kpis.txn_count) : null },
    { key: 'activeCustomers', icon: 'card', value: kpis ? String(kpis.active_customers) : null },
  ]

  const series: BarSeries[] = [
    { label: copy.admin.legendTopup, color: 'var(--workspace-terracotta, #c96f4a)', values: daily.topups },
    { label: copy.admin.legendPayment, color: 'var(--workspace-indigo, #3d4a78)', values: daily.payments },
  ]

  return (
    <div className="admin-page admin-analytics-page">
      <div className="admin-page-header">
        <div>
          <Link to="/admin" className="admin-back-link">
            <Icon name="arrowLeft" size={16} /> {copy.admin.backToDashboard}
          </Link>
          <p className="batwa-eyebrow">{copy.admin.eyebrow}</p>
          <h1>{copy.admin.analyticsTitle}</h1>
          <p className="admin-description">{copy.admin.analyticsDescription}</p>
        </div>
        <div className="admin-refresh">
          <span className="admin-live-dot" aria-hidden="true" />
          <div>
            <span>{copy.admin.analyticsBatchHint}</span>
            {lastUpdated && <small>{copy.admin.updated} · {lastUpdated.toLocaleTimeString(locale)}</small>}
          </div>
          <div className="admin-refresh-actions">
            <Button variant="quiet" onClick={refresh} disabled={loading}>{copy.admin.refresh}</Button>
            <Button variant="quiet" onClick={() => { clearAdminToken(); window.location.href = '/admin' }}>{copy.admin.lock}</Button>
          </div>
        </div>
      </div>

      {failed && <StatusPanel variant="error" title={copy.admin.analyticsError} />}

      {data && kpis && kpis.txn_count === 0 && (
        <p className="admin-empty">{copy.admin.analyticsEmpty}</p>
      )}

      {data && (
        <>
          <div className="admin-totals" aria-live="polite">
            {tiles.map((tile) => (
              <article className={`admin-total-card admin-total-${tile.key}`} key={tile.key}>
                <span className="admin-total-icon"><Icon name={tile.icon} size={24} /></span>
                <strong>{tile.value ?? '…'}</strong>
                <span className="admin-total-label">{copy.admin[tile.key as 'cashDigitized']}</span>
                {tile.key === 'txnCount' && kpis && (
                  <span className="admin-total-sub">
                    {kpis.success_count} {copy.admin.txnOk} · {kpis.failed_count} {copy.admin.txnFailed}
                  </span>
                )}
                {tile.key === 'activeCustomers' && kpis && (
                  <span className="admin-total-sub">
                    {kpis.active_cards} {copy.admin.activeCards.toLowerCase()} · {kpis.blocked_cards} {copy.admin.blockedCards.toLowerCase()}
                  </span>
                )}
              </article>
            ))}
          </div>

          <section className="admin-chart-card" aria-label={copy.admin.dailyVolumeTitle}>
            <div className="admin-chart-card-head">
              <h2>{copy.admin.dailyVolumeTitle}</h2>
              <div className="admin-chart-legend" aria-hidden="true">
                <span><i style={{ background: 'var(--workspace-terracotta, #c96f4a)' }} /> {copy.admin.legendTopup}</span>
                <span><i style={{ background: 'var(--workspace-indigo, #3d4a78)' }} /> {copy.admin.legendPayment}</span>
              </div>
            </div>
            {daily.labels.length > 0 ? (
              <BarChart
                labels={daily.labels}
                series={series}
                formatValue={(n) => formatRupees(n, locale)}
                formatTick={formatRupeesCompact}
                ariaLabel={copy.admin.dailyVolumeTitle}
              />
            ) : (
              <p className="admin-empty">{copy.admin.noVolume}</p>
            )}
          </section>

          <div className="admin-analytics-grid">
            <section className="admin-chart-card" aria-label={copy.admin.failuresTitle}>
              <div className="admin-chart-card-head">
                <h2>{copy.admin.failuresTitle}</h2>
                {kpis && (
                  <span className={`admin-chip ${kpis.failed_count > 0 ? 'admin-chip-failed' : 'admin-chip-success'}`}>
                    <Icon name={kpis.failed_count > 0 ? 'close' : 'check'} size={12} />
                    {kpis.failed_count}
                  </span>
                )}
              </div>
              {failureRows.length > 0 ? (
                <HBarChart rows={failureRows} ariaLabel={copy.admin.failuresTitle} />
              ) : (
                <p className="admin-empty">{copy.admin.noFailures}</p>
              )}
            </section>

            <section className="admin-chart-card" aria-label={copy.admin.topMerchantsTitle}>
              <div className="admin-chart-card-head">
                <h2>{copy.admin.topMerchantsTitle}</h2>
              </div>
              {(data?.top_merchants ?? []).length > 0 ? (
                <div className="admin-feed-scroll">
                  <table className="admin-merchants-table">
                    <thead>
                      <tr>
                        <th scope="col">{copy.admin.merchantCol}</th>
                        <th scope="col">{copy.admin.paymentsCol}</th>
                        <th scope="col">{copy.admin.receivedCol}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.top_merchants ?? []).map((m) => (
                        <tr key={m.merchant_name}>
                          <td><strong>{m.merchant_name}</strong></td>
                          <td>{m.payments}</td>
                          <td><strong>{formatRupees(m.total_received, locale)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="admin-empty">{copy.admin.noMerchants}</p>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}
