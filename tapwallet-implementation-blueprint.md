# TapWallet — Implementation Blueprint
### Cognizant NPN Nurture Program | Non-Mobile Digital Payment Solutions
### Team: Harsh, Pratik, Krishna, Ruchir, Atharva

---

## HOW TO USE THIS FILE

This file is the single source of truth for the project. If you are an AI coding agent reading this on behalf of one of the five team members: find your assigned person's name in **Section 4 (Role Assignments)**, read your Phase instructions carefully, and build exactly what's specified — including the API contract shapes, so your piece integrates with everyone else's without a mid-week merge disaster. Do not invent extra scope beyond what's listed as "Stretch" unless your core deliverables are done and tested.

---

## 1. What We're Building (Plain Explanation)

**TapWallet** lets people who don't own a smartphone or bank account make small (under ₹100) digital payments using a simple printed QR card, instead of cash.

- A **Customer** gets a QR card from a local **Agent** (think: the neighborhood mobile-recharge shop).
- The Customer hands the Agent cash; the Agent loads that amount onto the Customer's card balance — and the Agent's own float balance goes down by the same amount (this is how the Agent "pays out" digital money in exchange for the cash they physically collected).
- At a shop, the **Merchant** enters the amount, scans the Customer's QR card, and the Customer enters a **PIN** to confirm. Payment goes through, wallet balances update, and a receipt (digital + optional print) is shown.
- Everything is designed for people with low literacy and no smartphone: large buttons, voice instructions in Tamil/Hindi/English, and clear green/red success-failure indicators.

This is a **simulation/demo system** — no real bank integration, no real NFC hardware. QR codes stand in for tap cards. All balances are demo money in our own database. That is expected and correct for a 5-day hackathon build.

---

## 2. Final Scope (What We Are Building, Confirmed)

### Agent Portal
- Register new customers (capture name + basic info, no formal KYC)
- Generate a QR card (unique customer/card ID encoded as QR) for each new customer
- Add cash to a customer's wallet (top-up) — **this debits the Agent's own float balance**
- Reissue a card (new QR, same customer, old card invalidated) or block a lost card

### Merchant Portal
- Enter payment amount
- Scan customer's QR card (camera-based QR scan, or manual code entry as fallback)
- Prompt customer to enter their PIN to authorize
- Show payment **success** (green) or **failure** (red) clearly, with reason if failed (insufficient balance / wrong PIN / blocked card)

### Backend
- Store customers, merchants, agents, and their balances
- Debit/credit wallets correctly, with an atomic transaction (never leave money "half-moved")
- Enforce the ₹100 per-transaction limit
- Record every transaction (top-up and payment) in a transaction history table
- Validate PINs securely (hashed, never stored/returned in plain text)

### Accessibility Layer (applies across Agent, Merchant, and Customer-facing screens)
- Large, high-contrast buttons — designed for low-literacy, possibly older users
- Language selector: Tamil / Hindi / English, switchable at any screen
- Voice instructions (pre-recorded audio prompts) guiding each step in the selected language
- Green tick + sound for success, red cross + sound for failure — never rely on text/color alone
- Printed receipt option (generate a simple PDF/printable receipt after each transaction)

### Explicitly Out of Scope (do not build, mention only as "future work" in the pitch)
- Real NFC/physical card hardware
- Real bank/UPI integration
- Merchant withdrawal/settlement to a real bank account
- ML-based fraud detection (only if all core scope is done early — see Stretch Goals)

---

## 3. Tech Stack (Locked — do not deviate)

| Layer | Choice |
|---|---|
| Backend | FastAPI (Python) |
| Database | SQLite (file-based, zero setup — sufficient for a demo) |
| Frontend | Single React app, with role-based routes (`/agent`, `/merchant`, `/customer`, `/admin`) — **one app, one codebase, one deploy**, not four separate apps |
| QR generation | `qrcode` Python library (backend generates QR, frontend displays it) |
| QR scanning | `html5-qrcode` JS library (camera-based scan in browser) |
| PIN hashing | `bcrypt` |
| PDF Receipt | `reportlab` (Python) or simple browser print-to-PDF as fallback |
| Voice prompts | Pre-recorded `.mp3` files per language, played via HTML `<audio>` — **not** live text-to-speech (too slow to build/test in 5 days) |
| Deployment | Backend on Render/Railway, Frontend on Vercel |
| Version control | One GitHub repo, feature branches per person, PRs into `main` |

---

## 4. Role Assignments (5 People)

