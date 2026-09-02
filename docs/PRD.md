# Product Requirements Document (PRD)

## Batwa — Non-Mobile Digital Payment System

**Program:** Cognizant NPN Nurture Program Hackathon
**Team:** Harsh, Pratik, Krishna, Ruchir, Atharva, Mansi, Sudhanshu
**Status:** v1.0 — Forward-looking product vision (current implementation is v1 baseline)
**Last updated:** 2026-08-30

---

## 1. Executive Summary

**Batwa** ("wallet" in Hindi) enables digital payments for people who own neither a smartphone nor a bank account. A customer carries a simple **printed QR card**; cash is converted to digital balance at a neighborhood **Agent**, and spent at any **Merchant** by scanning the card and entering a 4-digit PIN.

The product targets the hundreds of millions of Indians — daily-wage workers, elderly citizens, rural residents — who remain excluded from digital payments. Batwa requires nothing from the customer except a physical card and the ability to remember a PIN. Every interaction is designed for low-literacy, low-connectivity, first-time digital users.

**Current status:** A fully working v1 exists — FastAPI backend with an atomic transaction engine, Agent Portal (registration, top-up, block/reissue), and Merchant Portal (amount entry, QR scan, PIN entry). This PRD frames that baseline and defines the path to a production-ready product.

---

## 2. Problem Statement

India's digital payment revolution has largely skipped its most vulnerable citizens:

| Barrier | Consequence |
|---|---|
| No smartphone | UPI QR payments, wallet apps, and OTP-based flows are inaccessible |
| No bank account | No on-ramp into any digital payment system |
| Low literacy | App UIs, English-only flows, and text-heavy error messages exclude users |
| Cash-only existence | Risk of theft, no transaction record, no ability to pay remotely or build financial identity |

**The user we serve:** a rickshaw driver, vegetable vendor, or retired grandparent who earns in cash, saves in cash, and can only spend in cash. They are not choosing to avoid digital payments — they are structurally locked out of them.

---

## 3. Product Vision

> **Any person, with no smartphone and no bank account, can make a safe small-value digital payment in under 10 seconds, in their own language.**

### Design Principles

1. **The customer carries only a card.** No device, no app, no account number to remember — just a printed QR and a 4-digit PIN.
2. **Humans are the infrastructure.** Agents (existing neighborhood recharge shops) are the cash-in/cash-out network. This mirrors how these communities already access digital services.
3. **Never text alone.** Every state is communicated through color, icon, and sound — plus voice prompts in Tamil, Hindi, and English.
4. **Money never half-moves.** Every balance update is atomic; every attempt — success or failure — is recorded in an immutable audit trail.
5. **Assume zero trust in the frontend.** All limits, PIN verification, and validations are enforced server-side.

---

## 4. Goals and Non-Goals

### Goals

- **G1 — Cash-to-digital on-ramp:** Agent-assisted registration in under 3 minutes, no formal KYC.
- **G2 — Instant small payments:** Merchant-side payment flow (amount → scan → PIN → result) in under 10 seconds.
- **G3 — Safety:** PIN-authorized payments, ₹100 per-transaction limit, instant card block and reissue with balance carry-over.
- **G4 — Accessibility-first UX:** Large high-contrast controls, trilingual UI + voice prompts, plain-language failure messages.
- **G5 — Complete auditability:** Every transaction (including failures, with reason) queryable per customer, agent, or merchant.

### Non-Goals (explicitly out of scope for v1; future work only)

- Real NFC/physical tap-card hardware (QR stands in during v1)
- Real bank/UPI integration or regulatory KYC
- Merchant settlement/withdrawal to bank accounts
- Smartphone customer app
- ML-based fraud detection (stretch goal only after core is stable)

---

## 5. Users and Personas

### 5.1 Customer — *Ramesh, 52, rickshaw driver*
- No smartphone, no bank account; earns daily in cash.
- **Needs:** convert cash to a safe spendable balance; pay shops without fumbling for exact change; recover if the card is lost.
- **Success:** registers once at an agent, tops up ₹200, pays ₹40 at a vegetable vendor by entering his PIN on the large keypad, hears "payment successful" in Hindi.

