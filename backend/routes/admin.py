"""
Batwa — Admin Routes
POST /admin/auth
GET /admin/stats
GET /admin/cards

Read-only aggregates for the Admin dashboard (Ruchir).
Additive endpoints — no Section 6 contract shapes were changed.
See the root README for the public API overview.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from models import AdminAuthRequest, AdminAuthResponse, AdminStatsResponse, IssuedCardItem, IssuedCardsResponse
from database import get_db_readonly
from services.admin_auth import AdminAuthError, issue_admin_token, require_admin

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.post("/auth", response_model=AdminAuthResponse)
def authenticate(request: AdminAuthRequest):
    try:
        access_token, expires_in = issue_admin_token(request.pin)
    except AdminAuthError:
        raise HTTPException(status_code=401, detail="Invalid admin PIN.")

    return AdminAuthResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=expires_in,
    )


@router.get("/stats", response_model=AdminStatsResponse)
def get_stats(_: None = Depends(require_admin)):
    """Running totals for the admin dashboard:
    cash converted to digital, payments received, card counts."""
    with get_db_readonly() as conn:
        cash_digitized = conn.execute(
            "SELECT COALESCE(SUM(amount), 0) AS total FROM transactions"
            " WHERE type = 'TOPUP' AND status = 'SUCCESS'"
        ).fetchone()["total"]

        payments_received = conn.execute(
            "SELECT COALESCE(SUM(amount), 0) AS total FROM transactions"
            " WHERE type = 'PAYMENT' AND status = 'SUCCESS'"
        ).fetchone()["total"]

        card_counts = conn.execute(
            "SELECT"
            " SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,"
            " SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) AS blocked"
            " FROM cards"
        ).fetchone()

        total_customers = conn.execute(
            "SELECT COUNT(*) AS n FROM customers"
        ).fetchone()["n"]

        total_transactions = conn.execute(
            "SELECT COUNT(*) AS n FROM transactions"
        ).fetchone()["n"]

    return AdminStatsResponse(
        cash_digitized=cash_digitized,
        payments_received=payments_received,
        active_cards=card_counts["active"] or 0,
        blocked_cards=card_counts["blocked"] or 0,
        total_customers=total_customers,
        total_transactions=total_transactions,
    )


@router.get("/cards", response_model=IssuedCardsResponse)
def list_issued_cards(
    status: Optional[str] = Query(None, pattern=r"^(active|blocked)$"),
    _: None = Depends(require_admin),
):
    """All QR cards ever issued, newest first — with holder and wallet context.

    Optional filter:
      ?status=active  — only cards currently usable for payment
      ?status=blocked — lost / reissued / manually blocked
    """
    base_query = """
        SELECT
            c.card_id,
            c.customer_id,
            c.status,
            c.created_at,
            cu.name  AS customer_name,
            cu.phone AS phone,
            cu.balance AS balance,
            cu.language_pref AS language_pref
        FROM cards c
        JOIN customers cu ON cu.customer_id = c.customer_id
    """
    params: list = []
    if status:
        base_query += " WHERE c.status = ?"
        params.append(status)
    base_query += " ORDER BY c.created_at DESC, c.rowid DESC"

    with get_db_readonly() as conn:
        rows = conn.execute(base_query, params).fetchall()
        counts = conn.execute(
            "SELECT"
            " SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,"
            " SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) AS blocked,"
            " COUNT(*) AS total"
            " FROM cards"
        ).fetchone()

    cards = [
        IssuedCardItem(
            card_id=row["card_id"],
            customer_id=row["customer_id"],
            customer_name=row["customer_name"],
            phone=row["phone"],
            status=row["status"],
            balance=row["balance"] if row["balance"] is not None else 0.0,
            language_pref=row["language_pref"] or "en",
            created_at=row["created_at"] or "",
        )
        for row in rows
    ]

    return IssuedCardsResponse(
        cards=cards,
        total=counts["total"] or 0,
        active_cards=counts["active"] or 0,
        blocked_cards=counts["blocked"] or 0,
    )
