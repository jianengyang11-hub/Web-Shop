# Architecture

## Why Cloudflare

The backend moved twice: FastAPI/Postgres (blocked — Postgres needed admin/UAC elevation this
sandbox couldn't grant), then Firebase Cloud Functions/Firestore (fully built and tested, but
Cloud Functions requires the Blaze billing plan). **Cloudflare Workers + D1 + Pages** is the
current stack because it's free without a card on file, and D1 being SQLite-based/relational maps
directly onto the original product/variant/order schema — stock safety goes back to plain
conditional `UPDATE ... WHERE` SQL instead of NoSQL transaction tricks.

## Layers

```
Frontend (React + Vite, one responsive PWA for mobile and desktop)
        ↓ fetch(`/api/${tenantId}/...`, Authorization: Bearer <token>)
REST API (Hono app, one Cloudflare Worker)
        ↓
Auth middleware (src/middleware/auth.ts) — verifies the JWT and that it matches :tenantId
        ↓
Tenant middleware (src/middleware/tenant.ts) — resolves & validates :tenantId
        ↓
Service Layer (src/services) — productService, orderService, aiBoundary
        ↓
Order State Machine (src/stateMachine) — the only place transitions are validated
        ↓
Repositories (src/repositories) — parameterized SQL via the D1 binding
        ↓
Cloudflare D1 (SQLite)
```

No business logic lives in the frontend. Stock deduction and order confirmation are enforced
entirely in `orderService.confirmOrder`; the dashboard and the mobile view are the same app
hitting the same API.

## Multi-tenancy

Every business table carries `tenant_id`, and every repository function takes `tenantId`
explicitly — there is no query anywhere that omits `WHERE tenant_id = ?`. `middleware/tenant.ts`
resolves `/api/:tenantId/*` once per request and 404s an unknown tenant before any handler runs.
`test/tenantIsolation.test.ts` proves two tenants can reuse the same SKU and never see each
other's products, orders, or stock — including that tenant B can't confirm tenant A's order even
by guessing its id (the lookup itself is tenant-scoped, so it 404s instead of leaking a real
order to act on).

`POST /api/tenants` and `GET /api/tenants/:id` stay public (there's no token before you have an
account) but never return `pin_hash`/`pin_salt` or any integration access token — see
Authentication below for how access to a tenant's data is actually gated now.

## Authentication

Each tenant has a PIN (or longer password) instead of a per-user account — there's one shared
credential per shop, matching the small-shop-owner scope of this project rather than a
multi-employee permission system.

