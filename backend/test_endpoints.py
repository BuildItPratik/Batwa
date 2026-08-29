"""
Quick integration test — hits every endpoint and validates responses.
Run while the server is running on port 8000.
"""

import urllib.request
import json
import sys

BASE = "http://127.0.0.1:8000"
PASS = 0
FAIL = 0


def post(path, data):
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=json.dumps(data).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        resp = urllib.request.urlopen(req)
        return json.loads(resp.read()), resp.status
    except urllib.error.HTTPError as e:
        return json.loads(e.read()), e.code


def get(path):
    resp = urllib.request.urlopen(f"{BASE}{path}")
    return json.loads(resp.read()), resp.status


def check(name, condition, detail=""):
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  [PASS] {name}")
    else:
        FAIL += 1
        print(f"  [FAIL] {name} -- {detail}")


print("=" * 60)
print("Batwa API Integration Tests")
print("=" * 60)

# ── 1. Register a new customer ─────────────────────────────
print("\n1. POST /customers/register")
body, status = post("/customers/register", {
    "name": "Test User", "phone": "9999999999", "pin": "5678", "language_pref": "mr"
})
check("Status 200", status == 200, f"got {status}")
check("Has customer_id", "customer_id" in body, str(body))
check("Has card_id", "card_id" in body, str(body))
check("Has qr_code_base64", "qr_code_base64" in body and len(body.get("qr_code_base64", "")) > 50)
check("Status is active", body.get("status") == "active")

NEW_CUST = body.get("customer_id", "")
NEW_CARD = body.get("card_id", "")
print(f"  -> Created: {NEW_CUST} / {NEW_CARD}")

# ── 2. Top-up with seed data ──────────────────────────────
print("\n2. POST /wallet/topup (seed card CARD-TEST01)")
body, status = post("/wallet/topup", {
    "agent_id": "AGT-001", "card_id": "CARD-TEST01", "amount": 80
})
check("Status 200", status == 200, f"got {status}")
check("Topup SUCCESS", body.get("status") == "SUCCESS", str(body))
check("Customer balance = 80", body.get("new_customer_balance") == 80, str(body))
check("Agent float = 9920", body.get("agent_float_remaining") == 9920, str(body))
check("Has txn_id", body.get("txn_id", "").startswith("TXN-"))

# ── 3. Payment with correct PIN ───────────────────────────
print("\n3. POST /wallet/pay (correct PIN)")
body, status = post("/wallet/pay", {
    "merchant_id": "MER-001", "card_id": "CARD-TEST01", "amount": 40, "pin": "1234"
})
check("Status 200", status == 200, f"got {status}")
check("Payment SUCCESS", body.get("status") == "SUCCESS", str(body))
check("Customer balance = 40", body.get("new_customer_balance") == 40, str(body))

# ── 4. Payment with WRONG PIN ─────────────────────────────
print("\n4. POST /wallet/pay (wrong PIN)")
body, status = post("/wallet/pay", {
    "merchant_id": "MER-001", "card_id": "CARD-TEST01", "amount": 10, "pin": "0000"
})
check("Payment FAILED", body.get("status") == "FAILED")
check("Reason = WRONG_PIN", body.get("failure_reason") == "WRONG_PIN", body.get("failure_reason"))

# ── 5. Payment over limit ─────────────────────────────────
print("\n5. POST /wallet/pay (over 100 limit)")
body, status = post("/wallet/pay", {
    "merchant_id": "MER-001", "card_id": "CARD-TEST01", "amount": 120, "pin": "1234"
})
check("Payment FAILED", body.get("status") == "FAILED")
check("Reason = LIMIT_EXCEEDED", body.get("failure_reason") == "LIMIT_EXCEEDED", body.get("failure_reason"))

# ── 6. Payment insufficient balance ───────────────────────
print("\n6. POST /wallet/pay (insufficient balance)")
body, status = post("/wallet/pay", {
    "merchant_id": "MER-001", "card_id": "CARD-TEST01", "amount": 99, "pin": "1234"
})
check("Payment FAILED", body.get("status") == "FAILED")
check("Reason = INSUFFICIENT_BALANCE", body.get("failure_reason") == "INSUFFICIENT_BALANCE", body.get("failure_reason"))

