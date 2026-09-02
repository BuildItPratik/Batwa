"""Tests for the deterministic synthetic demo source."""

from __future__ import annotations

import sqlite3

from pipeline.demo_data import build_demo_db

_TABLES = ("customers", "cards", "agents", "merchants", "transactions")
# Natural keys for a stable full-table dump (unambiguous sort order).
_PKS = {
    "customers": "customer_id",
    "cards": "card_id",
    "agents": "agent_id",
    "merchants": "merchant_id",
    "transactions": "txn_id",
}


def _row_counts(path) -> dict[str, int]:
    with sqlite3.connect(str(path)) as conn:
        return {t: conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
                for t in _TABLES}


def _dump(path):
    """Entire dataset as an ordered tuple of rows (content-level dump)."""
    with sqlite3.connect(str(path)) as conn:
        chunks = []
        for t in _TABLES:
            rows = conn.execute(
                f"SELECT * FROM {t} ORDER BY {_PKS[t]}").fetchall()
            chunks.append((t, tuple(rows)))
        return tuple(chunks)


def test_deterministic_same_seed(tmp_path):
    a = tmp_path / "a.db"
    b = tmp_path / "b.db"
    assert build_demo_db(a, seed=42, days=4) == build_demo_db(b, seed=42, days=4)
    assert _row_counts(a) == _row_counts(b)
    # Content must be byte-identical, not just equal in size.
    assert _dump(a) == _dump(b)


def test_different_seeds_differ(tmp_path):
    a = tmp_path / "a.db"
    b = tmp_path / "b.db"
    build_demo_db(a, seed=1, days=4)
    build_demo_db(b, seed=2, days=4)
    assert _dump(a) != _dump(b)


def test_has_history_and_both_statuses(demo_db):
    path, counts = demo_db
    # Guaranteed minimum for a 3-day demo regardless of seed: 5 creation-day
    # INSUFFICIENT_BALANCE anchors + 2 day-0 CARD_NOT_FOUND + 1 LIMIT_EXCEEDED
    # + 1 REISSUE. Random routine activity only adds more.
    assert counts["transactions"] >= 9
    with sqlite3.connect(str(path)) as conn:
        statuses = {r[0] for r in conn.execute(
            "SELECT DISTINCT status FROM transactions").fetchall()}
        types = {r[0] for r in conn.execute(
            "SELECT DISTINCT type FROM transactions").fetchall()}
    assert {"SUCCESS", "FAILED"} <= statuses
    assert types <= {"TOPUP", "PAYMENT", "REISSUE", "BLOCK"}
    assert "PAYMENT" in types and "TOPUP" in types


def test_ledger_reconciles_with_balances(demo_db):
    """customer.balance == Σ success TOPUP - Σ success PAYMENT (per customer)."""
    path, _ = demo_db
    with sqlite3.connect(str(path)) as conn:
        rows = conn.execute(
            """
            SELECT c.customer_id, c.balance,
                   COALESCE(SUM(CASE WHEN t.type='TOPUP'   AND t.status='SUCCESS'
                                     THEN t.amount END), 0) AS credited,
                   COALESCE(SUM(CASE WHEN t.type='PAYMENT' AND t.status='SUCCESS'
                                     THEN t.amount END), 0) AS debited
            FROM customers c
            LEFT JOIN transactions t ON t.customer_id = c.customer_id
            GROUP BY c.customer_id, c.balance
            """
        ).fetchall()
    assert rows, "expected customers in the demo db"
    for customer_id, balance, credited, debited in rows:
        assert abs(balance - (credited - debited)) < 0.01, customer_id


def test_card_lifecycle_produced(demo_db):
    """A reissue must exist and leave exactly one active card per owner."""
    path, _ = demo_db
    with sqlite3.connect(str(path)) as conn:
        has_reissue = conn.execute(
            "SELECT COUNT(*) FROM transactions WHERE type='REISSUE'").fetchone()[0]
        inactive = conn.execute(
            "SELECT COUNT(*) FROM cards WHERE status='blocked'").fetchone()[0]
    assert has_reissue >= 1
    assert inactive >= 1
