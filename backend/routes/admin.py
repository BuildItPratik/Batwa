"""
Batwa — Admin Routes
GET /admin/stats

Read-only aggregates for the Admin dashboard (Ruchir).
Additive endpoint — no Section 6 contract shapes were changed.
See the root README for the public API overview.
"""

from fastapi import APIRouter
from models import AdminStatsResponse
from database import get_db_readonly

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/stats", response_model=AdminStatsResponse)
def get_stats():
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