| Person | Primary Ownership |
|---|---|
| **Harsh** | Backend core: database schema, wallet/ledger logic, transaction engine, PIN security. Project integration lead. |
| **Pratik** | Agent Portal (frontend): customer registration, QR generation UI, top-up flow, block/reissue flow |
| **Krishna** | Merchant Portal (frontend): amount entry, QR scan, PIN entry, success/failure screens |
| **Ruchir** | Accessibility layer + Admin/monitoring screen: language switching, voice prompts, large-button UI kit, receipt generation, transaction dashboard |
| **Atharva** | Backend support: API for Merchant/Admin side, ₹100 validation logic, transaction history endpoints, QA/testing, deployment |

Everyone works against the **API contract in Section 6**, finalized on Day 1, so frontend and backend work can proceed in parallel from Day 2 onward.

---

## 5. Database Schema (Harsh builds this first — everyone else depends on it)

```sql
-- customers: the people who own a card
CREATE TABLE customers (
    customer_id   TEXT PRIMARY KEY,      -- also the QR card ID
    name          TEXT NOT NULL,
    phone         TEXT,                  -- optional, no verification needed
    pin_hash      TEXT NOT NULL,         -- bcrypt hash of 4-digit PIN
    balance       DECIMAL DEFAULT 0,
    status        TEXT DEFAULT 'active', -- active | blocked
    language_pref TEXT DEFAULT 'en',     -- en | hi | ta
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- agents: cash-in points
CREATE TABLE agents (
    agent_id      TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    location      TEXT,
    float_balance DECIMAL DEFAULT 10000  -- agent's own pre-funded balance, decreases on every top-up they issue
);

-- merchants: shops accepting payment
CREATE TABLE merchants (
    merchant_id     TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    wallet_balance  DECIMAL DEFAULT 0    -- increases with every payment received
);

-- transactions: full audit trail
CREATE TABLE transactions (
    txn_id          TEXT PRIMARY KEY,
    type            TEXT NOT NULL,        -- TOPUP | PAYMENT | REISSUE | BLOCK
    customer_id     TEXT REFERENCES customers(customer_id),
    counterparty_id TEXT,                 -- agent_id for TOPUP, merchant_id for PAYMENT
    amount          DECIMAL,
    status          TEXT,                 -- SUCCESS | FAILED
    failure_reason  TEXT,                 -- null if success; else INSUFFICIENT_BALANCE | WRONG_PIN | BLOCKED_CARD | LIMIT_EXCEEDED
    timestamp       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Critical rule for Harsh:** every top-up and payment must be a single atomic DB transaction — e.g. for a top-up, the customer's `balance` increases AND the agent's `float_balance` decreases in the same commit. If one write fails, both must roll back. Same for payment: customer balance down, merchant wallet up, together or not at all.

---

## 6. API Contract (finalize Day 1 — do not change shapes after this without telling the whole team)

### `POST /customers/register`
Registers a new customer, returns their new card ID + QR image.
```json
// Request
{ "name": "Ramesh Kumar", "phone": "9876543210", "pin": "1234", "language_pref": "hi" }

// Response
{ "customer_id": "CUST-A1B2C3", "qr_code_base64": "...", "status": "active" }
```

### `POST /wallet/topup`
Agent loads cash onto a customer's card. Debits agent float, credits customer balance.
```json
// Request
{ "agent_id": "AGT-001", "customer_id": "CUST-A1B2C3", "amount": 50 }

// Response (success)
{ "status": "SUCCESS", "new_customer_balance": 50, "agent_float_remaining": 9950, "txn_id": "TXN-..." }

// Response (failure, e.g. agent float too low)
{ "status": "FAILED", "failure_reason": "AGENT_FLOAT_INSUFFICIENT" }
```

### `POST /wallet/pay`
Merchant-initiated payment. Requires customer PIN.
```json
// Request
{ "merchant_id": "MER-001", "customer_id": "CUST-A1B2C3", "amount": 40, "pin": "1234" }

// Response (success)
{ "status": "SUCCESS", "new_customer_balance": 10, "txn_id": "TXN-..." }

