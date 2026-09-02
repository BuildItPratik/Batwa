"""
Batwa — Pydantic request/response models
Field names match the API contract exactly. Do not rename.
"""

from pydantic import BaseModel, Field
from typing import Optional, List


# ── Customer Registration ─────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    phone: Optional[str] = None
    pin: str = Field(..., min_length=4, max_length=4, pattern=r"^\d{4}$")
    language_pref: str = Field(default="en", pattern=r"^(en|hi|ta|mr)$")


class RegisterResponse(BaseModel):
    customer_id: str
    card_id: str
    qr_code_base64: str
    status: str


# ── Wallet Top-up ─────────────────────────────────────────────────────────

class TopupRequest(BaseModel):
    agent_id: str
    card_id: str
    amount: float = Field(..., gt=0)


class TopupResponse(BaseModel):
    status: str
    new_customer_balance: Optional[float] = None
    agent_float_remaining: Optional[float] = None
    txn_id: Optional[str] = None
    failure_reason: Optional[str] = None


# ── Wallet Payment ────────────────────────────────────────────────────────

class PayRequest(BaseModel):
    merchant_id: str
    card_id: str
    amount: float = Field(..., gt=0)
    pin: str


class PayResponse(BaseModel):
    status: str
    new_customer_balance: Optional[float] = None
    txn_id: Optional[str] = None
    failure_reason: Optional[str] = None


# ── Card Block ────────────────────────────────────────────────────────────

class BlockRequest(BaseModel):
    card_id: str


class BlockResponse(BaseModel):
    status: str
    card_status: str


# ── Card Reissue ──────────────────────────────────────────────────────────

class ReissueRequest(BaseModel):
    customer_id: str


class ReissueResponse(BaseModel):
    customer_id: str
    new_card_id: str
    qr_code_base64: str
    balance_carried_over: float


# ── Balance Check ─────────────────────────────────────────────────────────

class BalanceResponse(BaseModel):
    customer_id: str
    balance: float
    card_status: str


# ── Transactions ──────────────────────────────────────────────────────────

class TransactionItem(BaseModel):
    txn_id: str
    type: str
    amount: Optional[float] = None
    status: str
    timestamp: str
    customer_id: Optional[str] = None
    counterparty_id: Optional[str] = None
    failure_reason: Optional[str] = None


class TransactionsResponse(BaseModel):
    transactions: List[TransactionItem]


# ── Admin Authentication ─────────────────────────────────────────────────

class AdminAuthRequest(BaseModel):
    pin: str = Field(..., min_length=4, max_length=12, pattern=r"^\d{4,12}$")


class AdminAuthResponse(BaseModel):
    access_token: str
    token_type: str
    expires_in: int


# ── Admin Stats (additive — used by the /admin dashboard only) ───────────

class AdminStatsResponse(BaseModel):
    cash_digitized: float        # sum of SUCCESS TOPUP amounts
    payments_received: float     # sum of SUCCESS PAYMENT amounts
    active_cards: int
    blocked_cards: int
    total_customers: int
    total_transactions: int


# ── Issued Cards (admin-only listing) ───────────────────────────────────

class IssuedCardItem(BaseModel):
    card_id: str
    customer_id: str
    customer_name: Optional[str] = None
    phone: Optional[str] = None
    status: str
    balance: float
    language_pref: str
    created_at: Optional[str] = None


class IssuedCardsResponse(BaseModel):
    cards: List[IssuedCardItem]
    total: int
    active_cards: int
    blocked_cards: int


# ── Analytics (offline pipeline artifacts served read-only) ──────────────

class AnalyticsKpis(BaseModel):
    """Single row of analytics/outputs/kpis_overview.csv."""
    cash_digitized: float
    payments_received: float
    txn_count: int
    success_count: int
    failed_count: int
    active_customers: int
    active_cards: int
    blocked_cards: int
    first_txn_date: Optional[str] = None
    last_txn_date: Optional[str] = None


class AnalyticsDailyVolumeRow(BaseModel):
    date_key: str
    type: str
    status: str
    txn_count: int
    amount_total: float


class AnalyticsFailureReasonRow(BaseModel):
    failure_reason: Optional[str] = None
    attempts: int
    pct_of_failures: float


class AnalyticsTopMerchantRow(BaseModel):
    merchant_name: str
    payments: int
    total_received: float


class AnalyticsQualityChecks(BaseModel):
    passed: int
    total: int
    ok: Optional[bool] = None


class AnalyticsRunStatus(BaseModel):
    run_id: str
    source: str
    ran_at: str
    quality_checks: AnalyticsQualityChecks


class AnalyticsResponse(BaseModel):
    kpis: AnalyticsKpis
    daily_volume: List[AnalyticsDailyVolumeRow]
    failure_by_reason: List[AnalyticsFailureReasonRow]
    top_merchants: List[AnalyticsTopMerchantRow]
    run_status: Optional[AnalyticsRunStatus] = None

