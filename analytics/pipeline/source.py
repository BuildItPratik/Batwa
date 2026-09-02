"""Source abstraction for the Batwa Analytics pipeline.

Every ingest path — the synthetic demo DB, the app's real SQLite file, and the
live deployed API — is wrapped behind one interface: ``Source.fetch()``
returns a mapping of operational table name -> list of row dicts whose keys
match ``config.TABLE_SPEC`` column order. Downstream (``load``) is agnostic to
where the data came from.
"""

from __future__ import annotations

import json
import sqlite3
import urllib.error
import urllib.request
from pathlib import Path

from . import config
from . import demo_data


class SourceError(RuntimeError):
    """Raised when a source cannot be read (bad path, API error, ...)."""


def read_sqlite(path) -> dict[str, list[dict]]:
    """Read all five operational tables from a Batwa SQLite file."""
    path = Path(path)
    if not path.exists():
        raise SourceError(
            f"operational DB not found at {path}. For --source local, seed the "
            f"backend first (backend/seed.py) or use --source demo."
        )
    tables: dict[str, list[dict]] = {}
    try:
        conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    except sqlite3.Error as exc:  # pragma: no cover - defensive
        raise SourceError(f"cannot open {path}: {exc}") from exc
    try:
        conn.row_factory = sqlite3.Row
        for table, spec in config.TABLE_SPEC.items():
            columns = spec["columns"]
            rows = conn.execute(
                f"SELECT {', '.join(columns)} FROM {table}"
            ).fetchall()
            tables[table] = [{col: row[col] for col in columns} for row in rows]
    except sqlite3.Error as exc:
        raise SourceError(f"failed reading {path}: {exc}") from exc
    finally:
        conn.close()
    return tables


class DemoSource:
    """Synthetic, deterministic operational history (offline default)."""

    name = "demo"

    def __init__(self, path=None, seed: int = config.DEFAULT_SEED,
                 days: int = config.DEFAULT_DAYS) -> None:
        self.path = Path(path) if path else config.SAMPLE_DIR / "batwa_demo.db"
        self.seed = seed
        self.days = days

    def describe(self) -> str:
        return (f"demo (synthetic, seed={self.seed}, days={self.days}) -> "
                f"{self.path}")

    def fetch(self) -> dict[str, list[dict]]:
        demo_data.build_demo_db(self.path, seed=self.seed, days=self.days)
        return read_sqlite(self.path)


class LocalSource:
    """The real Batwa SQLite database (backend/batwa.db)."""

    name = "local"

    def __init__(self, path=None) -> None:
        self.path = Path(path) if path else config.BACKEND_DB

    def describe(self) -> str:
        return f"local (real app DB) -> {self.path}"

    def fetch(self) -> dict[str, list[dict]]:
        return read_sqlite(self.path)


class ApiSource:
    """The live deployed Batwa API (bearer-auth transaction feed).

    The API only exposes transactions + aggregates, so dimension tables are
    stubbed from the surrogate keys observed in the feed (documented in the
    add-on README): customers = distinct customer_id seen, agents/merchants =
    distinct counterparty seen per type, cards = empty. Names are the IDs.
    """

    name = "api"

    def __init__(self, base_url: str | None = None,
                 admin_pin: str | None = None) -> None:
        self.base_url = (base_url or config.API_BASE).rstrip("/")
        self.admin_pin = admin_pin if admin_pin is not None else config.ADMIN_PIN
        self._token: str | None = None

    def describe(self) -> str:
        return f"api (live) -> {self.base_url}"

    # -- http helpers ------------------------------------------------------
    def _request(self, method: str, path: str,
                 body: dict | None = None, token: str | None = None) -> dict:
        url = self.base_url + path
        headers = {"Accept": "application/json"}
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode("utf-8")
        if token:
            headers["Authorization"] = f"Bearer {token}"
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=config.API_TIMEOUT_SECONDS) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:200]
            raise SourceError(
                f"API {method} {path} -> HTTP {exc.code}: {detail}"
            ) from exc
        except urllib.error.URLError as exc:
            raise SourceError(
                f"API {method} {path} unreachable ({exc.reason}). Is the "
                f"service up? Override with BATWA_API_BASE."
            ) from exc

    def _authenticate(self) -> str:
        if self._token:
            return self._token
        data = self._request("POST", "/admin/auth", body={"pin": self.admin_pin})
        self._token = data.get("access_token")
        if not self._token:
            raise SourceError("admin auth returned no access_token — check BATWA_ADMIN_PIN.")
        return self._token

    # -- fetch -------------------------------------------------------------
    def fetch(self) -> dict[str, list[dict]]:
        token = self._authenticate()
        feed = self._request("GET", "/transactions", token=token)
        txns = feed.get("transactions", [])

        transactions = [
            {
                "txn_id": t.get("txn_id"),
                "type": t.get("type"),
                "customer_id": t.get("customer_id"),
                "counterparty_id": t.get("counterparty_id"),
                "amount": t.get("amount"),
                "status": t.get("status"),
                "failure_reason": t.get("failure_reason"),
                "timestamp": t.get("timestamp"),
            }
            for t in txns
        ]

        # Stub ID-only dimensions from observed surrogate keys.
        customer_ids = sorted({t["customer_id"] for t in transactions
                               if t["customer_id"] is not None})
        agent_ids = sorted({t["counterparty_id"] for t in transactions
                            if t["type"] == "TOPUP" and t["counterparty_id"]})
        merchant_ids = sorted({t["counterparty_id"] for t in transactions
                               if t["type"] == "PAYMENT" and t["counterparty_id"]})

        customers = [
            {"customer_id": i, "name": i, "phone": None,
             "pin_hash": "API_FEED_PLACEHOLDER", "balance": 0.0,
             "language_pref": "en", "created_at": None}
            for i in customer_ids
        ]
        agents = [
            {"agent_id": i, "name": i, "location": None, "float_balance": 0.0}
            for i in agent_ids
        ]
        merchants = [
            {"merchant_id": i, "name": i, "wallet_balance": 0.0}
            for i in merchant_ids
        ]

        return {
            "customers": customers,
            "cards": [],          # feed exposes no card lifecycle
            "agents": agents,
            "merchants": merchants,
            "transactions": transactions,
        }


# ---------------------------------------------------------------------------
# Resolver
# ---------------------------------------------------------------------------

def resolve(name: str = config.DEFAULT_SOURCE, *, backend_db=None, sample_dir=None,
            api_base=None, admin_pin=None,
            seed: int = config.DEFAULT_SEED, days: int = config.DEFAULT_DAYS) -> object:
    """Return a Source for ``name`` (auto|demo|local|api)."""
    if name not in config.SOURCE_CHOICES:
        raise SourceError(
            f"unknown source {name!r}; choose one of {config.SOURCE_CHOICES}"
        )
    if name == "demo":
        path = sample_dir if sample_dir else None
        return DemoSource(path=path, seed=seed, days=days)
    if name == "api":
        return ApiSource(base_url=api_base, admin_pin=admin_pin)
    if name == "local":
        return LocalSource(path=backend_db)
    # auto — prefer the real DB when it has activity, else fall back to demo.
    backend = Path(backend_db) if backend_db else config.BACKEND_DB
    if backend.exists():
        try:
            with sqlite3.connect(f"file:{backend}?mode=ro", uri=True) as conn:
                (n,) = conn.execute("SELECT COUNT(*) FROM transactions").fetchone()
            if n > 0:
                return LocalSource(path=backend)
        except sqlite3.Error:
            pass
    return DemoSource(path=sample_dir if sample_dir else None, seed=seed, days=days)
