"""
Batwa — Seed Script
Populates the database with test data for development and team testing.

Run: python seed.py
"""

import sys
import os

# Ensure the backend package is importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import init_db, get_db
from services.pin_service import hash_pin


def seed():
    """Insert test agents, merchants, and customers with known PINs."""
    init_db()

    # Default PIN for all test customers (team knows this)
    default_pin_hash = hash_pin("1234")

    with get_db() as conn:
        # ── Agents ────────────────────────────────────────────────
        agents = [
            ("AGT-001", "Agent Priya - Downtown", "MG Road, Pune", 10000),
            ("AGT-002", "Agent Suresh - Station", "Railway Station, Pune", 10000),
        ]
        for agent_id, name, location, balance in agents:
            conn.execute(
                """INSERT OR IGNORE INTO agents (agent_id, name, location, float_balance)
                   VALUES (?, ?, ?, ?)""",
                (agent_id, name, location, balance),
            )

        # ── Merchants ─────────────────────────────────────────────
        merchants = [
            ("MER-001", "Annapurna Vegetables", 0),
            ("MER-002", "Ravi Tea Stall", 0),
        ]
        for merchant_id, name, balance in merchants:
            conn.execute(
                """INSERT OR IGNORE INTO merchants (merchant_id, name, wallet_balance)
                   VALUES (?, ?, ?)""",
                (merchant_id, name, balance),
            )

        # ── Test Customers ────────────────────────────────────────
        customers = [
            ("CUST-TEST01", "Ramesh Kumar", "9876543210", "hi"),
            ("CUST-TEST02", "Lakshmi Devi", "9876543211", "ta"),
            ("CUST-TEST03", "Arjun Singh", "9876543212", "en"),
            ("CUST-TEST04", "Meena Kumari", "9876543213", "hi"),
            ("CUST-TEST05", "Ravi Shankar", "9876543214", "en"),
        ]
        for cust_id, name, phone, lang in customers:
            conn.execute(
                """INSERT OR IGNORE INTO customers (customer_id, name, phone, pin_hash, balance, language_pref)
                   VALUES (?, ?, ?, ?, 0, ?)""",
                (cust_id, name, phone, default_pin_hash, lang),
            )

        # ── Test Cards (one active card per customer) ─────────────
        cards = [
            ("CARD-TEST01", "CUST-TEST01"),
            ("CARD-TEST02", "CUST-TEST02"),
            ("CARD-TEST03", "CUST-TEST03"),
            ("CARD-TEST04", "CUST-TEST04"),
            ("CARD-TEST05", "CUST-TEST05"),
        ]
        for card_id, cust_id in cards:
            conn.execute(
                """INSERT OR IGNORE INTO cards (card_id, customer_id, status)
                   VALUES (?, ?, 'active')""",
                (card_id, cust_id),
            )

    print("[OK] Seed data inserted successfully!")
    print()
    print("  Agents:    AGT-001, AGT-002  (float: 10,000 each)")
    print("  Merchants: MER-001, MER-002")
    print("  Customers: CUST-TEST01 to CUST-TEST05  (PIN: 1234, balance: 0)")
    print("  Cards:     CARD-TEST01 to CARD-TEST05  (status: active)")


if __name__ == "__main__":
    seed()
