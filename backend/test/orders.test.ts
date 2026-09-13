import { beforeEach, describe, expect, it } from "vitest";
import app from "../src/index";
import { InsufficientStockError, InvalidTransitionError } from "../src/core/exceptions";
import { OrderStatus } from "../src/models/enums";
import { Tenant } from "../src/models/types";
import * as orderService from "../src/services/orderService";
import * as productService from "../src/services/productService";
import { makeTestDb, makeTestTenant } from "./support/setup";

const JWT_SECRET = "test-secret";

function envFor(db: D1Database) {
  return { DB: db, JWT_SECRET, META_VERIFY_TOKEN: "verify-token" };
}

async function makeProductWithVariant(db: D1Database, tenantId: string, stockQuantity = 10, price = 100) {
  const product = await productService.createProduct(db, tenantId, { name: "Widget", price });
  const variant = await productService.createVariant(db, tenantId, product.id, { sku: `W-${product.id}`, stockQuantity });
  return { product, variant };
}

function orderPayload(product: { id: string }, variant: { id: string }, quantity: number) {
  return {
    customer: { name: "Alice" },
    items: [{ productId: product.id, variantId: variant.id, quantity }],
  };
}

describe("order service", () => {
  let db: D1Database;
  let tenant: Tenant;

  beforeEach(async () => {
    db = await makeTestDb();
    tenant = await makeTestTenant(db);
  });

  it("creates an order in PENDING_CONFIRMATION without touching stock", async () => {
    const { product, variant } = await makeProductWithVariant(db, tenant.id, 10);
    const order = await orderService.createOrder(db, tenant.id, orderPayload(product, variant, 2));

    expect(order.status).toBe(OrderStatus.PENDING_CONFIRMATION);
    expect(order.total).toBe(200);

    const stock = await productService.getVariant(db, tenant.id, variant.id);
    expect(stock.stockQuantity).toBe(10);
  });

  it("confirming with sufficient stock deducts exactly", async () => {
    const { product, variant } = await makeProductWithVariant(db, tenant.id, 10);
    const order = await orderService.createOrder(db, tenant.id, orderPayload(product, variant, 2));

    const confirmed = await orderService.confirmOrder(db, tenant.id, order.id);
    expect(confirmed.status).toBe(OrderStatus.CONFIRMED);
    expect(confirmed.confirmedAt).not.toBeNull();

    const stock = await productService.getVariant(db, tenant.id, variant.id);
    expect(stock.stockQuantity).toBe(8);
  });

  it("confirming with insufficient stock fails and leaves stock/status untouched", async () => {
    const { product, variant } = await makeProductWithVariant(db, tenant.id, 1);
    const order = await orderService.createOrder(db, tenant.id, orderPayload(product, variant, 2));

    await expect(orderService.confirmOrder(db, tenant.id, order.id)).rejects.toBeInstanceOf(InsufficientStockError);

    const stayed = await orderService.getOrder(db, tenant.id, order.id);
    expect(stayed.status).toBe(OrderStatus.PENDING_CONFIRMATION);

    const stock = await productService.getVariant(db, tenant.id, variant.id);
    expect(stock.stockQuantity).toBe(1);
  });

  it("rejecting does not touch stock", async () => {
    const { product, variant } = await makeProductWithVariant(db, tenant.id, 10);
    const order = await orderService.createOrder(db, tenant.id, orderPayload(product, variant, 3));

    const rejected = await orderService.rejectOrder(db, tenant.id, order.id);
    expect(rejected.status).toBe(OrderStatus.REJECTED);

    const stock = await productService.getVariant(db, tenant.id, variant.id);
    expect(stock.stockQuantity).toBe(10);
  });

  it("double-confirm does not double-deduct", async () => {
    const { product, variant } = await makeProductWithVariant(db, tenant.id, 10);
    const order = await orderService.createOrder(db, tenant.id, orderPayload(product, variant, 2));

    await orderService.confirmOrder(db, tenant.id, order.id);
    await expect(orderService.confirmOrder(db, tenant.id, order.id)).rejects.toBeInstanceOf(InvalidTransitionError);

    const stock = await productService.getVariant(db, tenant.id, variant.id);
    expect(stock.stockQuantity).toBe(8);
  });

  it("progresses through the full status chain and blocks a reverse transition", async () => {
    const { product, variant } = await makeProductWithVariant(db, tenant.id, 5);
    const order = await orderService.createOrder(db, tenant.id, orderPayload(product, variant, 1));

    await orderService.confirmOrder(db, tenant.id, order.id);
    expect((await orderService.advanceStatus(db, tenant.id, order.id, OrderStatus.PREPARING)).status).toBe(OrderStatus.PREPARING);
    expect((await orderService.advanceStatus(db, tenant.id, order.id, OrderStatus.SHIPPED)).status).toBe(OrderStatus.SHIPPED);
    expect((await orderService.advanceStatus(db, tenant.id, order.id, OrderStatus.DELIVERED)).status).toBe(OrderStatus.DELIVERED);

    await expect(orderService.confirmOrder(db, tenant.id, order.id)).rejects.toBeInstanceOf(InvalidTransitionError);
  });

  it("records which staff member confirmed the order (attribution shown to the Owner)", async () => {
    const attributedTenant = await makeTestTenant(db, { name: "Attributed Shop", pin: "1234" });
    const { product, variant } = await makeProductWithVariant(db, attributedTenant.id, 10);
    const order = await orderService.createOrder(db, attributedTenant.id, orderPayload(product, variant, 1));

    const loginRes = await app.request(
      "/api/auth/login",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId: attributedTenant.id, pin: "1234" }),
      },
      envFor(db)
    );
    const { token } = await loginRes.json();

    const confirmRes = await app.request(
      `/api/${attributedTenant.id}/orders/${order.id}/confirm`,
      { method: "POST", headers: { Authorization: `Bearer ${token}` } },
      envFor(db)
    );
    expect(confirmRes.status).toBe(200);
    expect((await confirmRes.json()).lastActorName).toBe("Owner");
  });

  it("keeps the item snapshot even after the product is edited later", async () => {
    const { product, variant } = await makeProductWithVariant(db, tenant.id, 5, 100);
    const order = await orderService.createOrder(db, tenant.id, orderPayload(product, variant, 1));

    await productService.updateProduct(db, tenant.id, product.id, { name: "Renamed", price: 999 });

    const fetched = await orderService.getOrder(db, tenant.id, order.id);
    expect(fetched.items[0].productNameSnapshot).toBe("Widget");
    expect(fetched.items[0].unitPrice).toBe(100);
  });
});
