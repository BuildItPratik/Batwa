# Batwa — Project Memory

> This file is the living memory of the project. Every significant action, decision, and milestone is logged here so any team member (or AI agent) can pick up exactly where things left off.

**Last updated:** 2026-08-27, 10:34 PM IST

---

## Project Overview

- **Project:** Batwa — Non-Mobile Digital Payment System
- **Event:** Cognizant NPN Nurture Program Hackathon (5-day build)
- **Repo:** `BuildItPratik/Batwa` on GitHub
- **Team:** Harsh (backend lead), Pratik (agent portal), Krishna (merchant portal), Ruchir (accessibility + admin), Atharva (backend support + QA)

---

## What Has Been Done

### Phase 0 — Foundation (Harsh) ✅ COMPLETE

**Date:** Aug 27, 2026

#### 1. Repo & Folder Structure
- Cloned `BuildItPratik/Batwa` repo
- Created `/backend` folder with full project structure:
  ```
  backend/
  ├── main.py, database.py, models.py, seed.py, test_endpoints.py
  ├── requirements.txt
  ├── routes/   (customers.py, wallet.py, cards.py, transactions.py)
  └── services/ (pin_service.py, qr_service.py, txn_service.py)
  ```

#### 2. Database Schema (5 tables)
- **customers** — permanent identity (customer_id, name, phone, pin_hash, balance, language_pref)
- **cards** — QR cards linked to customers (card_id, customer_id, status)
- **agents** — cash-in points (agent_id, name, location, float_balance)
- **merchants** — shops (merchant_id, name, wallet_balance)
- **transactions** — full audit trail (txn_id, type, customer_id, counterparty_id, amount, status, failure_reason)

> **KEY DECISION:** We separated `customer_id` (permanent) from `card_id` (reissuable). The original blueprint had them as one ID. This was Harsh's decision — cleaner for reissue flows. See "Architecture Decisions" section below.

#### 3. All 7 API Endpoints — Built & Tested
| Endpoint | Method | Status |
|---|---|---|
| `/customers/register` | POST | ✅ Working |
| `/wallet/topup` | POST | ✅ Working |
| `/wallet/pay` | POST | ✅ Working |
| `/wallet/balance/{customer_id}` | GET | ✅ Working |
| `/cards/block` | POST | ✅ Working |
| `/cards/reissue` | POST | ✅ Working |
| `/transactions` | GET | ✅ Working |

#### 4. Core Services
- **PIN Service** — bcrypt hash/verify (never stores plain PINs)
- **QR Service** — generates QR PNG from card_id, returns base64
- **Transaction Service** — atomic topup and payment with all validation:
  - Rs.100 per-transaction limit (on payments only, not topups)
  - PIN verification
  - Balance sufficiency check
  - Card status check (blocked cards rejected)
  - Agent float sufficiency check (for topups)
  - Every operation (including failures) recorded in transactions table

#### 5. Seed Data
- 2 agents: `AGT-001`, `AGT-002` (float: 10,000 each)
- 2 merchants: `MER-001`, `MER-002` (balance: 0)
- 5 test customers: `CUST-TEST01` to `CUST-TEST05` (PIN: `1234`, balance: 0)
- 5 test cards: `CARD-TEST01` to `CARD-TEST05` (status: active)

#### 6. Integration Tests — 36/36 PASSED
```
1.  Customer registration              → 5 checks PASS
2.  Topup Rs.80                        → 5 checks PASS
3.  Payment Rs.40 (correct PIN)        → 3 checks PASS
4.  Payment (wrong PIN)                → 2 checks PASS (WRONG_PIN)
5.  Payment Rs.120 (over limit)        → 2 checks PASS (LIMIT_EXCEEDED)
6.  Payment Rs.99 (insufficient)       → 2 checks PASS (INSUFFICIENT_BALANCE)
7.  Balance check                      → 3 checks PASS
8.  Block card                         → 2 checks PASS
9.  Payment on blocked card            → 2 checks PASS (BLOCKED_CARD)
10. Reissue card                       → 5 checks PASS
11. Payment on OLD card after reissue  → 1 check PASS (BLOCKED_CARD)
12. Payment on NEW reissued card       → 2 checks PASS
13. Transaction history                → 2 checks PASS
```

---

## Architecture Decisions Log

### Decision 1: Card/Customer Separation
- **Date:** Aug 27, 2026
- **By:** Harsh
- **What:** Instead of `customer_id` being the QR card ID (as in the blueprint), we have separate `customer_id` (permanent) and `card_id` (reissuable) concepts.
- **Why:** On reissue, customer keeps their identity, balance, and transaction history. Only the card changes. Much cleaner than creating a new customer row and migrating balance.
- **Impact on API contract:**
  - `customer_id` → `card_id` in topup, pay, and block request bodies
  - Register response now includes both `customer_id` and `card_id`
  - Reissue response returns `new_card_id` instead of `new_customer_id`
- **Action needed:** ⚠️ Harsh must communicate these field name changes to Pratik, Krishna, Ruchir, and Atharva at the Day 1 sync.

### Decision 2: Rs.100 Limit Scope
- **Date:** Aug 27, 2026
- **By:** Harsh
- **What:** The Rs.100 per-transaction limit is enforced on `/wallet/pay` only, not on `/wallet/topup`.
- **Why:** The blueprint explicitly mentions the limit for payments. Topups are agent-mediated cash deposits — no reason to limit them to Rs.100.

