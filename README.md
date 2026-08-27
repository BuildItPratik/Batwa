# Batwa

**Non-Mobile Digital Payment System** — Cognizant NPN Nurture Program Hackathon

> Let people without smartphones or bank accounts make small digital payments using a simple printed QR card.

---

## The Problem

Millions of people in India — daily-wage workers, elderly citizens, rural residents — are excluded from digital payments because they don't own a smartphone or have a bank account. They're stuck with cash, missing out on the convenience and safety of digital transactions.

## Our Solution

**Batwa** bridges this gap with a simple 3-step flow:

1. **Get a Card** — A customer visits a local Agent (neighborhood recharge shop), provides basic info, and receives a printed QR card
2. **Load Cash** — The customer hands cash to the Agent, who digitally loads that amount onto the card's balance
3. **Pay at Shops** — At a merchant, the customer's QR card is scanned, they enter a 4-digit PIN, and payment goes through instantly

Everything is designed for low-literacy users: large buttons, voice prompts in Tamil/Hindi/English, and clear green/red visual indicators.

> **Note:** This is a simulation/demo system — no real bank integration or NFC hardware. QR codes stand in for tap cards, and all balances are demo money.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | FastAPI (Python) |
| **Database** | SQLite (file-based, zero setup) |
| **Frontend** | React (single app, role-based routes) |
| **QR Generation** | `qrcode` Python library |
| **QR Scanning** | `html5-qrcode` JS library |
| **PIN Security** | `bcrypt` hashing |
| **PDF Receipts** | `reportlab` |
| **Voice Prompts** | Pre-recorded `.mp3` files via HTML `<audio>` |
| **Deployment** | Backend on Render/Railway, Frontend on Vercel |

---

## Project Structure

```
Batwa/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── database.py              # SQLite schema & connection management
│   ├── models.py                # Pydantic request/response models
│   ├── seed.py                  # Test data seeder
│   ├── test_endpoints.py        # Integration tests (36 checks)
│   ├── requirements.txt         # Python dependencies
│   ├── routes/
│   │   ├── customers.py         # POST /customers/register
│   │   ├── wallet.py            # POST /wallet/topup, /wallet/pay, GET /wallet/balance
│   │   ├── cards.py             # POST /cards/block, /cards/reissue
│   │   └── transactions.py     # GET /transactions
│   └── services/
│       ├── pin_service.py       # bcrypt PIN hash & verify
│       ├── qr_service.py        # QR code generation (base64 PNG)
│       └── txn_service.py       # Atomic transaction engine
├── frontend/                    # React app (Pratik, Krishna, Ruchir)
├── tapwallet-implementation-blueprint.md  # Original blueprint (kept as-is)
├── MEMORY.md                    # Project progress tracker
└── README.md
```

---

## Quick Start

### Backend

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Seed the database with test data
python seed.py

# Start the server (hot-reload enabled)
python -m uvicorn main:app --reload --port 8000
```

The API will be live at `http://localhost:8000`
Interactive docs at `http://localhost:8000/docs`

### Test Data (from seed.py)

| Type | IDs | Details |
|---|---|---|
| Agents | `AGT-001`, `AGT-002` | Float balance: 10,000 each |
| Merchants | `MER-001`, `MER-002` | Starting balance: 0 |
| Customers | `CUST-TEST01` to `CUST-TEST05` | PIN: `1234`, Balance: 0 |
| Cards | `CARD-TEST01` to `CARD-TEST05` | Status: active |

---

## API Endpoints

### Customer Registration
```
POST /customers/register
Body: { "name", "phone", "pin" (4 digits), "language_pref" (en/hi/ta) }
Returns: { "customer_id", "card_id", "qr_code_base64", "status" }
```

### Wallet Top-up (Agent loads cash)
```
POST /wallet/topup
Body: { "agent_id", "card_id", "amount" }
Returns: { "status", "new_customer_balance", "agent_float_remaining", "txn_id" }
```

### Payment (Merchant-initiated)
```
POST /wallet/pay
Body: { "merchant_id", "card_id", "amount", "pin" }
Returns: { "status", "new_customer_balance", "txn_id" }
Enforces: Rs.100 per-transaction limit
```

### Balance Check
```
GET /wallet/balance/{customer_id}
Returns: { "customer_id", "balance", "card_status" }
```

### Block Card
```
POST /cards/block
Body: { "card_id" }
Returns: { "status", "card_status" }
```

### Reissue Card
```
POST /cards/reissue
Body: { "customer_id" }
Returns: { "customer_id", "new_card_id", "qr_code_base64", "balance_carried_over" }
```

### Transaction History
```
GET /transactions?customer_id=&agent_id=&merchant_id=
Returns: { "transactions": [ { "txn_id", "type", "amount", "status", "timestamp", ... } ] }
```

### Failure Reasons (closed set)
`WRONG_PIN` | `INSUFFICIENT_BALANCE` | `BLOCKED_CARD` | `LIMIT_EXCEEDED` | `AGENT_FLOAT_INSUFFICIENT` | `CARD_NOT_FOUND` | `MERCHANT_NOT_FOUND`

---

## Architecture Decisions

### Card/Customer Separation
Unlike the original blueprint where `customer_id` doubled as the card ID, we separated these concerns:
- **`customer_id`** — permanent, never changes (e.g. `CUST-A1B2C3`)
- **`card_id`** — reissuable, encoded in QR (e.g. `CARD-X7Y8Z9`)

This means on reissue, the customer keeps their identity and transaction history. Only the card changes.

### Atomic Transactions
Every topup and payment is wrapped in a single SQLite transaction using `BEGIN IMMEDIATE`. If any step fails (balance check, PIN verify, DB write), the entire operation rolls back — money is never "half-moved."

### Audit Trail
Every operation (including failures) is recorded in the `transactions` table. Failed payments record the `failure_reason`, giving a complete audit trail.

---

## Team

| Person | Role |
|---|---|
| **Harsh** | Backend core, database schema, transaction engine, PIN security, project integration lead |
| **Pratik** | Agent Portal frontend (registration, QR display, top-up, block/reissue) |
| **Krishna** | Merchant Portal frontend (amount entry, QR scan, PIN entry, success/failure screens) |
| **Ruchir** | Accessibility layer, language switching, voice prompts, Admin dashboard |
| **Atharva** | Backend support, receipt generation, integration tests, deployment |

---

## Running Tests

With the server running on port 8000:
```bash
python test_endpoints.py
```

Tests cover: registration, topup, payment (success + all failure paths), balance check, card block, reissue, old-card-blocked-after-reissue, new-card-works, and transaction history. **36/36 checks.**

---

## License

Hackathon project — Cognizant NPN Nurture Program.