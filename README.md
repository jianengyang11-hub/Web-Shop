# AI Online Shop Operating System — Core

A multi-tenant, PIN-protected, owner-controlled order/stock/product core: an AI (or a customer, or
an inbound WhatsApp/Messenger message) can create orders, but stock is only ever deducted when the
Owner clicks Confirm. See `prompt1.md` / `prompt2.md` for the full requirements,
`docs/ARCHITECTURE.md` for how it's built, and `docs/API.md` for the endpoint list.

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

All 49 backend tests pass in this repo's sandbox, including a concurrency test proving the
claim-first stock-safety pattern (two orders confirming at the same instant against a shared
limited-stock variant, exactly one succeeding, stock never negative) and a full auth suite
(login, missing/invalid token, cross-tenant token rejection).

### Running against real D1 locally

```
cd backend
npx wrangler login
npx wrangler d1 create shop_db          # copy the returned database_id into wrangler.toml
npm run db:migrate:local                # applies migrations/0001_init.sql + 0002_auth_and_settings.sql
npx wrangler secret put JWT_SECRET          # any random string works locally
npx wrangler secret put META_VERIFY_TOKEN   # shared by both webhooks' verification handshake
npm run dev                             # wrangler dev, serves on http://localhost:8787
```

### Deploying

```
npm run db:migrate:remote               # applies migrations to the real D1 database
npm run deploy                          # wrangler deploy
```

**Note**: PIN/password hashing (`src/core/pin.ts`) uses PBKDF2-SHA256 at 100,000 iterations —
Cloudflare Workers' WebCrypto caps PBKDF2 there (higher counts throw `NotSupportedError` at
runtime, not at deploy time — this was caught by a live 500 after an initial deploy at 210k).
Don't raise `ITERATIONS` past 100,000.

### Seeding a tenant's PIN outside the app

`POST /api/tenants` is the normal path (it hashes the PIN for you), but to set one directly in D1
(e.g. for a tenant created before auth existed), compute a matching hash with:

```
node backend/scripts/hash-pin.cjs <pin>
```

This uses Node's `crypto.pbkdf2Sync` with the same params (100k iterations, SHA-256, 32-byte key)
as `src/core/pin.ts`'s Web Crypto implementation — both produce byte-identical output for the same
input, so the result verifies correctly against the deployed Worker. Then:

```sql
UPDATE tenants SET pin_hash = '<hash>', pin_salt = '<salt>' WHERE id = '<tenant_id>';
```

applied via `wrangler d1 execute shop_db --remote --command "..."`.

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

The first screen is a PIN login (`src/components/AuthGate.tsx`): "New Shop" creates a tenant with
a chosen PIN (`POST /api/tenants`) and logs straight in; "Log In" re-authenticates an existing
shop id + PIN (`POST /api/auth/login`). The token and shop id are stored in `localStorage`; every
API call carries `Authorization: Bearer <token>`, and a `401` response clears both and reloads
back to the login screen. See `docs/ARCHITECTURE.md`'s Authentication section for the current
limits (no rate-limiting, no password reset, one PIN per shop rather than per employee).

### Deploying to Cloudflare Pages

```
npm run build
npx wrangler pages deploy dist --project-name=shop-frontend
```

`frontend/wrangler.toml` (`pages_build_output_dir = "dist"`) is already set up for this. Set
`VITE_API_BASE_URL` at build time if the deployed Worker isn't reachable at a relative `/api`
path from wherever Pages hosts the frontend.

For **auto-deploy on every push**, connect the Pages project to this GitHub repo instead of
deploying manually: Cloudflare dashboard → Workers & Pages → your Pages project → Settings →
Builds & deployments → Connect to Git (or create a fresh Pages project via Create → Pages →
Connect to Git if that option isn't offered for a project that started as a direct upload) →
authorize the GitHub App → pick this repo, with:
- Root directory: `frontend`
- Build command: `npm run build`
- Build output directory: `dist`
- Production branch: `main`
- Environment variable: `VITE_API_BASE_URL` = your deployed Worker's `/api` URL

## WhatsApp & Messenger webhooks

Point your Meta App's webhooks at:
- WhatsApp: `https://<your-worker>.workers.dev/webhooks/whatsapp`
- Messenger: `https://<your-worker>.workers.dev/api/webhooks/messenger`

using the same value for both as the `META_VERIFY_TOKEN` secret — it's one verify token per Meta
App, shared across every product's webhook. Each tenant that wants inbound orders needs its
`whatsapp_phone_number_id` and/or `messenger_page_id` (and the matching access token, to send the
automatic acknowledgement reply) set from the dashboard's **Settings** page so inbound messages
route to the right shop. See `docs/ARCHITECTURE.md` for what the webhooks do today (receive, log,
send a fixed acknowledgement — no NLP, no real conversation).

## Secrets

Never commit `JWT_SECRET`, `META_VERIFY_TOKEN`, or any tenant's access token value. Set the first
two with `wrangler secret put`; access tokens are entered per-tenant via the Settings page (stored
in D1, never returned by any public/unauthenticated endpoint).
