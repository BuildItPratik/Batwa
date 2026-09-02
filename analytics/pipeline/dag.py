"""Coarse task orchestration + run observability.

The pipeline runs as a small DAG of coarse tasks: extract -> land -> transform
-> quality -> report. Each task is executed and logged to ``meta.run_log`` in
the warehouse. In a real deployment these steps map cleanly onto an Airflow /
Dagster / Prefect graph (one task per node, retries, backfills); here the graph
is deliberately tiny and the run log is the observability surface
(``run.py status`` shows recent runs per task).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def new_run_id() -> str:
    """A stable-per-invocation id, e.g. 'run_20260902_1430_ab12cd'."""
    now = utc_now()
    return f"run_{now:%Y%m%d_%H%M%S}_{uuid.uuid4().hex[:6]}"


def log_task(con, run_id: str, task: str, status: str, detail: str = "") -> None:
    """Append one row to meta.run_log (idempotent, append-only)."""
    con.execute(
        """INSERT INTO meta.run_log (run_id, task, status, started_at, finished_at, detail)
           VALUES (?, ?, ?, current_timestamp, current_timestamp, ?)""",
        (run_id, task, status, detail),
    )
