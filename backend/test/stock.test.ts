import { beforeEach, describe, expect, it } from "vitest";
import { InsufficientStockError } from "../src/core/exceptions";
import { OrderStatus } from "../src/models/enums";
import { Tenant } from "../src/models/types";
import * as orderService from "../src/services/orderService";
import * as productService from "../src/services/productService";
import { makeTestDb, makeTestTenant } from "./support/setup";

async function makeProductWithVariant(db: D1Database, tenantId: string, stockQuantity: number, lowStockThreshold = 5) {
  const product = await productService.createProduct(db, tenantId, { name: "Widget", price: 100 });
  const variant = await productService.createVariant(db, tenantId, product.id, { sku: `W-${product.id}`, stockQuantity, lowStockThreshold });
  return { product, variant };
}

describe("stock", () => {
  let db: D1Database;
  let tenant: Tenant;

  beforeEach(async () => {
    db = await makeTestDb();
    tenant = await makeTestTenant(db);
  });

  it("direct stock correction never goes negative and reflects the set value", async () => {
    const { product, variant } = await makeProductWithVariant(db, tenant.id, 5);
    const updated = await productService.setStock(db, tenant.id, variant.id, 0);
    expect(updated.stockQuantity).toBe(0);
  });

  it("lists low-stock variants and excludes healthy ones", async () => {
    const { variant: lowVariant } = await makeProductWithVariant(db, tenant.id, 2, 5);
    const { variant: healthyVariant } = await makeProductWithVariant(db, tenant.id, 50, 5);

    const low = await productService.listLowStock(db, tenant.id);
    const lowIds = low.map((v) => v.id);
    expect(lowIds).toContain(lowVariant.id);
    expect(lowIds).not.toContain(healthyVariant.id);
  });

  it("matches the spec example: stock=10 order qty=2 -> confirm -> 8; stock=1 order qty=2 -> error, stock stays 1", async () => {
    const { product, variant } = await makeProductWithVariant(db, tenant.id, 10);
    const order = await orderService.createOrder(db, tenant.id, {
      items: [{ productId: product.id, variantId: variant.id, quantity: 2 }],
    });
    await orderService.confirmOrder(db, tenant.id, order.id);
    expect((await productService.getVariant(db, tenant.id, variant.id)).stockQuantity).toBe(8);

    const { product: product2, variant: variant2 } = await makeProductWithVariant(db, tenant.id, 1);
    const order2 = await orderService.createOrder(db, tenant.id, {
      items: [{ productId: product2.id, variantId: variant2.id, quantity: 2 }],
    });
    await expect(orderService.confirmOrder(db, tenant.id, order2.id)).rejects.toBeInstanceOf(InsufficientStockError);
    expect((await productService.getVariant(db, tenant.id, variant2.id)).stockQuantity).toBe(1);
    expect((await orderService.getOrder(db, tenant.id, order2.id)).status).toBe(OrderStatus.PENDING_CONFIRMATION);
  });
});
