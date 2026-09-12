# AI Online Shop Operating System — Core

A multi-tenant, owner-controlled order/stock/product core: an AI (or a customer, or an inbound
WhatsApp message) can create orders, but stock is only ever deducted when the Owner clicks
Confirm. See `prompt1.md` / `prompt2.md` for the full requirements, `docs/ARCHITECTURE.md` for how
it's built, and `docs/API.md` for the endpoint list.

**Stack**: Cloudflare Workers (TypeScript + Hono) + Cloudflare D1 (SQLite) for the backend; React
+ Vite + TypeScript + Tailwind, built as an installable PWA, for one responsive dashboard that
works on a phone or a desktop, deployed to Cloudflare Pages.

## Repo layout

- `backend/` — the Worker (`src/`), D1 migrations (`migrations/`), and tests (`test/`)
- `frontend/` — the dashboard/PWA
- `docs/` — API and architecture docs

## Backend: install, build, test

```
cd backend
npm install
npm run build     # tsc --noEmit
npm test          # vitest — runs against a real embedded SQLite (sql.js), no cloud needed
```

All 32 backend tests pass in this repo's sandbox, including a concurrency test proving the
claim-first stock-safety pattern: two orders confirming at the same instant against a shared
limited-stock variant, with exactly one succeeding and stock never going negative.

### Running against real D1 locally

```
cd backend
npx wrangler login
npx wrangler d1 create shop_db          # copy the returned database_id into wrangler.toml
npm run db:migrate:local                # applies migrations/0001_init.sql to local D1
npx wrangler secret put WHATSAPP_VERIFY_TOKEN   # for the webhook handshake (can be any string locally)
npm run dev                             # wrangler dev, serves on http://localhost:8787
```

### Deploying

```
npm run db:migrate:remote               # applies migrations to the real D1 database
npm run deploy                          # wrangler deploy
```

## Frontend: install, build, run

```
cd frontend
npm install
npm run dev        # http://localhost:5173, proxies /api to localhost:8787 (wrangler dev)
npm run build       # production build + PWA service worker into dist/
```

The dashboard is one responsive app: a sidebar on desktop widths, a bottom tab bar on phone
widths, installable to a phone's home screen — no native app, no required computer, printer, or
barcode scanner.

### First run: creating a shop

There's no login system yet. On first load the app shows a small gate: "New Shop" creates a
tenant (`POST /api/tenants`) and stores its id in `localStorage`; "Enter Shop ID" re-joins an
existing one. See `docs/ARCHITECTURE.md`'s Multi-tenancy section for why this is a placeholder,
not real auth.

### Deploying to Cloudflare Pages

```
npm run build
npx wrangler pages deploy dist --project-name=shop-frontend
```

`frontend/wrangler.toml` (`pages_build_output_dir = "dist"`) is already set up for this. Set
`VITE_API_BASE_URL` at build time if the deployed Worker isn't reachable at a relative `/api`
path from wherever Pages hosts the frontend.

## WhatsApp webhook

Point your Meta App's webhook at `https://<your-worker>.workers.dev/webhooks/whatsapp`, using the
same value you set for the `WHATSAPP_VERIFY_TOKEN` secret. Each tenant that wants WhatsApp orders
needs its `whatsapp_phone_number_id` set (via `POST /api/tenants` or a direct D1 update) so
inbound messages route to the right shop. See `docs/ARCHITECTURE.md` for what the webhook does
today (receive + log only — no NLP, no auto-replies).

## Secrets

Never commit `WHATSAPP_VERIFY_TOKEN` or any `whatsapp_access_token` value. Set the former with
`wrangler secret put WHATSAPP_VERIFY_TOKEN`; the latter is stored per-tenant in D1 for future
outbound-reply support and isn't used yet.
