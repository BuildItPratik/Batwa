"""
Batwa — Live analytics over the operational database

Computes the ``AnalyticsResponse`` payload straight from ``batwa.db`` on every
request, so the admin Analytics page reflects new top-ups and payments within
a poll cycle — no offline ``analytics/run.py`` run is needed.

The offline pipeline (``analytics/``) remains the data-engineering showcase and
still publishes its curated artifacts/reports; this module is the *live* view.
The SQL mirrors the gold-layer definitions in ``analytics/pipeline/models/*``
so live numbers and a fresh pipeline run agree.

Stdlib only — reads the same read-only SQLite connection used by /admin/stats.
"""

from typing import Any, Dict, List


def compute_live_analytics(conn) -> Dict[str, Any]:
    """Build an /admin/analytics payload from the operational DB (no pipeline).

    ``conn`` is any sqlite3 connection exposing the Batwa schema (e.g. the
    ``get_db_readonly()`` context manager). Pure read-only.
    """
    kpis_row = conn.execute(
        """
        SELECT
            COALESCE(SUM(CASE WHEN type = 'TOPUP'   AND status = 'SUCCESS' THEN amount END), 0) AS cash_digitized,
            COALESCE(SUM(CASE WHEN type = 'PAYMENT' AND status = 'SUCCESS' THEN amount END), 0) AS payments_received,
            COUNT(*)                                                                          AS txn_count,
            SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END)                               AS success_count,
            SUM(CASE WHEN status = 'FAILED'  THEN 1 ELSE 0 END)                               AS failed_count,
            COUNT(DISTINCT customer_id)                                                       AS active_customers,
            MIN(date(timestamp))                                                              AS first_txn_date,
            MAX(date(timestamp))                                                              AS last_txn_date
        FROM transactions
        """
    ).fetchone()

    card_row = conn.execute(
        """
        SELECT
            SUM(CASE WHEN status = 'active'  THEN 1 ELSE 0 END) AS active_cards,
            SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) AS blocked_cards
        FROM cards
        """
    ).fetchone()

    kpis: Dict[str, Any] = {
        "cash_digitized": float(kpis_row["cash_digitized"] or 0),
        "payments_received": float(kpis_row["payments_received"] or 0),
        "txn_count": int(kpis_row["txn_count"] or 0),
        "success_count": int(kpis_row["success_count"] or 0),
        "failed_count": int(kpis_row["failed_count"] or 0),
        "active_customers": int(kpis_row["active_customers"] or 0),
        "active_cards": int(card_row["active_cards"] or 0),
        "blocked_cards": int(card_row["blocked_cards"] or 0),
        "first_txn_date": kpis_row["first_txn_date"] or None,
        "last_txn_date": kpis_row["last_txn_date"] or None,
    }

    # One row per (date, type, status) that actually occurred — same grain as
    # gold.kpi_daily_volume. The daily-volume chart consumes the SUCCESS
    # TOPUP/PAYMENT rows; the rest are audit context.
    daily_volume: List[Dict[str, Any]] = [
        {
            "date_key": r["date_key"],
            "type": r["type"],
            "status": r["status"],
            "txn_count": int(r["txn_count"]),
            "amount_total": float(r["amount_total"] or 0),
        }
        for r in conn.execute(
            """
            SELECT
                date(timestamp)                                        AS date_key,
                type,
                status,
                COUNT(*)                                               AS txn_count,
                COALESCE(SUM(amount), 0)                               AS amount_total
            FROM transactions
            GROUP BY date_key, type, status
            ORDER BY date_key, type, status
            """
        ).fetchall()
    ]

    failure_by_reason: List[Dict[str, Any]] = [
        {
            "failure_reason": r["failure_reason"] or None,
            "attempts": int(r["attempts"]),
            "pct_of_failures": float(r["pct_of_failures"] or 0),
        }
        for r in conn.execute(
            """
            SELECT
                failure_reason,
                COUNT(*)              AS attempts,
                ROUND(100.0 * COUNT(*) / NULLIF(
                    (SELECT COUNT(*) FROM transactions WHERE status = 'FAILED'), 0), 2) AS pct_of_failures
            FROM transactions
            WHERE status = 'FAILED'
            GROUP BY failure_reason
            ORDER BY attempts DESC
            """
        ).fetchall()
    ]

    # Payments are made to merchants (type = 'PAYMENT'); join the name for the
    # ranking, matching the gold-layer top_merchants query.
    top_merchants: List[Dict[str, Any]] = [
        {
            "merchant_name": r["merchant_name"],
            "payments": int(r["payments"]),
            "total_received": float(r["total_received"] or 0),
        }
        for r in conn.execute(
            """
            SELECT
                me.name                       AS merchant_name,
                COUNT(*)                      AS payments,
                COALESCE(SUM(t.amount), 0)    AS total_received
            FROM transactions t
            JOIN merchants me ON me.merchant_id = t.counterparty_id
            WHERE t.type = 'PAYMENT' AND t.status = 'SUCCESS'
            GROUP BY me.name
            ORDER BY total_received DESC
            LIMIT 5
            """
        ).fetchall()
    ]

    return {
        "kpis": kpis,
        "daily_volume": daily_volume,
        "failure_by_reason": failure_by_reason,
        "top_merchants": top_merchants,
        # No offline pipeline runs this live view — omit the run metadata so
        # the UI does not show a stale "last pipeline run" strip.
        "run_status": None,
    }
