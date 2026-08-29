# Batwa — Project Memory

> This file is the living memory of the project. Every significant action, decision, and milestone is logged here so any team member (or AI agent) can pick up exactly where things left off.

**Last updated:** 2026-08-29, 4:05 PM IST

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

### Phase 0 — Agent Portal (Pratik) ✅ COMPLETE

**Date:** Aug 27, 2026

#### 1. Project Structure
- Added a `frontend/` folder to the repo, containing the `agent-portal/` React 19 + TypeScript (Vite) app
- Structure:
  ```
  frontend/agent-portal/
  ├── index.html, vite.config.ts, package.json, .env.example, pnpm-lock.yaml
  └── src/
      ├── App.tsx, main.tsx
      ├── api/agentApi.ts
      ├── pages/ (RegisterCustomer.tsx, TopUp.tsx, BlockReissue.tsx)
      └── styles/global.css
  ```
- Runs standalone on `http://localhost:5173`, independent of the other portals for now (see integration note below)

#### 2. Screens Built
- **`/agent/register`** — customer registration form (name, phone, 4-digit PIN, language preference) → displays the generated QR card, large and printable
- **`/agent/topup`** — enter/scan `card_id` + cash amount → confirm → shows updated customer balance and the agent's remaining float
- **`/agent/manage`** — search a customer, block their card (with a confirm step), or reissue a new card with balance carried over

#### 3. Backend Integration
- `src/api/agentApi.ts` is the single source of truth for Agent backend calls — wired to Harsh's **real** endpoints, not mocks
- Uses the updated contract from Decision 1 (`card_id`, not `customer_id`, in register/topup/block/reissue requests)
- Handles both transport failures and business-logic failures (`status: "FAILED"` with a `failure_reason`) through one consistent `ApiError` type, so failure handling stays uniform across all three screens

#### 4. Styling
- `src/styles/global.css` is a plain, high-contrast, large-touch-target placeholder (64px min touch targets, visible focus rings, no framework dependency)
- Intentionally built to be a class-name swap, not a rewrite, once Ruchir's shared UI kit lands

