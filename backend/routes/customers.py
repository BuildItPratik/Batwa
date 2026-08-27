"""
TapWallet — Customer Registration Route
POST /customers/register
"""

import uuid
from fastapi import APIRouter, HTTPException
from models import RegisterRequest, RegisterResponse
from database import get_db
from services.pin_service import hash_pin
from services.qr_service import generate_qr_base64

router = APIRouter(prefix="/customers", tags=["Customers"])


def _new_customer_id() -> str:
    return f"CUST-{uuid.uuid4().hex[:6].upper()}"


def _new_card_id() -> str:
    return f"CARD-{uuid.uuid4().hex[:6].upper()}"


@router.post("/register", response_model=RegisterResponse)
def register_customer(req: RegisterRequest):
    """Register a new customer: create customer + first card + QR code."""

    customer_id = _new_customer_id()
    card_id = _new_card_id()
    pin_hashed = hash_pin(req.pin)

    with get_db() as conn:
        # Check for (unlikely) ID collision
        while conn.execute(
            "SELECT 1 FROM customers WHERE customer_id = ?", (customer_id,)
        ).fetchone():
            customer_id = _new_customer_id()

        while conn.execute(
            "SELECT 1 FROM cards WHERE card_id = ?", (card_id,)
        ).fetchone():
            card_id = _new_card_id()

        # Insert customer
        conn.execute(
            """INSERT INTO customers (customer_id, name, phone, pin_hash, balance, language_pref)
               VALUES (?, ?, ?, ?, 0, ?)""",
            (customer_id, req.name, req.phone, pin_hashed, req.language_pref),
        )

        # Insert first card
        conn.execute(
            "INSERT INTO cards (card_id, customer_id, status) VALUES (?, ?, 'active')",
            (card_id, customer_id),
        )

    # Generate QR code (encodes the card_id, not customer_id)
    qr_b64 = generate_qr_base64(card_id)

    return RegisterResponse(
        customer_id=customer_id,
        card_id=card_id,
        qr_code_base64=qr_b64,
        status="active",
    )
