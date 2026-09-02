"""Tests for services/analytics_live — live DB analytics (no pipeline)."""

import sqlite3
import unittest

from database import SCHEMA_SQL
from services.analytics_live import compute_live_analytics


def _fresh_conn():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA_SQL)
    return conn


def _seed(conn):
    conn.executemany(
        "INSERT INTO customers (customer_id, name, pin_hash) VALUES (?, ?, 'x')",
        [("C1", "Alice"), ("C2", "Bob")],
    )
    conn.executemany(
        "INSERT INTO cards (card_id, customer_id, status) VALUES (?, ?, ?)",
        [("CARD1", "C1", "active"), ("CARD2", "C2", "active"), ("CARD3", "C2", "blocked")],
    )
    conn.executemany(
        "INSERT INTO merchants (merchant_id, name) VALUES (?, ?)",
        [("M1", "Shop A"), ("M2", "Shop B")],
    )
    # timestamps are SQLite CURRENT_TIMESTAMP format (UTC)
    conn.executemany(
        """
        INSERT INTO transactions (txn_id, type, customer_id, counterparty_id, amount, status, failure_reason, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            ("T1", "TOPUP",   "C1", "AGT-001", 100, "SUCCESS", None,              "2026-08-01 10:00:00"),
            ("T2", "TOPUP",   "C2", "AGT-001", 50,  "SUCCESS", None,              "2026-08-02 10:00:00"),
            ("T3", "PAYMENT", "C1", "M1",      30,  "SUCCESS", None,              "2026-08-02 11:00:00"),
            ("T4", "PAYMENT", "C1", "M1",      70,  "SUCCESS", None,              "2026-08-03 10:00:00"),
            ("T5", "PAYMENT", "C1", "M1",      200, "FAILED",  "LIMIT_EXCEEDED",  "2026-08-03 11:00:00"),
            ("T6", "PAYMENT", "C2", "M1",      40,  "FAILED",  "WRONG_PIN",       "2026-08-03 12:00:00"),
            ("T7", "BLOCK",   "C2", "AGT-001", None, "SUCCESS", None,             "2026-08-04 10:00:00"),
        ],
    )
    conn.commit()


class LiveAnalyticsTests(unittest.TestCase):
    def test_live_payload_matches_sqlite_state(self):
        conn = _fresh_conn()
        _seed(conn)
        p = compute_live_analytics(conn)

        k = p["kpis"]
        self.assertEqual(k["cash_digitized"], 150.0)
        self.assertEqual(k["payments_received"], 100.0)
        self.assertEqual(k["txn_count"], 7)
        self.assertEqual(k["success_count"], 5)
        self.assertEqual(k["failed_count"], 2)
        self.assertEqual(k["active_customers"], 2)
        self.assertEqual(k["active_cards"], 2)
        self.assertEqual(k["blocked_cards"], 1)
        self.assertEqual(k["first_txn_date"], "2026-08-01")
        self.assertEqual(k["last_txn_date"], "2026-08-04")

        # daily volume: one row per (date, type, status) that occurred
        dv = {(r["date_key"], r["type"], r["status"]): r for r in p["daily_volume"]}
        self.assertEqual(len(p["daily_volume"]), 6)
        self.assertEqual(dv[("2026-08-02", "PAYMENT", "SUCCESS")]["amount_total"], 30.0)
        self.assertEqual(dv[("2026-08-03", "PAYMENT", "FAILED")]["txn_count"], 2)
        self.assertEqual(dv[("2026-08-04", "BLOCK", "SUCCESS")]["amount_total"], 0.0)

        by_reason = {r["failure_reason"]: r for r in p["failure_by_reason"]}
        self.assertEqual(by_reason["LIMIT_EXCEEDED"]["attempts"], 1)
        self.assertEqual(by_reason["LIMIT_EXCEEDED"]["pct_of_failures"], 50.0)
        self.assertEqual(by_reason["WRONG_PIN"]["attempts"], 1)

        self.assertEqual(p["top_merchants"], [
            {"merchant_name": "Shop A", "payments": 2, "total_received": 100.0},
        ])
        self.assertIsNone(p["run_status"])

    def test_empty_database_returns_zeroed_payload(self):
        conn = _fresh_conn()
        p = compute_live_analytics(conn)
        self.assertEqual(p["kpis"]["txn_count"], 0)
        self.assertEqual(p["daily_volume"], [])
        self.assertEqual(p["failure_by_reason"], [])
        self.assertEqual(p["top_merchants"], [])
        self.assertIsNone(p["run_status"])


if __name__ == "__main__":
    unittest.main()