### 5.2 Agent — *Sunita, 34, mobile-recharge shop owner*
- Tech-comfortable; already serves the communi
ty's digital needs.
- **Needs:** fast registration and top-up flows; visibility into remaining float; card block/reissue for customers.
- **Success:** registers a customer in 3 minutes; sees her float decrease correctly with every top-up.

### 5.3 Merchant — *Vijay, 45, vegetable vendor*
- Basic smartphone or tablet; handles many small transactions per hour.
- **Needs:** a payment flow fast enough for a queue; unambiguous success/failure; clear failure reasons to relay to the customer.
- **Success:** scans a card, customer enters PIN, green screen with amount and new balance appears — no interpretation needed.

### 5.4 Admin (program operator)
- **Needs:** live transaction feed, running totals (cash converted to digital, active/blocked cards), fraud signals.

---

## 6. User Stories and Requirements

Requirements use MoSCoW priority. **FR** = functional, **NFR** = non-functional.

### 6.1 Customer Lifecycle (Agent Portal)

| ID | Requirement | Priority |
|---|---|---|
| FR-1 | Register a customer with name, phone (optional), 4-digit PIN, and language preference (en/hi/ta); no KYC | Must |
| FR-2 | Generate and display a unique, printable QR card on successful registration | Must |
| FR-3 | Maintain separate `customer_id` (permanent identity) and `card_id` (reissuable, encoded in QR) so history survives reissue | Must |
| FR-4 | Agent top-up: debit agent float, credit customer balance, in one atomic operation | Must |
| FR-5 | Block a lost/stolen card instantly | Must |
| FR-6 | Reissue a card: new QR, balance carried over, old card invalidated | Must |
| FR-7 | Show agent remaining float and updated customer balance after every top-up | Must |
| FR-8 | Balance check by customer ID | Must |

### 6.2 Payments (Merchant Portal)

| ID | Requirement | Priority |
|---|---|---|
| FR-10 | Numeric-keypad amount entry with large touch targets | Must |
| FR-11 | Camera-based QR scan of the customer card, with manual card-code entry fallback | Must |
| FR-12 | Customer PIN entry on a masked large keypad at point of sale | Must |
| FR-13 | Atomic payment: debit customer, credit merchant, together or not at all | Must |
| FR-14 | Enforce ₹100 per-transaction limit **server-side** | Must |
| FR-15 | Show unambiguous success (green, tick, sound, amount, new balance) and failure (red, cross, sound, plain-language reason) | Must |
| FR-16 | Generate a receipt (PDF or print view) after every successful payment | Should |
| FR-17 | Transaction history queryable by customer, agent, or merchant | Must |

### 6.3 Accessibility Layer (all screens)

| ID | Requirement | Priority |
|---|---|---|
| FR-20 | Language switch (EN/HI/TA) available on every screen, instantly applied | Must |
| FR-21 | Voice prompts per step ("Enter amount," "Scan your card," "Enter your PIN," "Payment successful/failed") in the selected language | Must |
| FR-22 | Success/failure distinguishable by color + icon + sound, never text/color alone | Must |
| FR-23 | Large, high-contrast UI kit shared across all portals | Must |

### 6.4 Failure Handling (closed set)

All failures resolve to exactly one of these server-side reasons, each mapped to plain-language customer-facing text:

`WRONG_PIN` · `INSUFFICIENT_BALANCE` · `BLOCKED_CARD` · `LIMIT_EXCEEDED` · `AGENT_FLOAT_INSUFFICIENT` · `CARD_NOT_FOUND` · `MERCHANT_NOT_FOUND`

> Example mapping: `INSUFFICIENT_BALANCE` → "Not enough balance" — never the raw error code.

### 6.5 Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | **Consistency:** top-ups and payments are single atomic DB transactions (`BEGIN IMMEDIATE`); no partial writes even under concurrent requests |
| NFR-2 | **Security:** PINs stored only as bcrypt hashes; never returned in any API response |
| NFR-3 | **Auditability:** every operation — including failures — recorded with type, parties, amount, status, and failure reason |
| NFR-4 | **Performance:** payment confirmation in under 2 seconds on typical connections |
| NFR-5 | **Deployability:** public URLs (backend on Render/Railway, frontend on Vercel); demo-safe with warm-up against cold starts |
| NFR-6 | **Trust boundary:** all business rules (limit, PIN, balance) validated server-side; frontend is never trusted |

