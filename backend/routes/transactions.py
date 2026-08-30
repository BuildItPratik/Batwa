"""
Batwa — Transaction History Route
GET /transactions
"""

from fastapi import APIRouter, Depends, Query
from typing import Optional
from models import TransactionItem, TransactionsResponse
from database import get_db_readonly
from services.admin_auth import require_admin

router = APIRouter(tags=["Transactions"])


@router.get("/transactions", response_model=TransactionsResponse)
def list_transactions(
    customer_id: Optional[str] = Query(None),
    agent_id: Optional[str] = Query(None),
    merchant_id: Optional[str] = Query(None),
    _: None = Depends(require_admin),
):
    """
    Return filtered transaction history.
    Filters are additive (AND logic). If no filters, returns all transactions.
    """
    query = "SELECT * FROM transactions WHERE 1=1"
    params = []

    if customer_id:
        query += " AND customer_id = ?"
        params.append(customer_id)

    if agent_id:
        # Agent appears as counterparty_id on TOPUP transactions
        query += " AND counterparty_id = ? AND type = 'TOPUP'"
        params.append(agent_id)

    if merchant_id:
        # Merchant appears as counterparty_id on PAYMENT transactions
        query += " AND counterparty_id = ? AND type = 'PAYMENT'"
        params.append(merchant_id)

    # timestamp has one-second resolution, so tie-break on insertion order
    # (rowid) to keep same-second transactions in true order for the live feed.
    query += " ORDER BY timestamp DESC, rowid DESC"

    with get_db_readonly() as conn:
        rows = conn.execute(query, params).fetchall()

    txns = [
        TransactionItem(
            txn_id=row["txn_id"],
            type=row["type"],
            amount=row["amount"],
            status=row["status"],
            timestamp=row["timestamp"] or "",
            customer_id=row["customer_id"],
            counterparty_id=row["counterparty_id"],
            failure_reason=row["failure_reason"],
        )
        for row in rows
    ]

    return TransactionsResponse(transactions=txns)
