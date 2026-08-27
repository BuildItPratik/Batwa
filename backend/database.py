"""
TapWallet — Database layer
SQLite schema creation, connection management, and atomic transaction support.
"""

import sqlite3
import os
from contextlib import contextmanager

# Database file lives next to this script
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tapwallet.db")

# ---------------------------------------------------------------------------
# Schema — 5 tables
# ---------------------------------------------------------------------------

SCHEMA_SQL = """
-- customers: permanent identity (customer_id never changes)
CREATE TABLE IF NOT EXISTS customers (
    customer_id   TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    phone         TEXT,
    pin_hash      TEXT NOT NULL,
    balance       REAL DEFAULT 0,
    language_pref TEXT DEFAULT 'en',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- cards: QR cards linked to customers (card_id is what the QR encodes)
CREATE TABLE IF NOT EXISTS cards (
    card_id       TEXT PRIMARY KEY,
    customer_id   TEXT NOT NULL REFERENCES customers(customer_id),
    status        TEXT DEFAULT 'active',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- agents: cash-in points
CREATE TABLE IF NOT EXISTS agents (
    agent_id      TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    location      TEXT,
    float_balance REAL DEFAULT 10000
);

-- merchants: shops accepting payment
CREATE TABLE IF NOT EXISTS merchants (
    merchant_id     TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    wallet_balance  REAL DEFAULT 0
);

-- transactions: full audit trail
CREATE TABLE IF NOT EXISTS transactions (
    txn_id          TEXT PRIMARY KEY,
    type            TEXT NOT NULL,
    customer_id     TEXT REFERENCES customers(customer_id),
    counterparty_id TEXT,
    amount          REAL,
    status          TEXT,
    failure_reason  TEXT,
    timestamp       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""

# ---------------------------------------------------------------------------
# Connection helpers
# ---------------------------------------------------------------------------


def init_db():
    """Create all tables if they don't exist. Safe to call multiple times."""
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA_SQL)
    conn.commit()
    conn.close()


@contextmanager
def get_db():
    """
    Context manager that yields a sqlite3 connection.

    Uses WAL journal mode for better concurrent read performance and
    IMMEDIATE transactions so writes acquire the lock upfront — preventing
    mid-transaction SQLITE_BUSY errors on concurrent write attempts.
    """
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row          # rows behave like dicts
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        conn.execute("BEGIN IMMEDIATE")
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@contextmanager
def get_db_readonly():
    """Read-only connection — no transaction overhead."""
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
    finally:
        conn.close()