- **Hashing**: PBKDF2-SHA256 via Web Crypto (`src/core/pin.ts`), random 16-byte salt per tenant.
  Iteration count is **100,000**, not the more common 210k+ — Cloudflare Workers' WebCrypto
  implementation hard-caps PBKDF2 at 100,000 iterations (`NotSupportedError` above that), unlike
  Node or browsers. This was discovered by a live 500 error after deploying with 210k and fixed by
  lowering it; `scripts/hash-pin.cjs` (Node's `crypto.pbkdf2Sync` with the same params) is
  byte-compatible for seeding PINs outside the Worker.
- **Tokens**: `hono/jwt`, HS256, secret in the `JWT_SECRET` Wrangler secret, 7-day expiry, payload
  `{ tenantId, exp }`. `POST /api/auth/login` returns one after verifying the PIN; the same
  `401 Invalid shop id or PIN` for both an unknown tenant and a wrong PIN, so the endpoint can't be
  used to enumerate which shop ids exist.
- **Enforcement**: `src/middleware/auth.ts` runs before `tenantMiddleware` on every
  `/api/:tenantId/*` route. It 401s a missing/invalid/expired token, and — importantly — 403s a
  token whose `tenantId` claim doesn't match the URL's `:tenantId`, so a valid token for shop A can
  never be replayed against shop B's data. `test/auth.test.ts` covers all of these, including the
  cross-tenant case.
- **Frontend**: `src/components/AuthGate.tsx` (replaced the earlier `TenantGate`) is the first
  screen — Log In (shop id + PIN) or New Shop (name + PIN, then auto-login). The token lives in
  `localStorage` (`src/auth.ts`) alongside the tenant id; `src/api/client.ts` attaches it to every
  request and, on a `401`, clears both and reloads to force the login screen again.

**Current limits** (fine for this phase, worth knowing before wider exposure): no rate-limiting
or lockout on login attempts (a 4-digit PIN is only 10,000 possibilities), no password reset flow,
no per-employee accounts within a shop, and the AI-boundary endpoints (`/api/:tenantId/ai/*`)
require the *same* shop-PIN-derived token as the dashboard — a real AI/automation integration
would need to be issued one too, since there's no separate machine-to-machine credential yet.

## Why the D1 stock-safety pattern is correct

D1 has no interactive multi-round-trip transaction (unlike Postgres's `SELECT ... FOR UPDATE` or
Firestore's `runTransaction`), so `orderService.confirmOrder` uses two atomic conditional
`UPDATE`s instead of a lock:

1. **Claim the order first**: `UPDATE orders SET status='CONFIRMED', confirmed_at=? WHERE id=?
   AND tenant_id=? AND status='PENDING_CONFIRMATION'`. If this affects zero rows, someone already
   confirmed/rejected it — bail out (`InvalidTransitionError`) before touching stock. This single
   statement is what makes a double-confirm, or two requests racing on the *same* order, safe:
   the loser's `UPDATE` simply matches nothing.
2. **Deduct every item's stock** with one `UPDATE variants SET stock_quantity = stock_quantity - ?
   WHERE id=? AND tenant_id=? AND stock_quantity >= ?` per item, all sent together via
   `db.batch()` (D1 wraps a batch in one transaction). A statement that matches zero rows doesn't
   throw, so every result's `meta.changes` is checked explicitly.
3. If any item lacked stock, everything is **compensated** in one more `batch()`: stock is added
   back for every item that *did* succeed, and the order is reverted to
   `status='PENDING_CONFIRMATION', confirmed_at=NULL`. Net effect: no partial deduction, order
   stays `PENDING_CONFIRMATION`, exactly as required — implemented via compensation rather than
   rollback, because D1 can't roll back a batch based on "zero rows matched," only on a thrown
   error.

`rejectOrder`/`advanceStatus` reuse the same claim-first `UPDATE ... WHERE status = <expected>`
via `orderRepository.claimStatus`, just without the stock step.

This is safe under real concurrent Workers invocations because D1 (like the SQLite it's built on)
serializes writes to a database — two conditional `UPDATE`s racing for the same row can't both
"win"; whichever's `WHERE` clause is evaluated against the still-matching row succeeds, and the
other sees the already-changed value and matches zero rows.

## Data model (D1 / SQLite — `migrations/0001_init.sql` + `0002_auth_and_settings.sql`)

- `tenants(id, name, whatsapp_phone_number_id, whatsapp_access_token, messenger_page_id,
  messenger_access_token, pin_hash, pin_salt, created_at)` — `messenger_page_id` is
  `UNIQUE` (like `whatsapp_phone_number_id`) so the Messenger webhook can route by it.
- `products` / `variants` (variant `UNIQUE(tenant_id, sku)`) / `customers`
  (`UNIQUE(tenant_id, channel, channel_user_id)`) / `orders` (`status`/`channel` CHECK
  constraints) / `order_items` — same shapes as the two prior backends. `order_items` still
  snapshots `product_name_snapshot`/`variant_snapshot`/`unit_price` at creation time and is never
  re-derived from live `products`/`variants` afterward.
- `notifications` — the mock notification log (see below).
- `channel_messages` (renamed from `whatsapp_messages` in `0002`, `+channel` column, `+external_message_id`
  renamed from `wa_message_id`) — logs every inbound WhatsApp **and** Messenger message, feeds the
  AI Conversations page. The `GET /api/:tenantId/whatsapp-messages` route path was kept as-is for
  frontend compatibility even though it now serves both channels.

## Order state machine

`src/stateMachine/orderStateMachine.ts` — unchanged from the two prior backends, ported verbatim:

```
NEW → PENDING_CONFIRMATION
PENDING_CONFIRMATION → CONFIRMED | REJECTED
CONFIRMED → PREPARING | CANCELLED
PREPARING → SHIPPED
SHIPPED → DELIVERED
```

## AI integration boundary

`src/services/aiBoundary.ts` only imports read helpers plus `createOrder` (always `channel: AI`,
always lands at `PENDING_CONFIRMATION`). It does not import `confirmOrder`, `rejectOrder`,
`advanceStatus`, or any stock/price-mutation function — checked by `test/aiBoundary.test.ts`,
which inspects the module's exports. `POST /api/:tenantId/ai/orders` is the endpoint an AI
platform (or a future NLP layer reading the WhatsApp message log) calls to place an order; only
the Owner dashboard's confirm/reject can ever change that order's fate.

## WhatsApp & Messenger webhooks

`src/webhooks/whatsapp.ts` and `src/webhooks/messenger.ts` both implement the same shape of
Meta contract: a `GET` verification handshake (echoes `hub.challenge` when `hub.verify_token`
matches the **shared** `META_VERIFY_TOKEN` secret — one value per Meta App, not per product) and a
`POST` receiver that resolves the destination tenant (by `phone_number_id` or Facebook Page id
respectively), upserts the sending customer, and logs each message into `channel_messages`. Both
always respond `200` quickly (processing is best-effort and wrapped in try/catch) since Meta
retries aggressively on non-2xx.

After logging, each webhook calls `src/services/channelSender.ts` to send a **fixed
acknowledgement reply** ("ได้รับข้อความแล้วค่ะ...") via the Graph API, using that tenant's stored
access token — this is what "reply using the right tenant's credentials" means here. It's a static
string, not a generated response: **no NLP is implemented**, and sending is skipped silently (not
an error) if the tenant hasn't configured that channel's access token in Settings. Turning message
text into an *order* is still exclusively `aiBoundary.createOrder`'s job, preserving the same
"AI/webhook never touches stock or confirm" boundary as the REST-only AI surface.

## Notifications

`src/notifications/interface.ts` defines `NotificationService.notify(db, tenantId, event)`.
`mockAdapter.ts` is the only implementation today — it logs and writes to the `notifications`
table. Order services depend only on the interface, so a real WhatsApp/LINE/Facebook outbound
adapter can be dropped in later without touching order or stock logic.

## Mobile + Web

One React app, one API, one set of business rules. `src/components/Layout.tsx` switches between
a sidebar (desktop) and a bottom tab bar (phone widths) surfacing Overview, Orders (confirm/
reject), Stock, and Notifications — the actions a small shop needs from one phone — with
everything else one tap away under "More." Built as an installable PWA (`vite-plugin-pwa`).

## Testing

`backend/test/support/d1.ts` wraps a real embedded SQLite engine (**sql.js**, pure WASM, plain
`npm install`, no native compile step, no admin rights — chosen after the Postgres/Java failures
in this sandbox) in a small D1-shaped shim, serialized through a mutex to match D1/SQLite's
single-writer model. Because it's real SQLite, the atomic-conditional-UPDATE and
batch-as-transaction behavior the production code relies on is exercised faithfully. 49 tests
cover the state machine, product/variant CRUD, the full order lifecycle, the stock-safety
scenarios from the spec, a genuine interleaved-confirm concurrency test, tenant isolation, the AI
boundary, PIN hashing, login + auth-middleware enforcement (including the cross-tenant-token
case), the integration-settings endpoint, and both webhooks (verify handshake, message logging,
unknown-tenant handling).

Note: this test suite's PBKDF2 runs through Node's WebCrypto polyfill, which — unlike the deployed
Worker — doesn't enforce the 100k-iteration cap, so a regression there wouldn't be caught locally.
The cap was only discovered via a live 500 error after deploying with a higher count; the fix
(`ITERATIONS = 100_000` in `src/core/pin.ts`) is commented with why.

Before relying on this in production, the same behavior should be verified against a real D1
database (`wrangler dev` / a deployed Worker) — this sandbox's test suite proves the SQL logic is
correct, not that the deployed Cloudflare infrastructure behaves identically (it should, since D1
*is* SQLite, but this hasn't been exercised against the real service from here).

## Explicitly out of scope this phase

Per prompt1 §12: payment processing, shipping-carrier integration, CRM, advanced analytics, and a
real conversational/LLM AI agent — both webhooks here only receive, log, and send a fixed
acknowledgement; neither understands messages. Also out of scope for now: per-employee accounts,
login rate-limiting/lockout, password reset, and a separate machine credential for AI/automation
integrations (see Authentication's Current limits above).
