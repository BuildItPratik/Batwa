"""Deterministic synthetic operational history for Batwa.

The real app (backend/) starts with *zero* transactions, so a pipeline has
nothing to ingest out of the box. This module generates a plausible,
deterministic "weeks of counter activity" into a throwaway SQLite database
that mirrors the operational schema exactly (DDL copied from
backend/database.py SCHEMA_SQL). It obeys every rule the app enforces:

  * transaction `type` / `status` / `failure_reason` come from the closed sets
  * a payment over Rs.100 is always recorded FAILED with LIMIT_EXCEEDED
  * money only moves on SUCCESS rows
  * the ledger is self-consistent: for every customer
        balance = SUM(success TOPUP) - SUM(success PAYMENT)
    and agent float = 10000 - SUM(TOPUP); merchant wallet = SUM(PAYMENT)

So the same data passes the data-quality suite, and re-running with the same
seed reproduces identical history (interview hook: "how do you test against a
clean, repeatable dataset?" -> this generator).
"""

from __future__ import annotations

import random
import sqlite3
from datetime import date, datetime, time, timedelta
from pathlib import Path

# ---------------------------------------------------------------------------
# Schema — copied verbatim from backend/database.py (source of truth).
# ---------------------------------------------------------------------------

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS customers (
    customer_id   TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    phone         TEXT,
    pin_hash      TEXT NOT NULL,
    balance       REAL DEFAULT 0,
    language_pref TEXT DEFAULT 'en',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cards (
    card_id       TEXT PRIMARY KEY,
    customer_id   TEXT NOT NULL REFERENCES customers(customer_id),
    status        TEXT DEFAULT 'active',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agents (
    agent_id      TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    location      TEXT,
    float_balance REAL DEFAULT 10000
);

CREATE TABLE IF NOT EXISTS merchants (
    merchant_id     TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    wallet_balance  REAL DEFAULT 0
);

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

# Placeholder only — never used downstream. The real backend bcrypt-hashes.
_PIN_HASH_PLACEHOLDER = "DEMO_HASH_PLACEHOLDER"

# Roster mirrors backend/seed.py (last field = day of the timeline created).
_ROSTER = [
    ("CUST-TEST01", "Ramesh Kumar", "9876543210", "hi", 0),
    ("CUST-TEST02", "Lakshmi Devi", "9876543211", "ta", 0),
    ("CUST-TEST03", "Arjun Singh", "9876543212", "en", 1),
    ("CUST-TEST04", "Meena Kumari", "9876543213", "hi", 1),
    ("CUST-TEST05", "Ravi Shankar", "9876543214", "en", 2),
]

_AGENTS = [
    ("AGT-001", "Agent Priya - Downtown", "MG Road, Pune"),
    ("AGT-002", "Agent Suresh - Station", "Railway Station, Pune"),
]

_MERCHANTS = [
    ("MER-001", "Annapurna Vegetables"),
    ("MER-002", "Ravi Tea Stall"),
]

_FAILURE_REASONS = {
    "WRONG_PIN",
    "INSUFFICIENT_BALANCE",
    "BLOCKED_CARD",
    "LIMIT_EXCEEDED",
    "AGENT_FLOAT_INSUFFICIENT",
    "AGENT_NOT_FOUND",
    "CARD_NOT_FOUND",
    "MERCHANT_NOT_FOUND",
}

PAYMENT_LIMIT = 100.0
INITIAL_AGENT_FLOAT = 10000.0
_DAY_START = time(8, 0, 0)
_MISSING_CARD = "CARD-NOPE-0000"
_MISSING_MERCHANT = "MER-UNKNOWN"


def _ts(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def _card_row(card_id: str, customer_id: str, status: str, at: datetime) -> dict:
    return {
        "card_id": card_id, "customer_id": customer_id,
        "status": status, "created_at": _ts(at),
    }


class _Ledger:
    """Single source of truth for balances, cards, and the txn stream."""

    def __init__(self, card_rows: dict[str, dict]) -> None:
        self.customer_balance: dict[str, float] = {}
        self.agent_float: dict[str, float] = {}
        self.merchant_wallet: dict[str, float] = {}
        self.active_card: dict[str, str] = {}
        self.card_owner: dict[str, str] = {}
        self.card_rows = card_rows                       # status mutated here
        self.blocked_cards: list[str] = []
        self.txns: list[dict] = []
        self._txn_seq = 0
        self._reissue_seq = 1000

    # -- id + row factories ------------------------------------------------
    def next_txn_id(self) -> str:
        self._txn_seq += 1
        return f"TXN-DEMO-{self._txn_seq:06d}"

    @staticmethod
    def _txn_row(txn_id: str, txn_type: str, customer: str | None,
                 counterparty: str | None, amount: float | None,
                 status: str, reason: str | None, at: datetime) -> dict:
        return {
            "txn_id": txn_id, "type": txn_type, "customer_id": customer,
            "counterparty_id": counterparty, "amount": amount,
            "status": status, "failure_reason": reason, "timestamp": _ts(at),
        }

    # -- success / failure -------------------------------------------------
    def topup_success(self, customer: str, agent: str, amount: float, at: datetime) -> dict:
        self.customer_balance[customer] += amount
        self.agent_float[agent] -= amount
        row = self._txn_row(self.next_txn_id(), "TOPUP", customer, agent,
                            amount, "SUCCESS", None, at)
        self.txns.append(row)
        return row

    def payment_success(self, customer: str, merchant: str, amount: float, at: datetime) -> dict:
        self.customer_balance[customer] -= amount
        self.merchant_wallet[merchant] += amount
        row = self._txn_row(self.next_txn_id(), "PAYMENT", customer, merchant,
                            amount, "SUCCESS", None, at)
        self.txns.append(row)
        return row

    def failure(self, txn_type: str, customer: str | None, counterparty: str | None,
                amount: float, reason: str, at: datetime) -> dict:
        assert reason in _FAILURE_REASONS, f"unknown reason {reason!r}"
        row = self._txn_row(self.next_txn_id(), txn_type, customer, counterparty,
                            amount, "FAILED", reason, at)
        self.txns.append(row)
        return row

    # -- card lifecycle ----------------------------------------------------
    def _deactivate(self, card_id: str, customer: str) -> None:
        """Mark a card blocked without recording a transaction row."""
        self.card_rows[card_id]["status"] = "blocked"
        if card_id not in self.blocked_cards:
            self.blocked_cards.append(card_id)
        if self.active_card.get(customer) == card_id:
            self.active_card.pop(customer, None)

    def block(self, card_id: str, customer: str, at: datetime) -> dict:
        """Manual block (backend /cards/block) — records a BLOCK txn."""
        self._deactivate(card_id, customer)
        row = self._txn_row(self.next_txn_id(), "BLOCK", customer, None,
                            None, "SUCCESS", None, at)
        self.txns.append(row)
        return row

    def reissue(self, customer: str, at: datetime) -> tuple[dict, dict]:
        """Backend /cards/reissue: block old active card, mint a new one,
        and record a single REISSUE txn (matches routes/cards.py)."""
        old = self.active_card.get(customer)
        if old is not None:
            self._deactivate(old, customer)
        new_id = f"CARD-{self._reissue_seq:04d}"
        self._reissue_seq += 1
        self.active_card[customer] = new_id
        self.card_owner[new_id] = customer
        new_card = _card_row(new_id, customer, "active", at)
        self.card_rows[new_id] = new_card
        row = self._txn_row(self.next_txn_id(), "REISSUE", customer, None,
                            None, "SUCCESS", None, at)
        self.txns.append(row)
        return row, new_card


def _generate(seed: int, days: int) -> dict[str, list[dict]]:
    rng = random.Random(seed)
    start_day = date.today() - timedelta(days=days)

    card_rows: dict[str, dict] = {}
    customer_rows: dict[str, dict] = {}
    for cid, name, phone, lang, created_day in _ROSTER:
        created = datetime.combine(start_day + timedelta(days=created_day), time(8, 30))
        customer_rows[cid] = {
            "customer_id": cid, "name": name, "phone": phone,
            "pin_hash": _PIN_HASH_PLACEHOLDER, "balance": 0.0,
            "language_pref": lang, "created_at": _ts(created),
        }
        card_id = cid.replace("CUST-", "CARD-")
        card_rows[card_id] = _card_row(card_id, cid, "active", created)

    ledger = _Ledger(card_rows)
    for cid in customer_rows:
        ledger.customer_balance[cid] = 0.0
    for agent_id, *_ in _AGENTS:
        ledger.agent_float[agent_id] = INITIAL_AGENT_FLOAT
    for merchant_id, *_ in _MERCHANTS:
        ledger.merchant_wallet[merchant_id] = 0.0
    for cid in customer_rows:
        card = cid.replace("CUST-", "CARD-")
        ledger.active_card[cid] = card
        ledger.card_owner[card] = cid

    def merchants() -> list[str]:
        return [m for m, *_ in _MERCHANTS]

    def agents_with_float(amount: float) -> list[str]:
        return [a for a, f in ledger.agent_float.items() if f >= amount]

    for day_index in range(days):
        day = start_day + timedelta(days=day_index)
        clock = datetime.combine(day, _DAY_START)
        active_customers = [c for c, *_r, cd in _ROSTER if cd <= day_index]

        def bump() -> datetime:
            nonlocal clock
            clock += timedelta(seconds=rng.randint(20, 700))
            return clock

        # --- creation-day anchor: guaranteed INSUFFICIENT_BALANCE attempt ---
        for cid, *_r, created_day in _ROSTER:
            if created_day == day_index:
                ledger.failure("PAYMENT", cid, rng.choice(merchants()),
                               float(rng.randint(30, 90)), "INSUFFICIENT_BALANCE", bump())

        # --- nonexistent cards (first day only) ---
        if day_index == 0:
            ledger.failure("PAYMENT", None, rng.choice(merchants()),
                           float(rng.randint(10, 50)), "CARD_NOT_FOUND", bump())
            agents = agents_with_float(10.0)
            if agents:
                ledger.failure("TOPUP", None, rng.choice(agents),
                               float(rng.randint(10, 50)), "CARD_NOT_FOUND", bump())

        # --- over-limit payment → LIMIT_EXCEEDED ---
        if day_index % 3 == 0:
            ledger.failure("PAYMENT", None, rng.choice(merchants()),
                           float(rng.randint(120, 250)), "LIMIT_EXCEEDED", bump())

        # --- scheduled card lifecycle ---
        if day_index == 2:
            ledger.reissue("CUST-TEST02", bump())
        if day_index == 4:
            ledger.block("CARD-TEST01", "CUST-TEST01", bump())
        if day_index == 5:
            ledger.reissue("CUST-TEST01", bump())

        # --- blocked-card failures once some cards are blocked ---
        if ledger.blocked_cards and day_index >= 3 and rng.random() < 0.7:
            card = rng.choice(ledger.blocked_cards)
            owner = ledger.card_owner.get(card)
            ledger.failure("PAYMENT", owner, rng.choice(merchants()),
                           float(rng.randint(10, 50)), "BLOCKED_CARD", bump())

        # --- routine counter activity per active customer ---
        for cid, *_r, created_day in _ROSTER:
            if created_day > day_index:
                continue
            has_card = ledger.active_card.get(cid) is not None

            # Merchant-not-found attempt only when the customer can fund it.
            if (has_card and day_index % 4 == 1
                    and ledger.customer_balance[cid] >= 5):
                amount = float(rng.randint(1, int(min(PAYMENT_LIMIT, ledger.customer_balance[cid]))))
                if amount > 0:
                    ledger.failure("PAYMENT", cid, _MISSING_MERCHANT,
                                   amount, "MERCHANT_NOT_FOUND", bump())

            # Top-up success (customers can also top up on their first day).
            if has_card and rng.random() < 0.85:
                amount = float(rng.randint(20, 150))
                agents = agents_with_float(amount)
                if agents:
                    ledger.topup_success(cid, rng.choice(agents), amount, bump())

            # Successful payments, capped by balance and the Rs.100 limit.
            budget = int(min(PAYMENT_LIMIT, ledger.customer_balance[cid]))
            for _ in range(rng.randint(0, 2)):
                if budget <= 0:
                    break
                amount = float(rng.randint(1, budget))
                ledger.payment_success(cid, rng.choice(merchants()), amount, bump())
                budget = int(min(PAYMENT_LIMIT, ledger.customer_balance[cid]))

            # Occasional wrong-PIN attempt.
            if (has_card and ledger.customer_balance[cid] >= 5 and rng.random() < 0.2):
                amount = float(rng.randint(1, int(min(PAYMENT_LIMIT, ledger.customer_balance[cid]))))
                ledger.failure("PAYMENT", cid, rng.choice(merchants()),
                               amount, "WRONG_PIN", bump())

        ledger.txns.sort(key=lambda e: e["timestamp"])

    # Finalise the snapshot so it reconciles with the ledger.
    for cid, row in customer_rows.items():
        row["balance"] = round(ledger.customer_balance.get(cid, 0.0), 2)
    for card_id, row in card_rows.items():
        if card_id in ledger.blocked_cards:
            row["status"] = "blocked"
    agents_rows = {
        agent_id: {"agent_id": agent_id, "name": name, "location": location,
                   "float_balance": round(ledger.agent_float[agent_id], 2)}
        for agent_id, name, location in _AGENTS
    }
    merchants_rows = {
        merchant_id: {"merchant_id": merchant_id, "name": name,
                      "wallet_balance": round(ledger.merchant_wallet[merchant_id], 2)}
        for merchant_id, name in _MERCHANTS
    }

    return {
        "customers": list(customer_rows.values()),
        "cards": list(card_rows.values()),
        "agents": list(agents_rows.values()),
        "merchants": list(merchants_rows.values()),
        "transactions": ledger.txns,
    }


def _insert(conn: sqlite3.Connection, tables: dict[str, list[dict]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for table, rows in tables.items():
        if not rows:
            counts[table] = 0
            continue
        columns = ", ".join(rows[0].keys())
        placeholders = ", ".join(":" + c for c in rows[0].keys())
        conn.executemany(f"INSERT INTO {table} ({columns}) VALUES ({placeholders})", rows)
        counts[table] = len(rows)
    return counts


def build_demo_db(path, seed: int = 20260902, days: int = 14) -> dict[str, int]:
    """Create (or recreate) a synthetic operational SQLite database.

    Deterministic for a given (seed, days). Returns a per-table row-count
    summary. Safe to call repeatedly — the file is rebuilt from scratch.
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        path.unlink()
    conn = sqlite3.connect(str(path))
    try:
        conn.executescript(SCHEMA_SQL)
        tables = _generate(seed, days)
        counts = _insert(conn, tables)
        conn.commit()
        return counts
    finally:
        conn.close()


if __name__ == "__main__":
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "demo.db"
        summary = build_demo_db(out, days=14)
        print("demo summary:", summary)