// Response (failure)
{ "status": "FAILED", "failure_reason": "WRONG_PIN" }
// possible failure_reason values: WRONG_PIN | INSUFFICIENT_BALANCE | BLOCKED_CARD | LIMIT_EXCEEDED
```

### `POST /cards/block`
```json
// Request
{ "customer_id": "CUST-A1B2C3" }
// Response
{ "status": "SUCCESS", "card_status": "blocked" }
```

### `POST /cards/reissue`
Blocks old card, creates a new card ID for the same customer, keeps their balance.
```json
// Request
{ "customer_id": "CUST-A1B2C3" }
// Response
{ "new_customer_id": "CUST-D4E5F6", "qr_code_base64": "...", "balance_carried_over": 10 }
```

### `GET /wallet/balance/{customer_id}`
```json
{ "customer_id": "CUST-A1B2C3", "balance": 10, "status": "active" }
```

### `GET /transactions?customer_id=&agent_id=&merchant_id=`
Returns filtered transaction history — used by Admin dashboard and receipts.
```json
{ "transactions": [ { "txn_id": "...", "type": "PAYMENT", "amount": 40, "status": "SUCCESS", "timestamp": "..." } ] }
```

**Every endpoint above must enforce the ₹100 limit at the backend** (never trust the frontend to enforce it) — reject any `/wallet/pay` request with `amount > 100` and return `failure_reason: "LIMIT_EXCEEDED"`.

---

## 6a. Contract Discipline (Read This Before Writing Any Code)

This section applies to **every person and every AI agent working on this project, no exceptions.**

- The request/response shapes in Section 6 — field names, field types, nesting, status values, `failure_reason` strings — are **final as of the Day 1 sync**. Whoever you are, whichever part you're building, you build against these exact shapes. Not a similar version, not a "cleaner" renamed version, not one you personally would have designed differently. The exact shapes above.
- This applies uniformly: Harsh's backend must return exactly these response shapes; Pratik's, Krishna's, and Ruchir's frontends must send exactly these request shapes and expect exactly these responses; Atharva's tests must validate against exactly these shapes. If two people implement the same endpoint's caller/handler independently (e.g., someone writing a quick backend stub while someone else writes the real one), both must match Section 6 identically — not just match each other.
- **Field names are case-sensitive and exact.** `customer_id` is not `customerId` or `custId`. `failure_reason` is not `error` or `reason`. Copy the field names directly from Section 6 rather than retyping them from memory.
- **The set of `failure_reason` values is closed.** Only use: `AGENT_FLOAT_INSUFFICIENT`, `WRONG_PIN`, `INSUFFICIENT_BALANCE`, `BLOCKED_CARD`, `LIMIT_EXCEEDED`. Don't invent a new one (e.g. `INVALID_AMOUNT`) without raising it in the team sync first — the frontend's failure-message mapping depends on this exact list.
- **If a shape genuinely needs to change** (a missing field is discovered, a type needs fixing, etc.), it is not an individual decision. Post it to the whole team, get explicit agreement, update Section 6 in this file so it stays the single source of truth, and only then change any code. A silent one-person change to a shape is the single most likely way this project breaks during Day 4 integration — treat any deviation as a stop-and-sync moment, not a judgment call to make alone.
- Agents/people building against mocked responses on Day 1-2 (before Harsh's real endpoints are live): your mocks must also follow Section 6 exactly, so switching from mock to real backend on Day 2-3 is a one-line URL change, not a rewrite.

---

## 7. Phase-Wise Plan (5 Days)

### PHASE 0 — Day 1: Foundation (Whole Team)
**Goal: nobody is blocked from Day 2 onward.**

- **Harsh:** Set up the GitHub repo, folder structure (`/backend`, `/frontend`), build the database schema (Section 5), stub out all API endpoints from Section 6 returning dummy/mock responses (even before real logic is written) so frontend people can start immediately.
- **Atharva:** Pair with Harsh on schema review, set up the local dev environment (SQLite file, seed script with 5 dummy customers, 2 agents, 2 merchants), write the ₹100 validation function as a standalone testable unit.
- **Pratik, Krishna, Ruchir:** Set up their React project structure and routes (`/agent`, `/merchant`, `/customer`, `/admin`), agree on a shared component library (buttons, colors, layout) with Ruchir since accessibility touches every screen. Build static (non-functional) versions of your screens against the mock API responses Harsh provided.
- **End of Day 1 checkpoint (all 5 sync for 15 min):** confirm the API contract in Section 6 is final and nobody needs a shape changed.

---

### PHASE 1 — Days 2-3: Core Build (Parallel Work)

**Harsh — Backend Core**
- Implement real logic for `/customers/register`, `/wallet/topup`, `/wallet/pay`, `/cards/block`, `/cards/reissue`
- Implement atomic transaction handling (Section 5's critical rule) — test with concurrent/rapid requests to make sure balances never go negative or desync
- Implement PIN hashing/verification with `bcrypt`
- Write the `/wallet/balance` and `/transactions` GET endpoints
- Push working endpoints daily so frontend team can swap from mocks to real calls

**Pratik — Agent Portal**
- Build the customer registration form (name, phone, 4-digit PIN, language preference)
- On successful registration, display the generated QR code prominently (large, printable)
- Build the top-up screen: enter/scan customer ID, enter cash amount, confirm → show updated balance and agent's remaining float
- Build the block/reissue screen: search customer, block button (with confirmation prompt), reissue button (shows new QR)
- Wire everything to Harsh's real endpoints as they come online; use mocks until then

**Krishna — Merchant Portal**
- Build the amount-entry screen (numeric keypad style, large buttons)
- Integrate `html5-qrcode` for camera-based QR scanning of the customer's card; include a manual code-entry fallback for when scanning fails
- Build the PIN-entry prompt shown to the customer at point of sale (large numeric keypad, PIN masked as dots)
- Build the success screen (green, checkmark, amount, new balance) and failure screen (red, cross, clear reason in plain language — e.g., "Not enough balance" not "INSUFFICIENT_BALANCE")
- Wire to `/wallet/pay`

**Ruchir — Accessibility + Admin**
- Build the shared UI kit: large button component, high-contrast color scheme, consistent iconography — hand this to Pratik and Krishna by end of Day 2 so they can adopt it rather than retrofit later
- Build the language switcher (EN/HI/TA) as a persistent top-of-screen control on every portal
- Record or source short voice prompt audio clips for each language covering: "Enter amount," "Scan your card," "Enter your PIN," "Payment successful," "Payment failed" — wire these to play at the relevant screen/step
- Build the Admin dashboard: live transaction feed pulling from `/transactions`, simple running totals (total cash converted to digital, number of active cards, number of blocked cards)

**Atharva — Backend Support + QA**
- Build the receipt generation: a simple PDF (via `reportlab`) or browser print view showing txn ID, amount, date, new balance — triggered after every successful payment
- Write integration tests for the ₹100 limit, wrong PIN, blocked card, and insufficient balance paths — these are the scenarios judges will try live, so they must not break
- Start setting up deployment (Render/Railway for backend, Vercel for frontend) early so Day 5 isn't a scramble
- Support Harsh on any backend bug triage

---

### PHASE 2 — Day 4: Integration

**Whole team, in one working session:**
- Connect all three portals + admin dashboard against the real, deployed backend (not localhost)
- Run the full flow live: Pratik registers a test customer on Agent Portal → tops up → Krishna processes a payment on Merchant Portal → Ruchir's Admin dashboard shows it in real time → Atharva pulls a receipt
- Fix integration bugs as they surface — this is normal, budget the whole day for it, don't treat it as a stretch/buffer day
- Test every failure path deliberately: wrong PIN, over-limit amount, blocked card, zero balance

**Stretch goals (only attempt if the above is fully working and stable by mid-Day-4):**
- Basic rule-based fraud flag (e.g., same card used twice within 60 seconds) shown on Admin dashboard
- Printed receipt via an actual connected printer if one is available for the demo

---

### PHASE 3 — Day 5: Polish, Deploy, Pitch

- **Morning (all):** final bug pass, UI polish, make sure the demo works on the actual device/browser you'll present with (test on the real WiFi you'll have, not just your home network)
- **Harsh + Atharva:** final deployment check, make sure the backend doesn't sleep/cold-start awkwardly right before the demo (Render free tier can spin down — do a warm-up call before presenting)
- **Pratik + Krishna:** rehearse the live demo flow at least 3 times end to end, exactly as you'll present it, timing it
- **Ruchir:** finalize slides — problem statement, the plain-language explanation from Section 1, the architecture diagram, and the live demo handoff. Include the accessibility features prominently since that's your differentiator for the "underserved" angle in the brief.
- **All:** dry run the full pitch with all 5 roles narrating their part, in the order the demo will actually run

---

## 8. Demo Script (What You'll Actually Show Judges)

1. **Set the scene** (30 sec): "Meet Ramesh, a rickshaw driver with no smartphone and no bank account."
2. **Agent Portal** (Pratik demos): Register Ramesh, generate his QR card, show top-up of ₹80 cash → digital balance
3. **Merchant Portal** (Krishna demos): A vegetable vendor enters ₹40, scans Ramesh's card, Ramesh enters his PIN on the large keypad → green success screen, voice confirmation plays in Hindi
4. **Failure case** (Krishna demos): Try paying ₹120 → show the ₹100 limit rejection, and a wrong-PIN attempt → show the red failure screen
5. **Admin Dashboard** (Ruchir demos): Show the transaction just appearing live, running totals of cash converted to digital
6. **Close** (Harsh): Architecture summary, what's simulated vs real, and the inclusion impact story

---

## 9. Definition of Done (Checklist Before Day 5 Ends)

- [ ] Customer can be registered and gets a real, scannable QR card
- [ ] Agent top-up correctly moves cash-equivalent from agent float to customer balance
- [ ] Merchant payment correctly requires PIN, enforces ₹100 limit, and updates both balances atomically
- [ ] Block and reissue both work and carry over balance correctly
- [ ] All failure paths (wrong PIN, insufficient balance, blocked card, over-limit) show a clear plain-language message, not raw error text
- [ ] Language switch (EN/HI/TA) works on every screen, and voice prompts play correctly per language
- [ ] Success/failure are distinguishable by color, icon, and sound — not text alone
- [ ] Receipt (PDF or print view) generates after a successful payment
- [ ] Admin dashboard reflects transactions in real time, not on manual refresh only
- [ ] Everything is deployed and reachable via a public URL, tested on the actual presentation device
