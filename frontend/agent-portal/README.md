# Batwa — shared frontend host

Shared React 19 + TypeScript + Vite host for the Agent, Merchant and Admin
roles. Batwa keeps the customer experience phone-free while the Agent and
Merchant work at familiar local counters.

## Setup

```bash
cd frontend/agent-portal
pnpm install
cp .env.example .env
pnpm dev
```

Point `VITE_API_BASE_URL` at Harsh’s backend. The frontend uses the real endpoints, not mocks.

The frontend requires Node.js 20.19 or newer and uses pnpm. The repository pins
the package-manager version in `package.json`; with Corepack enabled, run
`corepack enable` once if `pnpm` is not already installed.

Useful commands:

```bash
pnpm typecheck       # TypeScript validation
pnpm test            # Vitest unit tests
pnpm build           # Typecheck + production build
pnpm preview         # Serve the production build locally
```

## Routes and ownership

- `/` — Batwa role-entry landing
- `/agent` — Agent Centre task selection
- `/agent/register` — customer registration and printable QR card
- `/agent/topup` — scan/manual card lookup, review, top-up and receipt
- `/agent/manage` — block/reissue card flows
- `/merchant` and `/merchant/pay` — Merchant payment terminal
- `/merchant/setup` — demo merchant selector
- `/admin` — live transaction feed and monitoring totals

The frontend is TypeScript. `src/api/agentApi.ts`, `src/api/merchantApi.ts`
and `src/api/adminApi.ts` are the integration boundaries; neither wrapper
renames backend fields or endpoints.

## Shared Batwa foundation

Reusable components live under `src/components/`: `WorkspaceShell` (the shared role shell), `WorkspaceSidebar`, `WorkspaceHeader`, `LanguageMenu`, `Icon`, `BatwaBrand`, `PortalFrame`, `Button`, `FormField`, `StatusPanel`, `LoadingState`, `NumericKeypad`, `ProgressSteps`, `LanguageSelector`, and `QrScanner`. `AppShell` remains a compatibility export to `WorkspaceShell`.

`QrScanner` is the shared `html5-qrcode` boundary. Render it with `active={false}` until an explicit camera action; `showCamera={false}` provides a clean manual path. Design tokens are semantic CSS variables in `src/styles/tokens.css`; product styles are in `src/styles/ui.css`.

Translated strings and audio hooks live in `src/i18n/copy.ts` and
`LanguageContext.tsx`. The language menu is an intentionally small boundary
for English, Hindi and Tamil labels; screens should read copy from the context
rather than embed translation logic. Admin consumes `WorkspaceShell` and the
shared primitives under `/admin`. The generated atmospheric image is local at
`public/assets/batwa-bazaar-hero.webp`, and important form text always sits on
opaque surfaces.

The internal workspace uses `--batwa-color-surface`, `--batwa-color-surface-soft`, `--batwa-color-ink`, `--batwa-color-indigo`, `--batwa-color-terracotta`, `--batwa-color-turmeric`, `--batwa-color-leaf`, `--batwa-color-error`, `--batwa-color-border`, `--batwa-font-display`, `--batwa-font-body` and `--batwa-focus-ring`. Prefer these semantic names and the existing spacing/radius tokens; keep role-specific layout in `ui.css` scoped below `.workspace-shell`.

Agent, Merchant and Admin pages are regular children of the single
`BrowserRouter` in `src/main.tsx`; wrap new role screens in
`AppShell`/`WorkspaceShell` rather than adding another router. Use
`WorkspaceHeader` for the breadcrumb and real identity chip, and add role
navigation in `WorkspaceSidebar` only when a route has a real workflow. New
screens should reuse `QrScanner` with `active={false}` until the operator
explicitly chooses the camera. Keep QR/card IDs safe to display where useful,
never persist PINs, and keep atmospheric imagery out of transactional controls.

Demo merchant selection is controlled by `VITE_DEMO_MODE`. It uses the seeded `MER-001 / Annapurna Vegetables` and `MER-002 / Ravi Tea Stall` identities and stores only the selected merchant ID in the current browser session. With demo mode disabled, the terminal uses `VITE_MERCHANT_ID` and `VITE_MERCHANT_NAME`; production identity is expected to come from authenticated merchant provisioning.

## Styling and accessibility

Use semantic token names rather than raw colours. Transaction controls are at least 56px, focus is visible, heading focus is programmatic without a persistent heavy outline, and reduced motion is respected. Keep the illustration atmospheric and never behind payment or PIN text.