#### 5. Open Items Raised by Pratik (need team input)
- ✅ **`/wallet/balance/{id}` contract is resolved.** It takes `customer_id`; see the Decision 1 follow-up below.
- QR scanning on the top-up screen is currently manual text entry only (blueprint calls for scan-or-enter). Plan is to reuse Krishna's `html5-qrcode` integration once the Merchant Portal builds it, rather than duplicating the component.
- No agent login/session yet — `agent_id` is a plain text field defaulting to `AGT-001`. Fine for the demo; flagging so the team explicitly agrees we're not building agent auth in scope.
- This repo currently runs its own standalone `<BrowserRouter>` with only `/agent/*` routes. Per the blueprint, Day 4 merge should nest these three `<Route>`s under the shared app's `/agent` path instead of keeping a separate router.

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
- **Action needed:** ⚠️ Harsh must communicate these field name changes to Pratik, Krishna, Ruchir, and Atharva at the Day 1 sync. **(Done for Pratik — Agent Portal is built against the updated contract.)**
- **Resolved (Aug 28, by Ruchir, from the implementation):** `GET /wallet/balance/{id}` takes **`customer_id`**, not `card_id` — `backend/routes/wallet.py` queries the `customers` table directly and returns `{ customer_id, balance, card_status }` (`card_status` reflects the customer's active card, `no_active_card` if none). `agentApi.getBalance()` is documented accordingly. Harsh: shout if this was not the intent; nothing currently calls it in a demo path.

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
- [x] Communicate API contract changes (card_id separation) to team at Day 1 sync
- [x] `GET /wallet/balance/{id}` expects `customer_id` — confirmed from the implementation and documented (Decision 1 follow-up); ratify at next sync
- [x] Support frontend team with any backend integration issues
- [ ] Add CORS origin restrictions before production deploy (currently allows `*`)
- [x] Warm up backend before demo — `scripts/warmup.py` created and tested (8/8 endpoints pass)
- [x] Prepare architecture summary for the pitch closing — `docs/architecture.png` + updated README

### Pratik — Agent Portal (Frontend) ✅ COMPLETE
- [x] Set up React project with routes (`/agent`)
- [x] Build customer registration form (name, phone, 4-digit PIN, language preference)
- [x] Display QR code on successful registration (large, printable)
- [x] Build top-up screen: scan/enter card_id, enter amount, confirm
- [x] Show updated customer balance and agent's remaining float after topup
- [x] Build block/reissue screen: search customer, block/reissue buttons
- [x] Wire to real backend endpoints (use `card_id` in requests, not `customer_id`)
- [ ] Swap `global.css` placeholder for Ruchir's shared UI kit once it lands
- [ ] Reuse Krishna's `html5-qrcode` component for scan-based card entry on the top-up screen
- [ ] Day 4: nest `/agent/*` routes under the shared app instead of the standalone router

### Krishna — Merchant Portal (Frontend) ✅ COMPLETE (see "Krishna — Batwa Frontend Completion" section below)
- [x] Set up React routes (`/merchant`)
- [x] Build amount-entry screen (numeric keypad, large buttons)
- [x] Integrate `html5-qrcode` for camera-based QR scanning
- [x] Add manual card_id entry as fallback
- [x] Build PIN-entry prompt (large numeric keypad, PIN masked as dots)
- [x] Build success screen (green, checkmark, amount, new balance)
- [x] Build failure screen (red, cross, plain-language reason)
- [x] Map failure_reason codes to user-friendly messages
- [x] Wire to `POST /wallet/pay`

### Ruchir — Accessibility + Admin Dashboard ✅ COMPLETE (see "Ruchir — Accessibility + Admin" section below)
- [x] Shared UI kit — delivered by Krishna's shared tokens/components; Ruchir reused them rather than duplicating
- [x] Build language switcher (EN/HI/TA) — persistent control (sidebar on desktop, top bar on mobile), choice persisted in localStorage
- [x] Full Hindi + Tamil translations in `src/i18n/copy.ts` (guarded by a key-parity test)
- [x] Voice prompt audio clips per language (all 5 prompts × en/hi/ta, pre-generated mp3s in `public/audio/`)
- [x] Wire audio to play at relevant merchant-flow step; success chime / failure buzz tones on results
- [x] Build Admin dashboard (`/admin` route): live transaction feed (5s auto-refresh) + running totals
- [x] Success/failure distinguishable by color, icon, AND sound
- [x] Payment receipt print view on the merchant success screen (blueprint listed receipt generation under Ruchir)
- [ ] Day 5: finalize pitch slides

### Atharva — Backend Support + QA + Deployment
- [x] Receipt generation — covered by the browser print view Ruchir added to the merchant success screen (fields: txn_id, amount, date, new balance, merchant name, masked card). A `reportlab` PDF is now optional polish, not required for the DoD.
- [ ] Write additional integration tests for edge cases
- [ ] Set up deployment:
  - Backend on Render/Railway
  - Frontend on Vercel
- [ ] Test deployed endpoints
- [ ] Support Harsh on any backend bug triage
- [x] Balance endpoint ambiguity resolved: `GET /wallet/balance/{id}` takes **customer_id** (see Decision 1 follow-up)

### Phase 2 — Integration (Day 4, whole team)
- [ ] Connect all portals + admin to deployed backend (not localhost)
- [ ] Merge Pratik's standalone `agent-portal` router into the shared app under `/agent`
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

## How to Run the Agent Portal

```bash
cd frontend/agent-portal
pnpm install
cp .env.example .env       # point VITE_API_BASE_URL at Harsh's backend
pnpm dev                   # runs on http://localhost:5173
# Checks: pnpm typecheck && pnpm test && pnpm build
```
Requires the backend running first (see above).

---

## Important Notes for AI Agents

If you are an AI agent picking up this project for a team member:

1. **Read the blueprint first:** `tapwallet-implementation-blueprint.md` is the source of truth for overall scope
2. **Read this MEMORY.md:** for what's actually been built and what's changed from the blueprint
3. **API contract has changed** from the blueprint — use `card_id` (not `customer_id`) in topup/pay/block requests. `GET /wallet/balance/{id}` takes **customer_id** (resolved — see Decision 1). `GET /admin/stats` is an additive read-only endpoint for the admin dashboard — it changes no Section 6 shapes.
4. **Backend is fully operational** at `http://localhost:8000` — you can test against it immediately
5. **Agent Portal is fully operational** at `http://localhost:5173` (after `pnpm install` + `.env` setup) — wired to the real backend, not mocks; source is TypeScript and the app runs React 19.
6. **Seed data PINs are all `1234`** — use `CARD-TEST01` through `CARD-TEST05` for testing
7. **Don't rename API fields** — the field names in `models.py` are final. If you need a change, update this MEMORY.md and notify the team.
8. **The `failure_reason` value set is closed** — only use the values documented in the README. Don't invent new ones.

---

## Krishna — Batwa Frontend Completion ✅

**Last updated:** 2026-08-28 22:16:53 +05:30

### Ownership and branch

- Krishna’s implementation lives on `krishna/merchant-batwa-ui` in the clean isolated `Batwa-Krishna` worktree.
- The original dirty `Batwa` worktree remained untouched.
- Krishna owns the shared Batwa frontend foundation and Merchant Portal implementation. Pratik’s Agent API behaviour was preserved while the complete Agent interface was visually integrated.

### Delivered implementation

- Batwa landing page using the local bazaar illustration at `frontend/agent-portal/public/assets/batwa-bazaar-hero.webp`.
- Shared design tokens, reusable UI components and the internal `WorkspaceShell`.
- Role-specific Agent and Merchant sidebars and headers with an accessible custom language menu.
- Agent Overview, Register Customer with printable QR-card result, Add Money scan/manual flow with review/result, Block and Reissue flows.
- Merchant demo/configured modes, merchant selection/switching, amount/card-method/review/PIN/result flow, explicit camera activation, manual card fallback and demo-card path only in demo mode.
- Responsive desktop/mobile behaviour and focused accessibility/security treatment.

### Preserved behaviour and verification

- Backend API contracts, Pratik’s Agent API wrapper, Harsh’s payment logic, QR payloads/printing, agent-float and customer-balance updates, the ₹100 payment limit, duplicate-payment protection, PIN privacy and existing deep links were preserved.
- Frontend tests: 13/13 passed. Production build passed. Disposable backend checks: 36/36 passed.
- Live Merchant payment and complete Agent/Merchant flows were manually verified by Krishna.
- Desktop overflow was verified at 1440×900, 1366×768 and 1024×768; mobile horizontal overflow was verified at 390×844.
- No console errors or React warnings were observed. PIN was not persisted, logged or exposed in URLs.

### Handoff

- Ruchir and Atharva should reuse the shared shell, tokens and components.
- Admin, audio and receipt-specific business logic remains with the appropriate teammates.
- A teammate will review the pull request and merge it into `main`; no direct merge to `main` was performed.

---

## Ruchir — Accessibility + Admin Dashboard ✅

**Last updated:** 2026-08-28, 11:55 PM IST

### Delivered implementation

- **Admin dashboard** at `/admin` (`src/pages/AdminDashboard.tsx`), inside the shared `WorkspaceShell` with its own sidebar/header role. Live transaction feed from `GET /transactions`, auto-refreshing every 5 seconds (plus a manual refresh button), with running totals: cash converted to digital, payments received, active cards, blocked cards. Reachable from a quiet "Live dashboard" link on the landing page.
- **New backend endpoint `GET /admin/stats`** (`backend/routes/admin.py`) supplying the totals — the card counts are not derivable from `/transactions` alone. Additive and read-only; no Section 6 contract shapes changed. Covered by test section 14 in `test_endpoints.py` (now 41 checks).
- **Full Hindi + Tamil translations** in `src/i18n/copy.ts`; the merchant payment flow, workspace shell/sidebar/header and admin dashboard are wired to copy keys. `tests/i18nCopy.test.ts` enforces key-parity so hi/ta can never silently fall back to English. Language choice persists in localStorage. The language menu now also appears in the mobile top bar (the sidebar — its old only home — is hidden under 760px).
- **Voice prompts (pre-recorded, per blueprint):** `public/audio/{en,hi,ta}/{enter_amount,scan_card,enter_pin,payment_success,payment_failed}.mp3`, generated once by `scripts/generate_audio.py` (gTTS; committed as static assets — no runtime TTS). `src/audio/sounds.ts` plays them per merchant-flow step; playback is best-effort and never blocks a payment.
- **Success/failure sound:** `public/audio/success.mp3` (rising chime) and `failure.mp3` (low buzz) play on payment results (tone, then the spoken result in the selected language) and on agent top-up results — outcomes are now color + icon + sound. `tests/audioAssets.test.ts` verifies all 17 audio assets exist.
- **Payment receipt:** printable receipt block on the merchant success screen (merchant, date, txn_id, masked card, amount, new balance) with a "Print receipt" button using a print-only stylesheet.

### Verification

- Backend integration tests: **41/41 passed** (36 existing + 5 new for `/admin/stats`).
- Frontend tests: **19/19 passed** (13 existing + 6 new: i18n parity, audio assets). Production build passes.
- Agent/merchant flows untouched logically — `merchantFlow.ts`, `merchantApi.ts`, `agentApi.ts` request/response shapes unchanged (only the stale balance-endpoint comment was corrected).

### Repo hygiene (flagged for Harsh)

- Removed committed `__pycache__/*.pyc` files from git and added `backend/.gitignore` (`__pycache__/`, `*.pyc`, `.venv/`, SQLite WAL sidecars).
- `backend/batwa.db` is still tracked in git, so every local test run dirties it — recommend untracking it too (it is fully regenerated by `python seed.py`).

### Remaining for Ruchir

- Day 5 pitch slides.
- Optional: translate the remaining agent-facing prose (AgentHome/Register/TopUp/BlockReissue screen texts are still English-only; the customer-facing merchant flow, nav and admin are fully translated).

---

## Frontend TypeScript / pnpm Migration ✅

**Last updated:** 2026-08-29

- Migrated every frontend source and test file from `.js`/`.jsx` to `.ts`/`.tsx`.
- Added strict TypeScript checking with `tsconfig.json`; API response/request
  interfaces and the merchant reducer actions/state are typed.
- Upgraded the frontend to React **19.2.8**, React DOM **19.2.8**, and React
  Router **7.18.3**. React Router's old v7 future flags were removed because
  v7 now uses that behavior by default.
- Replaced the frontend npm workflow with pnpm 11.3.0 and added the frontend
  `pnpm-lock.yaml`. `package.json` declares the package manager and Node.js
  >=20.19 requirement.
- Replaced `node:test` with Vitest so TypeScript tests run through the same
  Vite module pipeline.
- Updated the root and frontend README setup commands. The old empty root
  `package-lock.json` and frontend lockfile were removed.

### Migration verification

- `pnpm install --frozen-lockfile` ✅
- `pnpm typecheck` ✅
- `pnpm test` — **19/19 passed** ✅
- `pnpm build` ✅
- Vite dev server smoke-tested at `/` and `/admin` ✅

---

## Harsh — Day 3 Integration Work ✅

**Last updated:** 2026-08-29, 4:05 PM IST

### 1. Pre-Demo Warm-Up Script (`scripts/warmup.py`)

Created an idempotent warm-up script for Render free-tier cold-start handling. The script:

- **Phase 1 — Wake:** Retries the health endpoint (`GET /`) for up to 60 seconds (12 × 5s) until the container is live.
- **Phase 2 — Warm:** Exercises every API path with a throwaway customer: register → topup → pay → balance → block → reissue → transactions → admin/stats. This ensures all Python imports, SQLite connections, and bcrypt routines are hot in memory.
- **Phase 3 — Verdict:** Prints a colour-coded go/no-go checklist (8/8 endpoints).

**Usage:**
```bash
python scripts/warmup.py                            # default: http://localhost:8000
python scripts/warmup.py https://batwa.onrender.com # deployed URL
```

**Tested:** 8/8 endpoints passing on localhost ✅

### 2. QR Service Bugfix (`backend/services/qr_service.py`)

Fixed `AttributeError: module 'qrcode.image' has no attribute 'pil'` that was breaking customer registration (`POST /customers/register`). The submodule `qrcode.image.pil` is not auto-imported by the `qrcode` package — added an explicit `from qrcode.image.pil import PilImage` import.

**Impact:** Without this fix, no new customers could be registered. The bug was introduced during the recent git merge and went unnoticed because the previous test run had a cached import.

### 3. Architecture Diagram (`docs/architecture.png`)

Generated a system architecture diagram showing:
- Three frontend portals (Agent, Merchant, Admin) with their feature sets
- FastAPI backend layer with service modules
- SQLite database with 5-table schema
- End-to-end payment flow (6 numbered steps)

Embedded in `README.md` under the System Architecture section.

### 4. README.md Rewrite

Comprehensive rewrite of the project README to reflect the actual current state:
- Architecture diagram + ASCII payment flow
- Accurate project structure matching the TypeScript migration
- Full API endpoint documentation with request/response schemas
- Failure reason code table (closed set)
- Current progress table (honest per-component status)
- Quick start instructions for both backend and frontend
- Team roster and remaining work

### 5. Project Status Assessment

Performed a full codebase scan and cross-referenced against the blueprint's Definition of Done (Section 9):

| # | DoD Requirement | Status |
|---|---|---|
| 1 | Customer can register and get scannable QR card | ✅ |
| 2 | Agent top-up moves cash → digital balance | ✅ |
| 3 | Merchant payment requires PIN, enforces ₹100 limit, atomic | ✅ |
| 4 | Block and reissue carry over balance | ✅ |
| 5 | All failure paths show plain-language messages | ✅ |
| 6 | Language switch (EN/HI/TA) + voice prompts | ✅ |
| 7 | Success/failure by color + icon + sound | ✅ |
| 8 | Receipt (print view) after successful payment | ✅ |
| 9 | Admin dashboard reflects transactions live | ✅ |
| 10 | Everything deployed on public URL | ❌ Pending (Atharva) |

**Overall: 9/10 DoD items complete. Only deployment remains.**

### Remaining for the whole team

- [ ] Deploy backend to Render/Railway (Atharva)
- [ ] Deploy frontend to Vercel (Atharva)
- [ ] Lock down CORS origins from `*` to deployed URLs (Harsh)
- [ ] Test deployed endpoints with `scripts/warmup.py` (Harsh + Atharva)
- [ ] Day 5 pitch slides (Ruchir)
- [ ] Full demo rehearsal on presentation device (All)
