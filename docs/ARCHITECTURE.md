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
        ↓ fetch(`/api/${tenantId}/...`)
REST API (Hono app, one Cloudflare Worker)
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

**No login system yet**: the frontend's `TenantGate` (`src/components/TenantGate.tsx`) just asks
for a shop id and stores it in `localStorage` — `POST /api/tenants` and `GET /api/tenants/:id` are
public. Anyone who knows or guesses a tenant id can operate that shop's dashboard. This is
explicitly a placeholder; real auth (verifying *who* may act as a given tenant) is the top
remaining TODO before this goes anywhere near production traffic.

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

## Data model (D1 / SQLite — `migrations/0001_init.sql`)

- `tenants(id, name, whatsapp_phone_number_id, whatsapp_access_token, created_at)`
- `products` / `variants` (variant `UNIQUE(tenant_id, sku)`) / `customers`
  (`UNIQUE(tenant_id, channel, channel_user_id)`) / `orders` (`status`/`channel` CHECK
  constraints) / `order_items` — same shapes as the two prior backends. `order_items` still
  snapshots `product_name_snapshot`/`variant_snapshot`/`unit_price` at creation time and is never
  re-derived from live `products`/`variants` afterward.
- `notifications` — the mock notification log (see below).
- `whatsapp_messages` — new: logs every inbound WhatsApp message, feeds the AI Conversations page.

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

## WhatsApp webhook

`src/webhooks/whatsapp.ts` implements Meta's Cloud API contract: a `GET` verification handshake
(echoes `hub.challenge` when `hub.verify_token` matches the `WHATSAPP_VERIFY_TOKEN` secret) and a
`POST` receiver that resolves the destination tenant by `phone_number_id`, upserts the sending
customer, and logs each message into `whatsapp_messages`. It always responds `200` quickly
(processing is best-effort and wrapped in try/catch) since Meta retries aggressively on non-2xx.
**No NLP is implemented** — turning message text into an order is still exclusively
`aiBoundary.createOrder`'s job, preserving the same "AI/webhook never touches stock or confirm"
boundary as the REST-only AI surface.

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
batch-as-transaction behavior the production code relies on is exercised faithfully. 32 tests
cover the state machine, product/variant CRUD, the full order lifecycle, the stock-safety
scenarios from the spec, a genuine interleaved-confirm concurrency test, tenant isolation, the AI
boundary, and the WhatsApp webhook (verify handshake, message logging, unknown-number handling).

Before relying on this in production, the same behavior should be verified against a real D1
database (`wrangler dev` / a deployed Worker) — this sandbox's test suite proves the SQL logic is
correct, not that the deployed Cloudflare infrastructure behaves identically (it should, since D1
*is* SQLite, but this hasn't been exercised against the real service from here).

## Explicitly out of scope this phase

Per prompt1 §12: payment processing, shipping-carrier integration, CRM, advanced analytics, and a
real conversational/LLM AI agent — the WhatsApp webhook here only receives and logs, it does not
understand messages. Also out of scope for now: real authentication/authorization (see
Multi-tenancy above), sending outbound WhatsApp replies (the `whatsapp_access_token` column exists
but nothing uses it yet), and actual Cloudflare deployment verification from this sandbox.
