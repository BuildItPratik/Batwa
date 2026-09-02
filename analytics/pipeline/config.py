"""Central configuration for the Batwa Analytics pipeline.

Holds filesystem layout, source selection, environment overrides, and the
operational table contract (columns + natural keys) that every extractor and
the raw landing layer must agree on.

Paths are derived from this file's location so the package works from any CWD.
"""

from __future__ import annotations

import os
from pathlib import Path

# ---------------------------------------------------------------------------
# Filesystem layout
# ---------------------------------------------------------------------------

PIPELINE_DIR = Path(__file__).resolve().parent            # analytics/pipeline
ANALYTICS_DIR = PIPELINE_DIR.parent                       # analytics
REPO_ROOT = ANALYTICS_DIR.parent                          # repo root (backend/, docs/, ...)

BACKEND_DB = REPO_ROOT / "backend" / "batwa.db"           # real app SQLite source
WAREHOUSE_DIR = ANALYTICS_DIR / "warehouse"
WAREHOUSE_PATH = WAREHOUSE_DIR / "batwa.duckdb"
OUTPUTS_DIR = ANALYTICS_DIR / "outputs"
SAMPLE_DIR = ANALYTICS_DIR / "sampledata"

MODELS_DIR = PIPELINE_DIR / "models"                      # SQL model files (silver/gold)
CHECKS_DIR = PIPELINE_DIR / "checks"                      # data-quality check files


def ensure_layout() -> None:
    """Create runtime directories that are gitignored."""
    WAREHOUSE_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    SAMPLE_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Source selection
# ---------------------------------------------------------------------------

# demo  -> synthetic, deterministic, offline (out-of-the-box default)
# local -> the real backend/batwa.db
# api   -> the live deployed API (bearer-auth transaction feed)
# auto  -> prefer `local` when backend/batwa.db has activity, else `demo`
SOURCE_CHOICES = ("auto", "demo", "local", "api")
DEFAULT_SOURCE = "auto"

# Live API (deployed Batwa backend). Env names mirror the backend's own
# conventions (BATWA_ADMIN_PIN is already used by backend/.env.example).
API_BASE = os.getenv("BATWA_API_BASE", "https://batwa-xrt4.onrender.com").rstrip("/")
ADMIN_PIN = os.getenv("BATWA_ADMIN_PIN", "2468")
API_TIMEOUT_SECONDS = float(os.getenv("BATWA_API_TIMEOUT", "30"))

# Synthetic demo-source knobs.
DEFAULT_SEED = 20260902
DEFAULT_DAYS = 14

# ---------------------------------------------------------------------------
# Operational table contract (mirrors backend/database.py SCHEMA_SQL)
# ---------------------------------------------------------------------------
# Column order is the canonical order used by raw landing DDL, sqlite reads,
# the API mapper, and DuckDB inserts. `primary_key` drives idempotent loads:
# fact/dimension tables land append-on-new-rows keyed on it.
TABLE_SPEC = {
    "customers": {
        "columns": [
            "customer_id", "name", "phone", "pin_hash",
            "balance", "language_pref", "created_at",
        ],
        "primary_key": "customer_id",
    },
    "cards": {
        "columns": ["card_id", "customer_id", "status", "created_at"],
        "primary_key": "card_id",
    },
    "agents": {
        "columns": ["agent_id", "name", "location", "float_balance"],
        "primary_key": "agent_id",
    },
    "merchants": {
        "columns": ["merchant_id", "name", "wallet_balance"],
        "primary_key": "merchant_id",
    },
    "transactions": {
        "columns": [
            "txn_id", "type", "customer_id", "counterparty_id",
            "amount", "status", "failure_reason", "timestamp",
        ],
        "primary_key": "txn_id",
    },
}

# Natural order the five operational tables appear in a full snapshot.
TABLE_ORDER = ["customers", "cards", "agents", "merchants", "transactions"]

# Closed value sets enforced by the data-quality suite. Taken from
# backend/services/txn_service.py, backend/routes/cards.py and
# docs/API_REFERENCE.md. Note AGENT_NOT_FOUND is emitted by the code but is
# missing from the API reference doc — deliberately kept in the whitelist.
TXN_TYPES = ("TOPUP", "PAYMENT", "REISSUE", "BLOCK")
TXN_STATUSES = ("SUCCESS", "FAILED")
FAILURE_REASONS = (
    "WRONG_PIN",
    "INSUFFICIENT_BALANCE",
    "BLOCKED_CARD",
    "LIMIT_EXCEEDED",
    "AGENT_FLOAT_INSUFFICIENT",
    "AGENT_NOT_FOUND",
    "CARD_NOT_FOUND",
    "MERCHANT_NOT_FOUND",
)

# Backend-enforced business rule (services/txn_service.py).
PAYMENT_LIMIT = 100.0