# ── 7. Check balance ──────────────────────────────────────
print("\n7. GET /wallet/balance/CUST-TEST01")
body, status = get("/wallet/balance/CUST-TEST01")
check("Status 200", status == 200)
check("Balance = 40", body.get("balance") == 40, f"got {body.get('balance')}")
check("Card status = active", body.get("card_status") == "active")

# ── 8. Block card ─────────────────────────────────────────
print("\n8. POST /cards/block (CARD-TEST02)")
body, status = post("/cards/block", {"card_id": "CARD-TEST02"})
check("Block SUCCESS", body.get("status") == "SUCCESS")
check("Card status = blocked", body.get("card_status") == "blocked")

# ── 9. Pay on blocked card ────────────────────────────────
print("\n9. POST /wallet/pay (blocked card)")
# First topup CUST-TEST02 via a different approach - it has 0 balance anyway
body, status = post("/wallet/pay", {
    "merchant_id": "MER-001", "card_id": "CARD-TEST02", "amount": 10, "pin": "1234"
})
check("Payment FAILED", body.get("status") == "FAILED")
check("Reason = BLOCKED_CARD", body.get("failure_reason") == "BLOCKED_CARD", body.get("failure_reason"))

# ── 10. Reissue card ─────────────────────────────────────
print("\n10. POST /cards/reissue (CUST-TEST01)")
body, status = post("/cards/reissue", {"customer_id": "CUST-TEST01"})
check("Reissue status 200", status == 200, f"got {status}")
check("Has new_card_id", "new_card_id" in body)
check("customer_id preserved", body.get("customer_id") == "CUST-TEST01")
check("Balance carried over = 40", body.get("balance_carried_over") == 40, f"got {body.get('balance_carried_over')}")
check("Has new QR", len(body.get("qr_code_base64", "")) > 50)

NEW_REISSUED_CARD = body.get("new_card_id", "")

# ── 11. Old card should be blocked after reissue ──────────
print("\n11. POST /wallet/pay (old card after reissue)")
body, status = post("/wallet/pay", {
    "merchant_id": "MER-001", "card_id": "CARD-TEST01", "amount": 10, "pin": "1234"
})
check("Old card BLOCKED", body.get("failure_reason") == "BLOCKED_CARD", body.get("failure_reason"))

# ── 12. New reissued card should work ─────────────────────
print(f"\n12. POST /wallet/pay (new card {NEW_REISSUED_CARD})")
body, status = post("/wallet/pay", {
    "merchant_id": "MER-002", "card_id": NEW_REISSUED_CARD, "amount": 10, "pin": "1234"
})
check("New card SUCCESS", body.get("status") == "SUCCESS", str(body))
check("Balance = 30", body.get("new_customer_balance") == 30, f"got {body.get('new_customer_balance')}")

# ── 13. Transaction history ───────────────────────────────
print("\n13. GET /transactions?customer_id=CUST-TEST01")
body, status = get("/transactions?customer_id=CUST-TEST01")
check("Status 200", status == 200)
txns = body.get("transactions", [])
check("Has transactions", len(txns) > 0, f"got {len(txns)} transactions")
# We did: topup, pay success, pay wrong pin, pay limit, pay insuff, block(via card), reissue, pay old blocked, pay new
print(f"  -> Found {len(txns)} transactions for CUST-TEST01")

# ── 14. Admin stats ──────────────────────────────────
print("\n14. GET /admin/stats")
body, status = get("/admin/stats")
check("Status 200", status == 200)
check("Has all fields", all(
    key in body for key in (
        "cash_digitized", "payments_received", "active_cards",
        "blocked_cards", "total_customers", "total_transactions",
    )
), str(body))
# This run did one Rs.80 topup — cash_digitized reflects all SUCCESS topups
check("Cash digitized >= 80", body.get("cash_digitized", 0) >= 80, str(body.get("cash_digitized")))
# CARD-TEST02 was blocked in step 8, CARD-TEST01 in step 10 (reissue)
check("Blocked cards >= 2", body.get("blocked_cards", 0) >= 2, str(body.get("blocked_cards")))
check("Active cards >= 1", body.get("active_cards", 0) >= 1, str(body.get("active_cards")))

# ── Summary ───────────────────────────────────────────────
print("\n" + "=" * 60)
print(f"RESULTS: {PASS} passed, {FAIL} failed out of {PASS + FAIL} checks")
print("=" * 60)

sys.exit(0 if FAIL == 0 else 1)
