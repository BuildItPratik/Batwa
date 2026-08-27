"""
TapWallet — Card Management Routes
POST /cards/block
POST /cards/reissue
"""

import uuid
from fastapi import APIRouter, HTTPException
from models import BlockRequest, BlockResponse, ReissueRequest, ReissueResponse
from database import get_db
from services.qr_service import generate_qr_base64

router = APIRouter(prefix="/cards", tags=["Cards"])


def _new_card_id() -> str:
    return f"CARD-{uuid.uuid4().hex[:6].upper()}"


@router.post("/block", response_model=BlockResponse)
def block_card(req: BlockRequest):
    """Block a specific card by card_id."""
    with get_db() as conn:
        card = conn.execute(
            "SELECT customer_id, status FROM cards WHERE card_id = ?",
            (req.card_id,),
        ).fetchone()

        if card is None:
            raise HTTPException(status_code=404, detail="Card not found")

        if card["status"] == "blocked":
            return BlockResponse(status="SUCCESS", card_status="blocked")

        conn.execute(
            "UPDATE cards SET status = 'blocked' WHERE card_id = ?",
            (req.card_id,),
        )

        # Record BLOCK transaction
        txn_id = f"TXN-{uuid.uuid4().hex[:12].upper()}"
        conn.execute(
            """INSERT INTO transactions (txn_id, type, customer_id, counterparty_id, amount, status, failure_reason)
               VALUES (?, 'BLOCK', ?, NULL, NULL, 'SUCCESS', NULL)""",
            (txn_id, card["customer_id"]),
        )

    return BlockResponse(status="SUCCESS", card_status="blocked")


@router.post("/reissue", response_model=ReissueResponse)
def reissue_card(req: ReissueRequest):
    """
    Reissue a card for a customer:
    1. Block all existing active cards for this customer
    2. Create a new card linked to the same customer
    3. Balance stays on the customer — no migration
    """
    new_card_id = _new_card_id()

    with get_db() as conn:
        # Verify customer exists
        customer = conn.execute(
            "SELECT balance FROM customers WHERE customer_id = ?",
            (req.customer_id,),
        ).fetchone()

        if customer is None:
            raise HTTPException(status_code=404, detail="Customer not found")

        # Avoid card_id collision
        while conn.execute(
            "SELECT 1 FROM cards WHERE card_id = ?", (new_card_id,)
        ).fetchone():
            new_card_id = _new_card_id()

        # Block all existing active cards for this customer
        conn.execute(
            "UPDATE cards SET status = 'blocked' WHERE customer_id = ? AND status = 'active'",
            (req.customer_id,),
        )

        # Create new card
        conn.execute(
            "INSERT INTO cards (card_id, customer_id, status) VALUES (?, ?, 'active')",
            (new_card_id, req.customer_id),
        )

        # Record REISSUE transaction
        txn_id = f"TXN-{uuid.uuid4().hex[:12].upper()}"
        conn.execute(
            """INSERT INTO transactions (txn_id, type, customer_id, counterparty_id, amount, status, failure_reason)
               VALUES (?, 'REISSUE', ?, NULL, NULL, 'SUCCESS', NULL)""",
            (txn_id, req.customer_id),
        )

    # Generate QR for the new card
    qr_b64 = generate_qr_base64(new_card_id)

    return ReissueResponse(
        customer_id=req.customer_id,
        new_card_id=new_card_id,
        qr_code_base64=qr_b64,
        balance_carried_over=customer["balance"],
    )
