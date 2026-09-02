"""Load layer — lands extracted rows into the DuckDB warehouse.

Bronze (``raw``) landing keeps the operational payload close to source:
timestamps stay VARCHAR, numerics become DOUBLE. Idempotency rules:

  * ``transactions`` (append-only facts): only rows whose natural key
    (``txn_id``) is not already present are inserted — re-runs never duplicate.
  * dimension tables (customers/cards/agents/merchants): small current-state
    snapshots, so each extract replaces them wholesale.

``ensure_warehouse`` also creates the ``meta`` schema used for run
observability (run_log / model_run / check_run / ingest_run).
"""

from __future__ import annotations

from . import config
from .config import TABLE_SPEC

# DuckDB DDL per table (mirrors backend columns; timestamps kept as VARCHAR
# in bronze and parsed to TIMESTAMP/DATE in silver/gold).
_RAW_DDL = {
    "customers": """
        CREATE TABLE IF NOT EXISTS raw.customers (
            customer_id   VARCHAR,
            name          VARCHAR,
            phone         VARCHAR,
            pin_hash      VARCHAR,
            balance       DOUBLE,
            language_pref VARCHAR,
            created_at    VARCHAR
        )""",
    "cards": """
        CREATE TABLE IF NOT EXISTS raw.cards (
            card_id       VARCHAR,
            customer_id   VARCHAR,
            status        VARCHAR,
            created_at    VARCHAR
        )""",
    "agents": """
        CREATE TABLE IF NOT EXISTS raw.agents (
            agent_id      VARCHAR,
            name          VARCHAR,
            location      VARCHAR,
            float_balance DOUBLE
        )""",
    "merchants": """
        CREATE TABLE IF NOT EXISTS raw.merchants (
            merchant_id   VARCHAR,
            name          VARCHAR,
            wallet_balance DOUBLE
        )""",
    "transactions": """
        CREATE TABLE IF NOT EXISTS raw.transactions (
            txn_id          VARCHAR,
            type            VARCHAR,
            customer_id     VARCHAR,
            counterparty_id VARCHAR,
            amount          DOUBLE,
            status          VARCHAR,
            failure_reason  VARCHAR,
            timestamp       VARCHAR
        )""",
}

_META_DDL = [
    """CREATE TABLE IF NOT EXISTS meta.run_log (
        run_id VARCHAR, task VARCHAR, status VARCHAR,
        started_at TIMESTAMP, finished_at TIMESTAMP, detail VARCHAR
    )""",
    """CREATE TABLE IF NOT EXISTS meta.model_run (
        model VARCHAR, schema VARCHAR, status VARCHAR,
        rows BIGINT, ran_at TIMESTAMP
    )""",
    """CREATE TABLE IF NOT EXISTS meta.check_run (
        check_name VARCHAR, status VARCHAR, violations BIGINT, ran_at TIMESTAMP
    )""",
    """CREATE TABLE IF NOT EXISTS meta.ingest_run (
        table_name VARCHAR, source VARCHAR, loaded BIGINT,
        new_rows BIGINT, ran_at TIMESTAMP
    )""",
]


def ensure_warehouse(con) -> None:
    """Create schemas + bronze/meta tables if missing (idempotent)."""
    for schema in ("raw", "silver", "gold", "meta"):
        con.execute(f"CREATE SCHEMA IF NOT EXISTS {schema}")
    for table in config.TABLE_ORDER:
        con.execute(_RAW_DDL[table])
    for ddl in _META_DDL:
        con.execute(ddl)


def _insert(con, table: str, rows: list[dict]) -> None:
    columns = TABLE_SPEC[table]["columns"]
    placeholders = ", ".join(["?"] * len(columns))
    sql = f"INSERT INTO raw.{table} ({', '.join(columns)}) VALUES ({placeholders})"
    con.executemany(sql, [tuple(r[c] for c in columns) for r in rows])


def land(con, tables: dict[str, list[dict]], source_name: str = "?") -> dict[str, dict]:
    """Land all tables into bronze. Returns per-table {loaded, new} counts."""
    result: dict[str, dict] = {}
    for table in config.TABLE_ORDER:
        rows = tables.get(table) or []
        loaded = len(rows)
        new_rows = 0

        if not rows:
            # Transactions still idempotent: nothing new. Dims: wipe stale rows.
            if table != "transactions":
                con.execute(f"DELETE FROM raw.{table}")
        elif table == "transactions":
            pk = "txn_id"
            existing = {r[0] for r in
                        con.execute(f"SELECT {pk} FROM raw.transactions").fetchall()}
            fresh = [r for r in rows if r[pk] not in existing]
            new_rows = len(fresh)
            if fresh:
                _insert(con, "transactions", fresh)
        else:
            con.execute(f"DELETE FROM raw.{table}")
            _insert(con, table, rows)
            new_rows = loaded

        result[table] = {"loaded": loaded, "new": new_rows}
        con.execute(
            """INSERT INTO meta.ingest_run (table_name, source, loaded, new_rows, ran_at)
               VALUES (?, ?, ?, ?, current_timestamp)""",
            (table, source_name, loaded, new_rows),
        )
    return result
