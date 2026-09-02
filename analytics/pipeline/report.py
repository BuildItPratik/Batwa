"""Report step — turn the gold layer into human + file artifacts.

Writes into ``outputs/`` (overwritten each run):
  * curated exports as Parquet: fct + every dimension
  * bronze snapshot as Parquet under ``outputs/raw/``
  * KPI tables as CSV: overview, failure-by-reason, daily volume, top merchants
  * ``run_status.json`` — last-run metadata for the admin analytics view
  * ``report.md`` — a readable summary for the demo
"""

from __future__ import annotations

import json
from pathlib import Path

from . import config


# ---------------------------------------------------------------------------
# Queries
# ---------------------------------------------------------------------------

_KPI_SQL = """
SELECT
    (SELECT COALESCE(SUM(amount), 0) FROM gold.fct_transactions
        WHERE type = 'TOPUP'   AND status = 'SUCCESS') AS cash_digitized,
    (SELECT COALESCE(SUM(amount), 0) FROM gold.fct_transactions
        WHERE type = 'PAYMENT' AND status = 'SUCCESS') AS payments_received,
    (SELECT COUNT(*) FROM gold.fct_transactions)                       AS txn_count,
    (SELECT COUNT(*) FROM gold.fct_transactions WHERE status = 'SUCCESS') AS success_count,
    (SELECT COUNT(*) FROM gold.fct_transactions WHERE status = 'FAILED')  AS failed_count,
    (SELECT COUNT(DISTINCT customer_id) FROM gold.fct_transactions
        WHERE customer_id IS NOT NULL)                                  AS active_customers,
    (SELECT COUNT(*) FROM gold.dim_card WHERE is_current)               AS active_cards,
    (SELECT COUNT(*) FROM gold.dim_card WHERE NOT is_current)           AS blocked_cards,
    (SELECT MIN(occurred_date) FROM gold.fct_transactions)              AS first_txn_date,
    (SELECT MAX(occurred_date) FROM gold.fct_transactions)              AS last_txn_date
"""

_TOP_MERCHANTS_SQL = """
SELECT
    me.name                    AS merchant_name,
    COUNT(*)                   AS payments,
    COALESCE(SUM(f.amount), 0) AS total_received
FROM gold.fct_transactions f
JOIN gold.dim_merchant me
    ON me.merchant_id = f.counterparty_id AND f.counterparty_role = 'merchant'
WHERE f.status = 'SUCCESS'
GROUP BY me.name
ORDER BY total_received DESC
LIMIT 5
"""

_FAILURE_BY_REASON_SQL = """
SELECT
    failure_reason,
    COUNT(*)                                  AS attempts,
    ROUND(100.0 * COUNT(*) / NULLIF(
        (SELECT COUNT(*) FROM gold.fct_transactions WHERE status = 'FAILED'), 0), 2) AS pct_of_failures
FROM gold.fct_transactions
WHERE status = 'FAILED'
GROUP BY failure_reason
ORDER BY attempts DESC
"""


def compute_kpis(con) -> dict:
    row = con.execute(_KPI_SQL).fetchone()
    keys = [
        "cash_digitized", "payments_received", "txn_count", "success_count",
        "failed_count", "active_customers", "active_cards", "blocked_cards",
        "first_txn_date", "last_txn_date",
    ]
    data = dict(zip(keys, row))
    total = (data["success_count"] or 0) + (data["failed_count"] or 0)
    data["overall_failure_rate_pct"] = round(
        100.0 * (data["failed_count"] or 0) / total, 2) if total else 0.0
    return data


# ---------------------------------------------------------------------------
# Writers
# ---------------------------------------------------------------------------

