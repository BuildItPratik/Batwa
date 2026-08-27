"""
TapWallet — Transaction Service
Core wallet logic: atomic top-ups and payments.

Every operation wraps all reads + writes in a single SQLite transaction
(the caller's get_db() context manager handles BEGIN IMMEDIATE / COMMIT / ROLLBACK).
"""

import uuid
from services.pin_service import verify_pin

# Maximum allowed amount per payment (₹100 limit)
PAYMENT_LIMIT = 100.0


def _new_txn_id() -> str:
    return f"TXN-{uuid.uuid4().hex[:12].upper()}"


# ── Top-up ────────────────────────────────────────────────────────────────

def process_topup(conn, agent_id: str, card_id: str, amount: float) -> dict:
    """
    Atomic top-up: credit customer, debit agent float, record transaction.
    Returns a dict matching TopupResponse fields.
    """
    txn_id = _new_txn_id()

    # 1. Resolve card → customer
    card = conn.execute(
        "SELECT customer_id, status FROM cards WHERE card_id = ?", (card_id,)
    ).fetchone()

    if card is None:
        return _fail_topup(txn_id, None, "CARD_NOT_FOUND", conn, agent_id, amount)

    if card["status"] != "active":
        return _fail_topup(txn_id, card["customer_id"], "BLOCKED_CARD", conn, agent_id, amount)

    customer_id = card["customer_id"]

    # 2. Check agent exists and has enough float
    agent = conn.execute(
        "SELECT float_balance FROM agents WHERE agent_id = ?", (agent_id,)
    ).fetchone()

    if agent is None:
        return _fail_topup(txn_id, customer_id, "AGENT_NOT_FOUND", conn, agent_id, amount)

    if agent["float_balance"] < amount:
        return _fail_topup(txn_id, customer_id, "AGENT_FLOAT_INSUFFICIENT", conn, agent_id, amount)

    # 3. Atomic balance update
    conn.execute(
        "UPDATE customers SET balance = balance + ? WHERE customer_id = ?",
        (amount, customer_id),
    )
    conn.execute(
        "UPDATE agents SET float_balance = float_balance - ? WHERE agent_id = ?",
        (amount, agent_id),
    )

    # 4. Record transaction
    conn.execute(
        """INSERT INTO transactions (txn_id, type, customer_id, counterparty_id, amount, status, failure_reason)
           VALUES (?, 'TOPUP', ?, ?, ?, 'SUCCESS', NULL)""",
        (txn_id, customer_id, agent_id, amount),
    )

    # 5. Read back updated balances
    new_cust = conn.execute(
        "SELECT balance FROM customers WHERE customer_id = ?", (customer_id,)
    ).fetchone()
    new_agent = conn.execute(
        "SELECT float_balance FROM agents WHERE agent_id = ?", (agent_id,)
    ).fetchone()

    return {
        "status": "SUCCESS",
        "new_customer_balance": new_cust["balance"],
        "agent_float_remaining": new_agent["float_balance"],
        "txn_id": txn_id,
        "failure_reason": None,
    }


def _fail_topup(txn_id, customer_id, reason, conn, agent_id, amount):
    conn.execute(
        """INSERT INTO transactions (txn_id, type, customer_id, counterparty_id, amount, status, failure_reason)
           VALUES (?, 'TOPUP', ?, ?, ?, 'FAILED', ?)""",
        (txn_id, customer_id, agent_id, amount, reason),
    )
    return {
        "status": "FAILED",
        "failure_reason": reason,
        "new_customer_balance": None,
        "agent_float_remaining": None,
        "txn_id": txn_id,
    }


# ── Payment ───────────────────────────────────────────────────────────────

def process_payment(conn, merchant_id: str, card_id: str, amount: float, pin: str) -> dict:
    """
    Atomic payment: verify PIN, enforce ₹100 limit, check balance,
    debit customer, credit merchant, record transaction.
    Returns a dict matching PayResponse fields.
    """
    txn_id = _new_txn_id()

    # 1. Enforce ₹100 per-transaction limit (backend — never trust frontend)
    if amount > PAYMENT_LIMIT:
        return _fail_payment(txn_id, None, merchant_id, amount, "LIMIT_EXCEEDED", conn)

    # 2. Resolve card → customer
    card = conn.execute(
        "SELECT customer_id, status FROM cards WHERE card_id = ?", (card_id,)
    ).fetchone()

    if card is None:
        return _fail_payment(txn_id, None, merchant_id, amount, "CARD_NOT_FOUND", conn)

    if card["status"] != "active":
        return _fail_payment(txn_id, card["customer_id"], merchant_id, amount, "BLOCKED_CARD", conn)

    customer_id = card["customer_id"]

    # 3. Fetch customer and verify PIN
    customer = conn.execute(
        "SELECT balance, pin_hash FROM customers WHERE customer_id = ?",
        (customer_id,),
    ).fetchone()

    if not verify_pin(pin, customer["pin_hash"]):
        return _fail_payment(txn_id, customer_id, merchant_id, amount, "WRONG_PIN", conn)

    # 4. Check sufficient balance
    if customer["balance"] < amount:
        return _fail_payment(txn_id, customer_id, merchant_id, amount, "INSUFFICIENT_BALANCE", conn)

    # 5. Check merchant exists
    merchant = conn.execute(
        "SELECT wallet_balance FROM merchants WHERE merchant_id = ?",
        (merchant_id,),
    ).fetchone()

    if merchant is None:
        return _fail_payment(txn_id, customer_id, merchant_id, amount, "MERCHANT_NOT_FOUND", conn)

    # 6. Atomic balance update
    conn.execute(
        "UPDATE customers SET balance = balance - ? WHERE customer_id = ?",
        (amount, customer_id),
    )
    conn.execute(
        "UPDATE merchants SET wallet_balance = wallet_balance + ? WHERE merchant_id = ?",
        (amount, merchant_id),
    )

    # 7. Record transaction
    conn.execute(
        """INSERT INTO transactions (txn_id, type, customer_id, counterparty_id, amount, status, failure_reason)
           VALUES (?, 'PAYMENT', ?, ?, ?, 'SUCCESS', NULL)""",
        (txn_id, customer_id, merchant_id, amount),
    )

    # 8. Read back updated balance
    new_cust = conn.execute(
        "SELECT balance FROM customers WHERE customer_id = ?", (customer_id,)
    ).fetchone()

    return {
        "status": "SUCCESS",
        "new_customer_balance": new_cust["balance"],
        "txn_id": txn_id,
        "failure_reason": None,
    }


def _fail_payment(txn_id, customer_id, merchant_id, amount, reason, conn):
    conn.execute(
        """INSERT INTO transactions (txn_id, type, customer_id, counterparty_id, amount, status, failure_reason)
           VALUES (?, 'PAYMENT', ?, ?, ?, 'FAILED', ?)""",
        (txn_id, customer_id, merchant_id, amount, reason),
    )
    return {
        "status": "FAILED",
        "failure_reason": reason,
        "new_customer_balance": None,
        "txn_id": txn_id,
    }
