"""
Batwa — Analytics artifact reader

Reads the CSV/JSON artifacts written by the offline analytics pipeline
(`analytics/run.py all`) into plain dicts for the /admin/analytics endpoint.
Stdlib only — no duckdb dependency, no warehouse file locks: the pipeline
runs offline and this only ever reads its published outputs.
"""

import csv
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

# backend/services/analytics_reader.py -> repo root -> analytics/outputs
_DEFAULT_OUTPUTS_DIR = Path(__file__).resolve().parents[2] / "analytics" / "outputs"


class AnalyticsArtifactsNotFound(Exception):
    """Raised when the analytics outputs directory or a required file is missing."""


def _outputs_dir() -> Path:
    return Path(os.getenv("BATWA_ANALYTICS_OUTPUTS", str(_DEFAULT_OUTPUTS_DIR)))


def _read_csv(path: Path, required: bool = True) -> List[Dict[str, str]]:
    if not path.exists():
        if required:
            raise AnalyticsArtifactsNotFound(f"Missing analytics artifact: {path.name}")
        return []
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def _to_int(value: Any) -> int:
    return int(float(value or 0))


def _to_float(value: Any) -> float:
    return float(value or 0)


def load_analytics() -> Dict[str, Any]:
    """Parse the pipeline's published artifacts into an /admin/analytics payload.

    Raises AnalyticsArtifactsNotFound when nothing has been published yet.
    """
    outputs = _outputs_dir()
    if not outputs.is_dir():
        raise AnalyticsArtifactsNotFound("Analytics outputs not found.")

    kpis_rows = _read_csv(outputs / "kpis_overview.csv")
    if not kpis_rows:
        raise AnalyticsArtifactsNotFound("kpis_overview.csv is empty — re-run the pipeline.")
    row = kpis_rows[0]

    kpis = {
        "cash_digitized": _to_float(row["cash_digitized"]),
        "payments_received": _to_float(row["payments_received"]),
        "txn_count": _to_int(row["txn_count"]),
        "success_count": _to_int(row["success_count"]),
        "failed_count": _to_int(row["failed_count"]),
        "active_customers": _to_int(row["active_customers"]),
        "active_cards": _to_int(row["active_cards"]),
        "blocked_cards": _to_int(row["blocked_cards"]),
        "first_txn_date": row.get("first_txn_date") or None,
        "last_txn_date": row.get("last_txn_date") or None,
    }

    daily_volume = [
        {
            "date_key": r["date_key"],
            "type": r["type"],
            "status": r["status"],
            "txn_count": _to_int(r["txn_count"]),
            "amount_total": _to_float(r["amount_total"]),
        }
        for r in _read_csv(outputs / "daily_volume.csv")
    ]

    failure_by_reason = [
        {
            "failure_reason": r.get("failure_reason") or None,
            "attempts": _to_int(r["attempts"]),
            "pct_of_failures": _to_float(r["pct_of_failures"]),
        }
        for r in _read_csv(outputs / "failure_by_reason.csv")
    ]

    top_merchants = [
        {
            "merchant_name": r["merchant_name"],
            "payments": _to_int(r["payments"]),
            "total_received": _to_float(r["total_received"]),
        }
        for r in _read_csv(outputs / "top_merchants.csv", required=False)
    ]

    run_status: Optional[Dict[str, Any]] = None
    status_path = outputs / "run_status.json"
    if status_path.exists():
        try:
            raw = json.loads(status_path.read_text(encoding="utf-8"))
            run_status = {
                "run_id": raw.get("run_id", ""),
                "source": raw.get("source", ""),
                "ran_at": raw.get("ran_at", ""),
                "quality_checks": {
                    "passed": _to_int(raw.get("quality_checks", {}).get("passed")),
                    "total": _to_int(raw.get("quality_checks", {}).get("total")),
                    "ok": raw.get("quality_checks", {}).get("ok"),
                },
            }
        except (json.JSONDecodeError, AttributeError):
            run_status = None  # a corrupt status file must not fail the view

    return {
        "kpis": kpis,
        "daily_volume": daily_volume,
        "failure_by_reason": failure_by_reason,
        "top_merchants": top_merchants,
        "run_status": run_status,
    }