### Decision 3: SQLite with WAL + BEGIN IMMEDIATE
- **Date:** Aug 27, 2026
- **By:** Harsh
- **What:** Using WAL journal mode and `BEGIN IMMEDIATE` transactions for all write operations.
- **Why:** WAL allows concurrent reads during writes. `BEGIN IMMEDIATE` acquires the write lock upfront, preventing mid-transaction SQLITE_BUSY errors. This is critical for atomic topup/payment where multiple tables are updated together.

---

## What Needs to Be Done

### Harsh — Remaining Tasks
- [ ] Communicate API contract changes (card_id separation) to team at Day 1 sync
- [ ] Support frontend team with any backend integration issues
- [ ] Add CORS origin restrictions before production deploy (currently allows `*`)
- [ ] Warm up backend before demo (Render free tier cold starts)
- [ ] Prepare architecture summary for the pitch closing

### Pratik — Agent Portal (Frontend)
- [ ] Set up React project with routes (`/agent`)
- [ ] Build customer registration form (name, phone, 4-digit PIN, language preference)
- [ ] Display QR code on successful registration (large, printable)
- [ ] Build top-up screen: scan/enter card_id, enter amount, confirm
- [ ] Show updated customer balance and agent's remaining float after topup
- [ ] Build block/reissue screen: search customer, block/reissue buttons
- [ ] Wire to real backend endpoints (use `card_id` in requests, not `customer_id`)

### Krishna — Merchant Portal (Frontend)
- [ ] Set up React routes (`/merchant`)
- [ ] Build amount-entry screen (numeric keypad, large buttons)
- [ ] Integrate `html5-qrcode` for camera-based QR scanning
- [ ] Add manual card_id entry as fallback
- [ ] Build PIN-entry prompt (large numeric keypad, PIN masked as dots)
- [ ] Build success screen (green, checkmark, amount, new balance)
- [ ] Build failure screen (red, cross, plain-language reason)
- [ ] Map failure_reason codes to user-friendly messages:
  - `WRONG_PIN` → "Incorrect PIN. Please try again."
  - `INSUFFICIENT_BALANCE` → "Not enough balance."
  - `BLOCKED_CARD` → "This card has been blocked."
  - `LIMIT_EXCEEDED` → "Amount exceeds Rs.100 limit."
- [ ] Wire to `POST /wallet/pay`

### Ruchir — Accessibility + Admin Dashboard
- [ ] Build shared UI kit: large buttons, high-contrast colors, consistent icons
- [ ] Hand UI kit to Pratik and Krishna by end of Day 2
- [ ] Build language switcher (EN/HI/TA) — persistent top-of-screen control
- [ ] Record/source voice prompt audio clips per language:
  - "Enter amount", "Scan your card", "Enter your PIN", "Payment successful", "Payment failed"
- [ ] Wire audio to play at relevant screen/step
- [ ] Build Admin dashboard (`/admin` route):
  - Live transaction feed from `GET /transactions`
  - Running totals: total cash converted to digital, active cards, blocked cards
- [ ] Ensure success/failure distinguishable by color, icon, AND sound (not text alone)

### Atharva — Backend Support + QA + Deployment
- [ ] Build receipt generation (PDF via `reportlab` or browser print view)
  - Fields: txn_id, amount, date, new balance, merchant name
- [ ] Write additional integration tests for edge cases
- [ ] Set up deployment:
  - Backend on Render/Railway
  - Frontend on Vercel
- [ ] Test deployed endpoints
- [ ] Support Harsh on any backend bug triage

### Phase 2 — Integration (Day 4, whole team)
- [ ] Connect all portals + admin to deployed backend (not localhost)
- [ ] Run full flow: register → topup → pay → admin dashboard → receipt
- [ ] Test all failure paths deliberately
- [ ] Fix integration bugs

### Phase 3 — Polish & Demo (Day 5)
- [ ] Final bug pass and UI polish
- [ ] Test on actual presentation device/WiFi
- [ ] Warm up backend before presenting
- [ ] Rehearse demo flow 3x (timed)
- [ ] Finalize slides (Ruchir)
- [ ] Full team dry run of pitch

### Stretch Goals (only if core is done + stable)
- [ ] Basic fraud flag (same card used twice within 60 seconds)
- [ ] Printed receipt via connected printer
- [ ] ML-based fraud detection on admin dashboard

---

## How to Run the Backend

```bash
cd backend
pip install -r requirements.txt    # One-time setup
python seed.py                     # Seed test data (idempotent)
python -m uvicorn main:app --reload --port 8000
# API docs: http://localhost:8000/docs
# Run tests: python test_endpoints.py (while server is running)
```

---

## Important Notes for AI Agents

If you are an AI agent picking up this project for a team member:

1. **Read the blueprint first:** `tapwallet-implementation-blueprint.md` is the source of truth for overall scope
2. **Read this MEMORY.md:** for what's actually been built and what's changed from the blueprint
3. **API contract has changed** from the blueprint — use `card_id` (not `customer_id`) in topup/pay/block requests
4. **Backend is fully operational** at `http://localhost:8000` — you can test against it immediately
5. **Seed data PINs are all `1234`** — use `CARD-TEST01` through `CARD-TEST05` for testing
6. **Don't rename API fields** — the field names in `models.py` are final. If you need a change, update this MEMORY.md and notify the team.
7. **The `failure_reason` value set is closed** — only use the values documented in the README. Don't invent new ones.
