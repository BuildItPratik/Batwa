#!/usr/bin/env python3
"""
Batwa — Pre-Demo Warm-Up Script

Render's free tier spins down after 15 minutes of inactivity. The first
request after a cold start can take 30-50 seconds while the container
re-deploys.  Run this script ~2 minutes before your demo to:

  1. Wake the backend (hits the health endpoint until it responds).
  2. Exercise every read + write path so Python imports, DB connections,
     and bcrypt are all warm in memory.
  3. Print a colour-coded go/no-go checklist.

Usage:
    python scripts/warmup.py                          # default: http://localhost:8000
    python scripts/warmup.py https://batwa.onrender.com  # deployed URL

The script is idempotent — it registers a throwaway customer, tops up,
pays, blocks, reissues, and queries transactions/stats.  All of this
uses the seed agent AGT-001 and merchant MER-001 which seed.py creates.
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request

# Force UTF-8 on Windows so emoji/special chars don't crash on cp1252
if sys.platform == "win32":
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://localhost:8000"
TIMEOUT = 10          # seconds per individual request
WAKE_RETRIES = 12     # health-check retries (12 x 5s = 60s max wait)
WAKE_INTERVAL = 5     # seconds between retries

AGENT_ID = "AGT-001"
MERCHANT_ID = "MER-001"
TEST_PIN = "9999"     # throwaway customer PIN

# Colours (ANSI — works in Windows Terminal, macOS Terminal, VS Code, etc.)
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def post(path: str, body: dict) -> tuple[dict, int]:
    """POST JSON -> (response_body, status_code)."""
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        resp = urllib.request.urlopen(req, timeout=TIMEOUT)
        return json.loads(resp.read()), resp.status
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return json.loads(raw), e.code
        except (json.JSONDecodeError, ValueError):
            return {"_raw": raw.decode(errors="replace"), "_error": True}, e.code


def get(path: str) -> tuple[dict, int]:
    """GET -> (response_body, status_code)."""
    req = urllib.request.Request(f"{BASE}{path}", method="GET")
    try:
        resp = urllib.request.urlopen(req, timeout=TIMEOUT)
        return json.loads(resp.read()), resp.status
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return json.loads(raw), e.code
        except (json.JSONDecodeError, ValueError):
            return {"_raw": raw.decode(errors="replace"), "_error": True}, e.code


def ok(label: str):
    print(f"  {GREEN}✔{RESET}  {label}")


def fail(label: str, detail: str = ""):
    extra = f"  — {detail}" if detail else ""
    print(f"  {RED}✘{RESET}  {label}{extra}")


# ---------------------------------------------------------------------------
# Phase 1 — Wake the backend
# ---------------------------------------------------------------------------

def wake():
    print(f"\n{BOLD}{CYAN}Phase 1 · Waking backend{RESET}  ({BASE})\n")
    for attempt in range(1, WAKE_RETRIES + 1):
        try:
            body, status = get("/")
            if status == 200 and body.get("status") == "ok":
                ok(f"Backend alive on attempt {attempt}  (v{body.get('version', '?')})")
                return True
        except Exception:
            pass
        dots = "." * attempt
        print(f"  {YELLOW}...{RESET}  Waiting for cold start{dots} ({attempt * WAKE_INTERVAL}s)")
        time.sleep(WAKE_INTERVAL)

    fail("Backend did not respond after 60 seconds")
    return False


# ---------------------------------------------------------------------------
# Phase 2 — Warm every code path
# ---------------------------------------------------------------------------

def warm():
    print(f"\n{BOLD}{CYAN}Phase 2 · Warming all endpoints{RESET}\n")
    results = []
    tag = f"WARMUP-{int(time.time())}"

    # 1. Register a throwaway customer
    body, status = post("/customers/register", {
        "name": f"Warmup User {tag}",
        "phone": "0000000000",
        "pin": TEST_PIN,
        "language_pref": "en",
    })
    if status == 200 and body.get("customer_id"):
        cust_id = body["customer_id"]
        card_id = body["card_id"]
        ok(f"POST /customers/register  →  {cust_id}, {card_id}")
        results.append(True)
    else:
        fail("POST /customers/register", str(body))
        results.append(False)
        return results  # can't continue without a customer

    # 2. Top-up
    body, status = post("/wallet/topup", {
        "agent_id": AGENT_ID,
        "card_id": card_id,
        "amount": 80,
    })
    if status == 200 and body.get("status") == "SUCCESS":
        ok(f"POST /wallet/topup  →  balance Rs.{body.get('new_customer_balance', '?')}")
        results.append(True)
    else:
        fail("POST /wallet/topup", str(body))
        results.append(False)

    # 3. Payment (correct PIN — warms bcrypt verify)
    body, status = post("/wallet/pay", {
        "merchant_id": MERCHANT_ID,
        "card_id": card_id,
        "amount": 10,
        "pin": TEST_PIN,
    })
    if status == 200 and body.get("status") == "SUCCESS":
        ok(f"POST /wallet/pay  →  txn {body.get('txn_id', '?')}")
        results.append(True)
    else:
        fail("POST /wallet/pay", str(body))
        results.append(False)

    # 4. Balance check
    body, status = get(f"/wallet/balance/{cust_id}")
    if status == 200 and "balance" in body:
        ok(f"GET  /wallet/balance  →  Rs.{body['balance']}")
        results.append(True)
    else:
        fail("GET /wallet/balance", str(body))
        results.append(False)

    # 5. Block card
    body, status = post("/cards/block", {"card_id": card_id})
    if status == 200:
        ok(f"POST /cards/block  →  {card_id} blocked")
        results.append(True)
    else:
        fail("POST /cards/block", str(body))
        results.append(False)

    # 6. Reissue
    body, status = post("/cards/reissue", {"customer_id": cust_id})
    if status == 200 and body.get("new_card_id"):
        ok(f"POST /cards/reissue  →  {body['new_card_id']}")
        results.append(True)
    else:
        fail("POST /cards/reissue", str(body))
        results.append(False)

    # 7. Transaction history
    body, status = get(f"/transactions?customer_id={cust_id}")
    if status == 200 and isinstance(body, dict) and "transactions" in body:
        ok(f"GET  /transactions  ->  {len(body['transactions'])} records")
        results.append(True)
    else:
        fail("GET /transactions", str(body))
        results.append(False)

    # 8. Admin stats
    body, status = get("/admin/stats")
    if status == 200:
        ok(f"GET  /admin/stats  →  {body}")
        results.append(True)
    else:
        fail("GET /admin/stats", str(body))
        results.append(False)

    return results


# ---------------------------------------------------------------------------
# Phase 3 — Verdict
# ---------------------------------------------------------------------------

def main():
    print(f"\n{'=' * 60}")
    print(f"{BOLD}  Batwa — Pre-Demo Warm-Up{RESET}")
    print(f"{'=' * 60}")

    if not wake():
        print(f"\n  {RED}{BOLD}ABORT{RESET}  Backend unreachable. Check the URL and try again.\n")
        sys.exit(1)

    results = warm()
    passed = sum(results)
    total = len(results)

    print(f"\n{'─' * 60}")
    if passed == total:
        print(f"  {GREEN}{BOLD}ALL CLEAR{RESET}  {passed}/{total} endpoints warm and healthy")
        print(f"  {GREEN}You're good to demo!{RESET}")
    else:
        print(f"  {YELLOW}{BOLD}WARNING{RESET}  {passed}/{total} passed — check failures above")
    print(f"{'─' * 60}\n")


if __name__ == "__main__":
    main()
