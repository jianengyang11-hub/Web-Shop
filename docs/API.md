# REST API

Backend: Cloudflare Worker (Hono). Base path in production is your Worker's URL (or `/api/**`
via a Pages hosting rewrite, if configured); locally it's `http://localhost:8787`.

All responses are JSON. Errors are `{ "detail": "message" }` with an appropriate HTTP status code:

| Status | Meaning |
|---|---|
| 401 | Missing/invalid/expired bearer token |
| 403 | Token valid but for a different tenant than the URL |
| 404 | Not found, or unknown tenant |
| 409 | Invalid state transition or insufficient stock |
| 422 | Validation error |
| 500 | Unexpected server error |

## Authentication

Every `/api/:tenantId/*` route requires `Authorization: Bearer <token>`, where the token's
`tenantId` claim must match the URL's `:tenantId` — a valid token for one shop is rejected (403)
against another shop's URL. Get a token via login.

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/login` | `{ tenantId, pin }` → `{ token, tenant: {id, name} }`. Same `401` for an unknown tenant or a wrong PIN, so this endpoint never reveals which tenant ids exist. Token expires after 7 days. |

`POST /api/tenants` and `GET /api/tenants/:id` remain public/unauthenticated (there's no token
yet before you have an account) — see Multi-tenancy below.

## Multi-tenancy

`POST /api/tenants` creates a shop: `{ name, pin }` (`pin` required, 4+ characters) → `201` with
`{id, name, createdAt}` — never the PIN hash/salt. `GET /api/tenants/:id` looks one up (same
public shape) for the frontend's login screen to validate a shop id before asking for a PIN.

## Products

| Method | Path |
|---|---|
| GET | `/api/:tenantId/products` |
| POST | `/api/:tenantId/products` — `{ name, description?, price, image?, status? }` |
| GET | `/api/:tenantId/products/:id` |
| PUT | `/api/:tenantId/products/:id` |
| DELETE | `/api/:tenantId/products/:id` |
| GET | `/api/:tenantId/products/:id/variants` |
| POST | `/api/:tenantId/products/:id/variants` — `{ sku, color?, size?, priceOverride?, stockQuantity?, lowStockThreshold?, status? }` |

## Variants / Stock

| Method | Path |
|---|---|
| PUT | `/api/:tenantId/variants/:id` |
| DELETE | `/api/:tenantId/variants/:id` |
| PUT | `/api/:tenantId/variants/:id/stock` — `{ stockQuantity }`, direct owner stocktake correction |
| GET | `/api/:tenantId/stock` |
| GET | `/api/:tenantId/stock/low` |

## Customers

| Method | Path |
|---|---|
| GET | `/api/:tenantId/customers` |
| GET | `/api/:tenantId/customers/:id` |

## Orders

| Method | Path | Notes |
|---|---|---|
| GET | `/api/:tenantId/orders` | |
| GET | `/api/:tenantId/orders/:id` | |
| POST | `/api/:tenantId/orders` | Always lands at `PENDING_CONFIRMATION`, never touches stock |
| POST | `/api/:tenantId/orders/:id/confirm` | Deducts stock atomically; 409 with no stock change if insufficient |
| POST | `/api/:tenantId/orders/:id/reject` | → `REJECTED`, no stock change |
| POST | `/api/:tenantId/orders/:id/preparing` | `CONFIRMED` → `PREPARING` |
| POST | `/api/:tenantId/orders/:id/shipped` | `PREPARING` → `SHIPPED` |
| POST | `/api/:tenantId/orders/:id/delivered` | `SHIPPED` → `DELIVERED` |
| POST | `/api/:tenantId/orders/:id/cancel` | `CONFIRMED` → `CANCELLED` |

### Order status transition table

| From | Allowed to |
|---|---|
| NEW | PENDING_CONFIRMATION |
| PENDING_CONFIRMATION | CONFIRMED, REJECTED |
| CONFIRMED | PREPARING, CANCELLED |
| PREPARING | SHIPPED |
| SHIPPED | DELIVERED |
| DELIVERED / CANCELLED / REJECTED | *(terminal)* |

## AI boundary

| Method | Path | Notes |
|---|---|---|
| GET | `/api/:tenantId/ai/products` | Read-only |
| GET | `/api/:tenantId/ai/stock/:variantId` | Read-only |
| GET | `/api/:tenantId/ai/products/:productId/recommendations` | In-stock variants only |
| POST | `/api/:tenantId/ai/orders` | Same body as `POST /orders`; always `channel: "AI"`, always `PENDING_CONFIRMATION` |

No AI-reachable route can confirm/reject an order or touch stock/price. Like every other
`/api/:tenantId/*` route, these also require a Bearer token — an AI/automation integration needs
one too (see docs/ARCHITECTURE.md's Authentication limits).

## WhatsApp / Messenger webhooks (not tenant-scoped — one URL per Meta App)

Both share the same `META_VERIFY_TOKEN` secret for the verification handshake — it's one value
per Meta App, not per product.

| Method | Path | Notes |
|---|---|---|
| GET | `/webhooks/whatsapp` | Meta verification handshake (`hub.mode`/`hub.verify_token`/`hub.challenge`) |
| POST | `/webhooks/whatsapp` | Receives messages; resolves tenant by `phone_number_id`, upserts the customer, logs the message, sends a fixed acknowledgement reply if the tenant has a WhatsApp access token configured. Always responds 200. |
| GET | `/api/webhooks/messenger` | Same verification handshake shape |
| POST | `/api/webhooks/messenger` | Receives Messenger messages; resolves tenant by Facebook Page id, upserts the customer, logs the message, sends the same fixed acknowledgement via the Messenger Send API if configured. Always responds 200. |

## Settings

| Method | Path | Notes |
|---|---|---|
| GET | `/api/:tenantId/settings/integrations` | Returns the four WhatsApp/Messenger credential fields (never the PIN hash/salt) |
| PUT | `/api/:tenantId/settings/integrations` | `{ whatsappPhoneNumberId?, whatsappAccessToken?, messengerPageId?, messengerAccessToken? }` |

## Notifications & Dashboard

| Method | Path | Notes |
|---|---|---|
| GET | `/api/:tenantId/notifications` | Most recent 100 events from the mock notification adapter |
| GET | `/api/:tenantId/whatsapp-messages` | Most recent 200 logged messages from **either** channel (response includes a `channel` field: `WHATSAPP` or `MESSENGER`); route path kept as-is for frontend compatibility |
| GET | `/api/:tenantId/dashboard/overview` | New/pending/confirmed counts, today's sales, product/low-stock counts, 10 most recent orders |
