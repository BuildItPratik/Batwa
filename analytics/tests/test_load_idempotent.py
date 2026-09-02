"""Landing layer must be idempotent: re-extracting never duplicates rows."""

from __future__ import annotations

from pipeline import source as source_mod
from pipeline.load import land


def _count(con, table: str) -> int:
    return con.execute(f"SELECT COUNT(*) FROM raw.{table}").fetchone()[0]


def test_double_land_does_not_duplicate(demo_db, warehouse):
    path, counts = demo_db
    tables = source_mod.read_sqlite(path)
    land(warehouse, tables, source_name="test")
    land(warehouse, tables, source_name="test")

    assert _count(warehouse, "transactions") == counts["transactions"]
    # dimension snapshots are replaced each extract — also stable.
    assert _count(warehouse, "customers") == counts["customers"]
    assert _count(warehouse, "cards") == counts["cards"]


def test_ingest_log_rows_recorded(demo_db, warehouse):
    path, _ = demo_db
    tables = source_mod.read_sqlite(path)
    land(warehouse, tables, source_name="test")
    n = warehouse.execute(
        "SELECT COUNT(*) FROM meta.ingest_run WHERE source='test'").fetchone()[0]
    assert n == 5  # one row per operational table
