# Batwa

## Assisted digital payments without a smartphone

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=20232A)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev/)

> Batwa lets people make small digital payments with a printed QR card and a PIN. No smartphone, bank account, or personal device is required at the point of payment.

![Batwa system architecture](docs/architecture.png)

Batwa is a working simulation of an assisted-payment network. An Agent creates and loads customer cards, a Merchant accepts payments, and an Admin sees the transaction stream as it happens.

## Progress

| Feature | Owner | Status | Details |
|---|---|---|---|
| Core API | Harsh | ✅ Complete | FastAPI + SQLite transactions |
| Frontend Shell | Atharva | ✅ Complete | React Router 7 + Auth Guards |
| Payment receipt | Ruchir | ✅ Complete | Print-friendly receipt on merchant success screen |
| Pre-demo warm-up | Harsh | ✅ Complete | `scripts/warmup.py` — 9/9 endpoints, cold-start handling |
| Architecture diagram | Harsh | ✅ Complete | `docs/architecture.png` + README |
| Integration tests | Harsh + Atharva | ✅ Complete | 41 backend + 19 frontend tests passing |
| **Deployment** | **Atharva** | **✅ Complete** | Backend live at [batwa-xrt4.onrender.com](https://batwa-xrt4.onrender.com), Frontend pending |

## The Problem

Many people are excluded from digital payments because they do not own a smartphone or bank account. Cash is familiar, but it is difficult to track, easy to lose, and cannot provide the simple audit trail that digital systems can.

The product needs to work at a local counter, on ordinary hardware, with short flows that are understandable without a complicated app.

## The Solution

Batwa turns a printed card into a small, assisted wallet:

1. **Register** — An Agent creates a customer profile and prints a QR card.
2. **Load cash** — The customer gives cash to the Agent, who credits the card from the Agent float.
3. **Pay** — A Merchant scans the card, confirms the amount, and the customer enters a four-digit PIN.
4. **Track** — Every successful or failed operation is recorded in the transaction history and shown on the Admin dashboard.

## What Each Role Does

| Role | Responsibility | Main routes |
|---|---|---|
| **Customer** | Carries the printed QR card and privately enters the PIN | Represented by the card and PIN flows |
| **Agent** | Registers customers, loads cash, blocks cards, and reissues cards | `/agent`, `/agent/register`, `/agent/topup`, `/agent/manage` |
| **Merchant** | Runs a small payment terminal and prints a receipt | `/merchant`, `/merchant/pay` |
| **Admin** | Monitors totals and the live transaction feed | `/admin` |

## Payment Flow

```text
 CUSTOMER                 AGENT COUNTER                 MERCHANT COUNTER
    │                           │                              │
    │  identity + cash          │                              │
    ├──────────────────────────>│                              │
    │                           │ POST /customers/register     │
    │                           │ POST /wallet/topup           │
    │<──── printed QR card ─────│                              │
    │                           │                              │
    │                    presents printed card                 │
    ├─────────────────────────────────────────────────────────>│
    │                           │                              │
    │                           │                 scan card / enter ID
    │                           │                 confirm amount
    │                           │                 enter PIN
    │                           │                              │
    │                           │                 POST /wallet/pay
    │<─────────────────────────────────────────────────────────│
    │                    payment result + receipt              │
    │                           │                              │
    └───────────────────────────┴──────────────┬───────────────┘
                                               ▼
                                      SQLite audit trail
```

## Why This Works

### Card and customer identity are separate

`customer_id` is permanent. `card_id` is encoded in the QR code and can be blocked or reissued. A reissued card keeps the customer balance and transaction history.

### Money movement is atomic

Top-ups and payments use SQLite transactions with `BEGIN IMMEDIATE`. A failed validation, PIN check, or database write rolls the complete operation back.

### Failure is a first-class result

Wrong PINs, blocked cards, insufficient balance, limit violations, and unavailable merchants are returned with explicit failure reasons and stored in the audit trail.

### The interface is counter-first

The flows use large controls, camera and manual card-entry paths, visible confirmation steps, printable receipts, pre-recorded voice prompts, and responsive layouts for small screens.

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                    React 19 + TypeScript                    │
│                                                             │
│  Agent Centre     Merchant Counter       Admin Dashboard    │
│  register         amount / scan / PIN    live totals/feed   │
│  top-up           receipt                auto-refresh       │
│  block/reissue                                              │
└─────────────────────────────┬───────────────────────────────┘
                              │ fetch(JSON)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         FastAPI                             │
│  customers  wallet  cards  transactions  admin              │
│  PIN validation  QR generation  atomic transaction service  │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         SQLite                              │
│  customers  cards  agents  merchants  transactions          │
└─────────────────────────────────────────────────────────────┘
```

The frontend has one shared shell with role-aware navigation. API clients are kept at the boundary, and backend field names are passed through without renaming.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, React Router 7 |
| UI | Shared TypeScript components and semantic CSS tokens |
| Backend | FastAPI, Python |
| Database | SQLite with WAL mode and foreign-key checks |
| QR generation | Python `qrcode` and Pillow |
| QR scanning | Browser `html5-qrcode` |
| PIN security | `bcrypt` hashes; PINs are never printed or persisted in plaintext |
| Receipts | Browser print layout |
| Voice feedback | Static MP3 prompts via HTML audio |
| Translation | Runtime API translation with local cache and English fallback |

## Language Support

The UI supports English, Hindi, Tamil, and Marathi across the landing page, Agent Centre, Merchant Counter, Admin Dashboard, scanner, forms, keypad, and receipts.

English is the only source copy maintained in code. When another language is selected, the frontend translates the source copy at runtime through `VITE_TRANSLATION_API_URL`. The default endpoint is MyMemory. Custom endpoints must return the same MyMemory-compatible response shape. Successful translations are cached in local storage; if the endpoint is unavailable, the interface remains usable in English.

Marathi also includes five static voice prompts for amount entry, scanning, PIN entry, success, and failure.

To use another MyMemory-compatible translation endpoint:

```bash
VITE_TRANSLATION_API_URL=https://your-translation-service.example/translate
```

## Quick Start

### Requirements

- Node.js 20.19 or newer
- pnpm 11 or newer
- Python 3.10 or newer

### Install and seed the backend

```bash
cd backend
python -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python seed.py
cd ..
```

On Windows, use `.venv\Scripts\python` and `.venv\Scripts\pip`.

### Install and run both services

```bash
pnpm setup:frontend
[ -f frontend/agent-portal/.env ] || cp frontend/agent-portal/.env.example frontend/agent-portal/.env
pnpm dev
```

The services start at:

- Frontend: `http://localhost:5173`
- API: `http://localhost:8000`
- API documentation: `http://localhost:8000/docs`

The root dev script uses `backend/.venv` automatically when it exists. Set `BATWA_PYTHON` to use another Python executable.

To run one service:

```bash
pnpm dev:frontend
pnpm dev:backend
```

## Demo Data

`backend/seed.py` creates local demo records:

| Type | IDs | Details |
|---|---|---|
| Agents | `AGT-001`, `AGT-002` | Float balance: 10,000 each |
| Merchants | `MER-001`, `MER-002` | Starting balance: 0 |
| Customers | `CUST-TEST01` to `CUST-TEST05` | PIN: `1234`, balance: 0 |
| Cards | `CARD-TEST01` to `CARD-TEST05` | Active at seed time |

Demo merchant switching is available at `/merchant/setup`. It stores only the selected merchant ID in browser session storage.

## API Surface

### Customer Registration

```text
POST /customers/register
Body: { "name", "phone", "pin", "language_pref" }
Returns: { "customer_id", "card_id", "qr_code_base64", "status" }
```

`language_pref` accepts `en`, `hi`, `ta`, or `mr`.

### Wallet Top-up

```text
POST /wallet/topup
Body: { "agent_id", "card_id", "amount" }
Returns: { "status", "new_customer_balance", "agent_float_remaining", "txn_id" }
```

### Payment

```text
POST /wallet/pay
Body: { "merchant_id", "card_id", "amount", "pin" }
Returns: { "status", "new_customer_balance", "txn_id", "failure_reason" }
```

Payments are limited to 100 rupees per transaction.

### Card Management

```text
POST /cards/block
Body: { "card_id" }

POST /cards/reissue
Body: { "customer_id" }
```

### Transaction History
```text
GET /transactions?customer_id=&agent_id=&merchant_id=
Headers: Authorization: Bearer <token>
Returns: { "transactions": [ { "txn_id", "type", "amount", "status", "timestamp", ... } ] }
```

### Admin Authentication
```text
POST /admin/auth
Body: { "pin" }
Returns: { "access_token", "token_type", "expires_in" }
```

### Admin Statistics
```text
GET /admin/stats
Headers: Authorization: Bearer <token>
Returns: aggregate balances, card counts, customer count, and transaction count
```

The Admin dashboard refreshes its totals and transaction feed every five seconds.

### Failure Reasons

```text
WRONG_PIN
INSUFFICIENT_BALANCE
BLOCKED_CARD
LIMIT_EXCEEDED
AGENT_FLOAT_INSUFFICIENT
CARD_NOT_FOUND
MERCHANT_NOT_FOUND
```

## Project Structure

```text
Batwa/
├── backend/
│   ├── main.py                  # FastAPI application entry point
│   ├── database.py              # SQLite schema and connections
│   ├── models.py                # Request and response contracts
│   ├── seed.py                  # Local demo data
│   ├── test_endpoints.py        # Backend integration checks
│   ├── requirements.txt         # Backend dependencies
│   ├── routes/                  # Customer, wallet, card, transaction, admin routes
│   └── services/                # PIN, QR, and transaction services
├── frontend/agent-portal/
│   ├── src/api/                 # Backend integration boundaries
│   ├── src/components/          # Shared shell and UI primitives
│   ├── src/i18n/                # English source copy and runtime translation
│   ├── src/pages/               # Agent, Merchant, Admin, and landing routes
│   ├── src/styles/              # Design tokens and product styles
│   ├── public/audio/            # English, Hindi, Tamil, and Marathi prompts
│   ├── tests/                   # Vitest tests and asset checks
│   ├── package.json
│   └── pnpm-lock.yaml
├── docs/architecture.png        # Architecture diagram
├── scripts/dev.mjs              # Run frontend and backend together
├── scripts/warmup.py            # Pre-demo API warm-up
├── scripts/generate_audio.py    # Static voice prompt generator
├── .gitignore
├── package.json
├── pnpm-lock.yaml
└── README.md
```

Generated files such as `.venv`, `node_modules`, `dist`, `__pycache__`, `.db`, `.env`, and tool state are intentionally ignored.

## Testing

Frontend checks:

```bash
pnpm --dir frontend/agent-portal test
pnpm --dir frontend/agent-portal typecheck
pnpm --dir frontend/agent-portal build
```

Backend integration checks require the API to be running on port 8000 and a freshly seeded database:

```bash
rm -f backend/batwa.db backend/batwa.db-journal backend/batwa.db-wal backend/batwa.db-shm
backend/.venv/bin/python backend/seed.py
pnpm dev:backend
```

In a second terminal:

```bash
backend/.venv/bin/python backend/test_endpoints.py
```

The integration suite covers registration, top-ups, successful and failed payments, balances, card blocking, reissue, transaction history, and Admin statistics.

The admin dashboard at `/admin` uses the demo PIN `2468` by default. Set `BATWA_ADMIN_PIN` to override it in a deployment. The PIN is exchanged for a short-lived bearer token; both `/transactions` and `/admin/stats` reject unauthenticated requests. Copy `backend/.env.example` for the optional token settings. Set `VITE_BASE_PATH` when serving the frontend below a subpath so links and assets remain inside that deployment path.

## Boundaries

Batwa is a local-money simulation. It does not connect to a bank, UPI, NFC card, or payment network. The QR card represents a stored wallet identity, and all balances are demo data.

The default translation provider is a public third-party endpoint. Production deployments should configure a managed or self-hosted provider with an appropriate quota, privacy policy, and availability guarantee.
