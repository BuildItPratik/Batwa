"""
TapWallet — Wallet Routes
POST /wallet/topup
POST /wallet/pay
GET  /wallet/balance/{customer_id}
"""

from fastapi import APIRouter, HTTPException
from models import (
    TopupRequest, TopupResponse,
    PayRequest, PayResponse,
    BalanceResponse,
)
from database import get_db, get_db_readonly
from services.txn_service import process_topup, process_payment

router = APIRouter(prefix="/wallet", tags=["Wallet"])


@router.post("/topup", response_model=TopupResponse)
def topup(req: TopupRequest):
    """Agent loads cash onto a customer's card. Debits agent float, credits customer balance."""
    with get_db() as conn:
        result = process_topup(conn, req.agent_id, req.card_id, req.amount)
    return TopupResponse(**result)


@router.post("/pay", response_model=PayResponse)
def pay(req: PayRequest):
    """Merchant-initiated payment. Requires customer PIN."""
    with get_db() as conn:
        result = process_payment(conn, req.merchant_id, req.card_id, req.amount, req.pin)
    return PayResponse(**result)


@router.get("/balance/{customer_id}", response_model=BalanceResponse)
def get_balance(customer_id: str):
    """Check a customer's wallet balance and active card status."""
    with get_db_readonly() as conn:
        customer = conn.execute(
            "SELECT balance FROM customers WHERE customer_id = ?",
            (customer_id,),
        ).fetchone()

        if customer is None:
            raise HTTPException(status_code=404, detail="Customer not found")

        # Find the active card (if any)
        active_card = conn.execute(
            "SELECT status FROM cards WHERE customer_id = ? AND status = 'active' LIMIT 1",
            (customer_id,),
        ).fetchone()

        card_status = active_card["status"] if active_card else "no_active_card"

    return BalanceResponse(
        customer_id=customer_id,
        balance=customer["balance"],
        card_status=card_status,
    )
