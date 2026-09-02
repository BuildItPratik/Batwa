# Batwa API Reference

Welcome to the Batwa API reference. The Batwa API is organized around REST. Our API has predictable resource-oriented URLs, accepts JSON-encoded request bodies, returns JSON-encoded responses, and uses standard HTTP response codes.

## Base URL
Local: `http://localhost:8000`
Production: `https://batwa-xrt4.onrender.com`

---

## Authentication

Only the Admin endpoints (`/admin/stats` and `/transactions`) require authentication. 

You authenticate to the Admin API by providing a Bearer token in the `Authorization` header. You can obtain this token by exchanging the Admin PIN at the `/admin/auth` endpoint.

```http
Authorization: Bearer <your_access_token>
```

---

## Customers

### Register a Customer
Creates a new customer profile and generates a unique QR card for them.

**Endpoint:** `POST /customers/register`

**Request Body:**
```json
{
  "name": "string",
  "phone": "string",
  "pin": "string (4 digits)",
  "language_pref": "string (enum: en, hi, ta, mr)"
}
```

**Response:**
```json
{
  "customer_id": "string",
  "card_id": "string",
  "qr_code_base64": "string",
  "status": "string (SUCCESS or FAILED)"
}
```

---

## Wallet Operations

### Top-up Wallet
Loads cash onto a customer's card from an agent's float balance.

**Endpoint:** `POST /wallet/topup`

**Request Body:**
```json
{
  "agent_id": "string",
  "card_id": "string",
  "amount": "integer (positive)"
}
```

**Response:**
```json
{
  "status": "string (SUCCESS or FAILED)",
  "new_customer_balance": "integer",
  "agent_float_remaining": "integer",
  "txn_id": "string",
  "failure_reason": "string (optional)"
}
```

### Make a Payment
Executes a payment from a customer's card to a merchant. Limited to 100 rupees per transaction. Requires the customer's PIN.

**Endpoint:** `POST /wallet/pay`

**Request Body:**
```json
{
  "merchant_id": "string",
  "card_id": "string",
  "amount": "integer (positive, <= 100)",
  "pin": "string (4 digits)"
}
```

**Response:**
```json
{
  "status": "string (SUCCESS or FAILED)",
  "new_customer_balance": "integer",
  "txn_id": "string",
  "failure_reason": "string (optional)"
}
```

### Check Balance
Retrieves the balance for a specific customer.

**Endpoint:** `GET /wallet/balance/{customer_id}`

**Response:**
```json
{
  "customer_id": "string",
  "balance": "integer",
  "card_status": "string (active, blocked, no_active_card)"
}
```

---

## Cards

### Block a Card
Blocks a compromised or lost card. The customer's balance remains intact.

**Endpoint:** `POST /cards/block`

**Request Body:**
```json
{
  "card_id": "string"
}
```

**Response:**
```json
{
  "status": "string (SUCCESS or FAILED)",
  "message": "string"
}
```

### Reissue a Card
Generates a new active card for a customer, preserving their balance and transaction history.

**Endpoint:** `POST /cards/reissue`

**Request Body:**
```json
{
  "customer_id": "string"
}
```

**Response:**
```json
{
  "status": "string (SUCCESS or FAILED)",
  "new_card_id": "string",
  "qr_code_base64": "string"
}
```

---

## Transactions

### List Transactions (Admin Only)
Returns the transaction history, with optional filtering.

**Endpoint:** `GET /transactions`
**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `customer_id` (optional)
- `agent_id` (optional)
- `merchant_id` (optional)

**Response:**
```json
{
  "transactions": [
    {
      "txn_id": "string",
      "type": "string (TOPUP, PAYMENT)",
      "customer_id": "string",
      "counterparty_id": "string (agent_id or merchant_id)",
      "amount": "integer",
      "status": "string (SUCCESS, FAILED)",
      "timestamp": "ISO 8601 string",
      "failure_reason": "string (optional)"
    }
  ]
}
```

---

## Admin Statistics

### Authenticate Admin
Exchanges the Admin PIN for a Bearer token.

**Endpoint:** `POST /admin/auth`

**Request Body:**
```json
{
  "pin": "string (4 digits)"
}
```

**Response:**
```json
{
  "access_token": "string",
  "token_type": "bearer",
  "expires_in": "integer (seconds)"
}
```

### Get Statistics (Admin Only)
Returns aggregated live totals for the admin dashboard.

**Endpoint:** `GET /admin/stats`
**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "total_cash_converted": "integer",
  "total_payments_received": "integer",
  "active_cards": "integer",
  "blocked_cards": "integer",
  "total_customers": "integer",
  "total_transactions": "integer"
}
```

### Get Analytics (Admin Only)
Returns the **live** KPIs and tables computed on each request from the operational database (`batwa.db`) — the analytics dashboard polls this endpoint and reflects new top-ups/payments within a poll cycle. It does **not** require the offline pipeline (`analytics/run.py all`) or its `analytics/outputs/` artifacts. The SQL mirrors the pipeline's gold-layer definitions, so live numbers and a fresh pipeline run agree. `run_status` is `null` because no offline run feeds this live view; the offline pipeline remains a separate data-engineering add-on and still publishes its curated CSV/Parquet reports.

**Endpoint:** `GET /admin/analytics`
**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "kpis": {
    "cash_digitized": "number",
    "payments_received": "number",
    "txn_count": "integer",
    "success_count": "integer",
    "failed_count": "integer",
    "active_customers": "integer",
    "active_cards": "integer",
    "blocked_cards": "integer",
    "first_txn_date": "string (YYYY-MM-DD) | null",
    "last_txn_date": "string (YYYY-MM-DD) | null"
  },
  "daily_volume": [
    { "date_key": "string", "type": "TOPUP|PAYMENT|REISSUE|BLOCK", "status": "SUCCESS|FAILED", "txn_count": "integer", "amount_total": "number" }
  ],
  "failure_by_reason": [
    { "failure_reason": "string | null", "attempts": "integer", "pct_of_failures": "number" }
  ],
  "top_merchants": [
    { "merchant_name": "string", "payments": "integer", "total_received": "number" }
  ],
  "run_status": null
}
```

---

## Failure Reasons
When an API returns a `FAILED` status, the `failure_reason` field will contain one of the following exact string codes:

| Code | Description |
|---|---|
| `WRONG_PIN` | The 4-digit PIN did not match the hashed PIN on file. |
| `INSUFFICIENT_BALANCE` | Customer has insufficient funds for the payment. |
| `BLOCKED_CARD` | The `card_id` used has been blocked. |
| `LIMIT_EXCEEDED` | Payment amount exceeded the 100 rupee limit. |
| `AGENT_FLOAT_INSUFFICIENT` | Agent does not have enough float to process the top-up. |
| `CARD_NOT_FOUND` | The provided `card_id` does not exist. |
| `MERCHANT_NOT_FOUND` | The provided `merchant_id` does not exist. |