def _write_csv(con, query: str, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    target = str(path).replace("\\", "/")
    con.execute(f"COPY ({query}) TO '{target}' (FORMAT CSV, HEADER true)")


def _write_parquet(con, query: str, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    target = str(path).replace("\\", "/")
    con.execute(f"COPY ({query}) TO '{target}' (FORMAT PARQUET)")


def top_merchants(con) -> list[tuple]:
    return con.execute(_TOP_MERCHANTS_SQL).fetchall()


def failure_by_reason(con) -> list[tuple]:
    return con.execute(_FAILURE_BY_REASON_SQL).fetchall()


def write_run_status(output_dir: Path, run_id: str, source: str,
                      quality_results) -> Path:
    """Write ``run_status.json`` — last-run metadata for the admin UI.

    ``quality_results`` is the list of quality.CheckResult produced by the
    same run (may be None when the report is regenerated standalone).
    """
    checks = list(quality_results or [])
    status = {
        "run_id": run_id,
        "source": source,
        "ran_at": _utc_now_iso(),
        "quality_checks": {
            "passed": sum(1 for c in checks if c.ok),
            "total": len(checks),
            "ok": all(c.ok for c in checks) if checks else None,
        },
    }
    path = output_dir / "run_status.json"
    path.write_text(json.dumps(status, indent=2), encoding="utf-8")
    return path


def _utc_now_iso() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat(timespec="seconds")



# ---------------------------------------------------------------------------
# Markdown summary
# ---------------------------------------------------------------------------

def _markdown(kpis: dict, merchants: list[tuple], failures: list[tuple],
              output_dir: Path) -> str:
    from . import dag

    lines = ["# Batwa Analytics — run report", ""]
    lines.append(f"*Generated {dag.utc_now().isoformat(timespec='minutes')} — warehouse overview*")
    lines.append("")
    lines.append("## Headline KPIs")
    lines.append("")
    lines.append(f"| Metric | Value |")
    lines.append(f"|---|---|")
    rows = [
        ("Cash digitised (successful top-ups)", f"₹{kpis['cash_digitized']:,.2f}"),
        ("Payments received (successful)", f"₹{kpis['payments_received']:,.2f}"),
        ("Transactions captured", kpis["txn_count"]),
        ("Success / failed", f"{kpis['success_count']} / {kpis['failed_count']}"),
        ("Overall failure rate", f"{kpis['overall_failure_rate_pct']}%"),
        ("Active customers (saw money move)", kpis["active_customers"]),
        ("Active / blocked cards", f"{kpis['active_cards']} / {kpis['blocked_cards']}"),
        ("History window", f"{kpis['first_txn_date']} → {kpis['last_txn_date']}"),
    ]
    for label, value in rows:
        lines.append(f"| {label} | {value} |")
    lines.append("")

    if merchants:
        lines.append("## Top merchants by value received")
        lines.append("")
        lines.append("| Merchant | Payments | Received |")
        lines.append("|---|---:|---:|")
        for name, count, total in merchants:
            lines.append(f"| {name} | {count} | ₹{total:,.2f} |")
        lines.append("")

    if failures:
        lines.append("## Failed attempts by reason")
        lines.append("")
        lines.append("| Failure reason | Attempts | % of failures |")
        lines.append("|---|---:|---:|")
        for reason, count, pct in failures:
            lines.append(f"| {reason} | {count} | {pct}% |")
        lines.append("")

    lines.append("## Artifacts")
    lines.append("")
    for child in sorted(output_dir.glob("*.csv")):
        lines.append(f"- `{child.name}`")
    for child in sorted(output_dir.glob("*.parquet")):
        lines.append(f"- `{child.name}`")
    lines.append("")
    lines.append("Run metadata is stored in `meta.run_log` / `meta.model_run` / "
                 "`meta.check_run` inside the DuckDB warehouse.")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def generate(con, outputs_dir=None, run_id=None, source=None,
             quality_results=None) -> dict:
    output_dir = Path(outputs_dir) if outputs_dir else config.OUTPUTS_DIR
    output_dir.mkdir(parents=True, exist_ok=True)

    kpis = compute_kpis(con)
    merchants = top_merchants(con)
    failures = failure_by_reason(con)

    # Curated zone (gold).
    _write_parquet(con, "SELECT * FROM gold.fct_transactions",
                   output_dir / "fct_transactions.parquet")
    for dim in ("dim_customer", "dim_card", "dim_agent", "dim_merchant", "dim_date"):
        _write_parquet(con, f"SELECT * FROM gold.{dim}",
                       output_dir / f"{dim}.parquet")

    # Bronze snapshot.
    for table in config.TABLE_ORDER:
        _write_parquet(con, f"SELECT * FROM raw.{table}",
                       output_dir / "raw" / f"{table}.parquet")

    # CSV tables.
    _write_csv(con, _KPI_SQL, output_dir / "kpis_overview.csv")
    _write_csv(con, _FAILURE_BY_REASON_SQL, output_dir / "failure_by_reason.csv")
    _write_csv(con, "SELECT * FROM gold.kpi_daily_volume ORDER BY date_key, type, status",
               output_dir / "daily_volume.csv")
    _write_csv(con, _TOP_MERCHANTS_SQL, output_dir / "top_merchants.csv")

    # Last-run metadata (admin analytics view). A standalone `report` command
    # has no run context — record what we know.
    write_run_status(
        output_dir,
        run_id=run_id or "standalone",
        source=source or "unknown",
        quality_results=quality_results,
    )

    # Human-readable summary.
    (output_dir / "report.md").write_text(
        _markdown(kpis, merchants, failures, output_dir), encoding="utf-8")

    return {"kpis": kpis, "output_dir": str(output_dir),
            "top_merchants": merchants, "failure_by_reason": failures}
