"""Shared pytest fixtures for the Batwa analytics tests.

Run from the analytics directory:  python -m pytest tests -q

Every test builds against a *throwaway* DuckDB warehouse in tmp_path and a
small, deterministic synthetic source — nothing touches backend/batwa.db and
no network is needed.
"""

from __future__ import annotations

import sys
from pathlib import Path

import duckdb
import pytest

# Make `import pipeline` work when pytest runs from the analytics directory.
ANALYTICS_DIR = Path(__file__).resolve().parents[1]
if str(ANALYTICS_DIR) not in sys.path:
    sys.path.insert(0, str(ANALYTICS_DIR))

from pipeline import transform  # noqa: E402
from pipeline import source as source_mod  # noqa: E402
from pipeline.demo_data import build_demo_db  # noqa: E402
from pipeline.load import ensure_warehouse, land  # noqa: E402


@pytest.fixture()
def demo_db(tmp_path):
    """Small deterministic synthetic source (3 days)."""
    path = tmp_path / "op" / "batwa_demo.db"
    counts = build_demo_db(path, seed=7, days=3)
    return path, counts


@pytest.fixture()
def warehouse(tmp_path):
    """Empty DuckDB warehouse with raw + meta tables created."""
    con = duckdb.connect(str(tmp_path / "wh.duckdb"))
    ensure_warehouse(con)
    yield con
    con.close()


@pytest.fixture()
def loaded_warehouse(demo_db, warehouse):
    """Warehouse with bronze landed from the demo source (no transform yet)."""
    path, _ = demo_db
    tables = source_mod.read_sqlite(path)
    land(warehouse, tables, source_name="test")
    return warehouse


def transform_all(con) -> list[dict]:
    """Materialise the full model layer."""
    return transform.run(con)