---

## 7. System Overview

```
┌────────────────────┐        ┌─────────────────────┐        ┌──────────────────┐
│   Agent Portal     │        │   Merchant Portal   │        │  Admin Dashboard │
│  register · top-up │        │ amount · scan · PIN │        │  live txn feed   │
│  block · reissue   │        │  success / failure  │        │  running totals  │
└─────────┬──────────┘        └──────────┬──────────┘        └────────┬─────────┘
          │          single React app, role-based routes        │
          └──────────────┬──────────────────────┬──────────────┘
                         │      REST (JSON)     │
                ┌────────▼──────────────────────▼─────────┐
                │        FastAPI backend (Python)          │
                │  routes/  ─ customers · wallet · cards · │
                │             transactions                 │
                │  services/ ─ txn_service (atomic engine) │
                │              pin_service (bcrypt)        │
                │              qr_service (QR as base64)   │
                └────────────────┬─────────────────────────┘
                                 │
                        ┌────────▼────────┐
                        │  SQLite ledger  │
                        │ customers·agents│
                        │ merchants·cards │
                        │ transactions    │
                        └─────────────────┘
```

**Key architectural decisions**

- **Customer/card separation** — reissue changes the card, never the identity or history.
- **Agent float model** — every top-up debits the agent's pre-funded float, mirroring real cash-in economics and keeping the ledger balanced.
- **Atomic transaction engine** — a single service owns all balance mutations; routes never write balances directly.

---

## 8. Success Metrics

| Metric | v1 target (demo) | Product target |
|---|---|---|
| End-to-end payment time (scan → result) | < 10 s | < 5 s |
| Agent registration time | < 3 min | < 2 min |
| Failed payment shows plain-language reason | 100% of paths | 100% |
| Atomicity violations (partial writes) under concurrent load | 0 | 0 |
| Integration test pass rate (incl. all failure paths) | 36/36 | Continuous CI |
| Cash converted to digital (admin dashboard) | real-time | real-time |

---

## 9. Release Plan

### v1 — Hackathon baseline (built)
Agent Portal, Merchant Portal, atomic backend, trilingual UI, transaction audit trail, seeded demo environment, deployed public URLs.

### v1.1 — Near-term hardening
- PDF receipt generation after every successful payment (reportlab)
- Live-updating admin dashboard (no manual refresh)
- Voice prompt audio clips wired to every step, per language
- Cold-start warm-up automation for deployed backend

### v2 — Productization
- Rule-based fraud signals (e.g., same card twice within 60 s) surfaced on the admin dashboard
- Real NFC card hardware alongside QR
- Merchant settlement and real bank rails (requires licensing/KYC partnership)
- Agent network management (float top-up requests, commissions)

### v3 — Scale vision
- Interoperability with UPI rails via a sponsoring PSP
- Financial identity: transaction history as a thin credit file
- Multi-state language coverage beyond EN/HI/TA

---

## 10. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Concurrent transactions corrupt balances | Critical — money integrity | Single atomic transaction engine with `BEGIN IMMEDIATE`; concurrency tests |
| Users can't read failure messages | High — abandoned payments | Closed failure set mapped to plain-language text + icon + sound |
| QR scanning fails on worn cards | Medium | Manual card-code entry fallback; reissue flow |
| Agent float exhausted | Medium | Float visibility in portal; v2 float top-up requests |
| Regulatory (payments licensing) | High for v2+ | v1 stays a simulation; partner with a licensed PSP for real rails |
| Cold-start latency on free-tier hosting | Low — demo risk | Warm-up calls before presentations |

---

## 11. Open Questions

1. Should the ₹100 per-transaction limit be configurable per deployment (e.g., ₹500 pilot)?
2. Offline-first merchant operation for poor-connectivity shops — queue-and-sync design?
3. Card replacement economics — should reissue carry a fee in a real deployment?
4. What is the agent onboarding/commission model at scale?

---

*Batwa is a Cognizant NPN Nurture Program hackathon project. v1 is a simulation/demo system — balances are demo money; no real bank integration or NFC hardware.*
