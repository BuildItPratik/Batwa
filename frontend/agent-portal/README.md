# TapWallet — Agent Portal (Pratik)

Frontend for the Agent role: register customers, top up wallets, block/reissue cards.

## Setup

```bash
cd agent-portal
npm install
cp .env.example .env       # point VITE_API_BASE_URL at Harsh's backend
npm run dev                # runs on http://localhost:5173
```

Requires Harsh's backend running (`python -m uvicorn main:app --reload --port 8000`
from `/backend`, per MEMORY.md).

## What's built

- `/agent/register` — customer registration form → displays generated QR card
- `/agent/topup` — enter/scan card ID + cash amount → shows new balance + agent float remaining
- `/agent/manage` — block a card (with confirm step) or reissue a new one, balance carried over

All wired to Harsh's **real** endpoints (not mocks), using the updated contract from
`MEMORY.md` (`card_id`, not `customer_id`, in topup/pay/block requests).

## Open items / questions for the team

1. **`/wallet/balance/{id}` — card_id or customer_id?** MEMORY.md's Decision 1 renamed
   fields on register/topup/pay/block/reissue but didn't explicitly say what this GET
   endpoint expects now. Not blocking for my screens (topup/reissue responses already
   return the new balance directly), but Ruchir's admin dashboard or Atharva's receipts
   may hit this — worth confirming with Harsh before someone guesses wrong.
2. **QR scanning on the top-up screen**: right now card ID entry is manual text input.
   The blueprint says this screen should support scan-or-enter. Once Krishna builds the
   `html5-qrcode` integration for the Merchant Portal, I'll reuse that component here
   rather than duplicating it — flagging so we don't build it twice.
3. **No agent login/session** — the top-up screen currently has a plain text field for
   `agent_id` defaulting to `AGT-001`. Fine for a demo but worth a 30-second team gut
   check that we're not expected to build agent auth.
4. **Merge point (Day 4)**: per the blueprint this is meant to live inside one shared
   React app with `/agent`, `/merchant`, `/customer`, `/admin` routes. This repo only
   defines `/agent/*` routes so far — when merging with Krishna/Ruchir's routers, nest
   these three `<Route>`s under the shared app's `/agent` path instead of running a
   separate `<BrowserRouter>`.

## Styling

`src/styles/global.css` is a plain, high-contrast, large-touch-target placeholder
(64px min touch targets, visible focus rings, no framework dependency) so it's easy
to swap for Ruchir's shared UI kit once it lands — nothing here should require a
rewrite, just a class-name swap.
