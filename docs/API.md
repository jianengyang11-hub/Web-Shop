# REST API

Backend: Cloudflare Worker (Hono). Base path in production is your Worker's URL (or `/api/**`
via a Pages hosting rewrite, if configured); locally it's `http://localhost:8787`.

All responses are JSON. Errors are `{ "detail": "message" }` with an appropriate HTTP status code:

| Status | Meaning |
|---|---|
| 404 | Not found, or unknown tenant |
| 409 | Invalid state transition or insufficient stock |
| 422 | Validation error |
| 500 | Unexpected server error |

## Multi-tenancy

Every business endpoint is scoped under `/api/:tenantId/...`. An unknown `tenantId` 404s before
any handler runs. There is no login system yet — see `docs/ARCHITECTURE.md` for the current
placeholder and its limits.

`POST /api/tenants` (not tenant-scoped) creates a shop: `{ name, whatsappPhoneNumberId?,
whatsappAccessToken? }` → `201` with the new tenant (including its `id`, which becomes the path
segment for every other call). `GET /api/tenants/:id` looks one up (used by the frontend's shop-id
gate).

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

No AI-reachable route can confirm/reject an order or touch stock/price.

## WhatsApp webhook (not tenant-scoped — one URL per Meta App)

| Method | Path | Notes |
|---|---|---|
| GET | `/webhooks/whatsapp` | Meta verification handshake (`hub.mode`/`hub.verify_token`/`hub.challenge`) |
| POST | `/webhooks/whatsapp` | Receives messages; resolves tenant by `phone_number_id`, upserts the customer, logs the message. Always responds 200. |

## Notifications & Dashboard

| Method | Path | Notes |
|---|---|---|
| GET | `/api/:tenantId/notifications` | Most recent 100 events from the mock notification adapter |
| GET | `/api/:tenantId/whatsapp-messages` | Most recent 200 logged WhatsApp messages, feeds the AI Conversations page |
| GET | `/api/:tenantId/dashboard/overview` | New/pending/confirmed counts, today's sales, product/low-stock counts, 10 most recent orders |
