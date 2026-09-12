import { describe, expect, it } from "vitest";
import { OrderChannel, OrderStatus } from "../src/models/enums";
import { Tenant } from "../src/models/types";
import * as aiBoundary from "../src/services/aiBoundary";
import * as productService from "../src/services/productService";
import { makeTestDb, makeTestTenant } from "./support/setup";

describe("AI integration boundary", () => {
  it("exposes no confirm/reject/stock-mutation capability", () => {
    const forbidden = ["confirm", "reject", "setstock", "updatestock", "advancestatus", "deduct"];
    const publicNames = Object.keys(aiBoundary);
    const offending = publicNames.filter((name) => forbidden.some((bad) => name.toLowerCase().includes(bad)));
    expect(offending).toEqual([]);
  });

  it("creates AI orders as PENDING_CONFIRMATION without touching stock", async () => {
    const db: D1Database = await makeTestDb();
    const tenant: Tenant = await makeTestTenant(db);

    const product = await productService.createProduct(db, tenant.id, { name: "AI Widget", price: 80 });
    const variant = await productService.createVariant(db, tenant.id, product.id, { sku: "AI-W-1", stockQuantity: 10 });

    const order = await aiBoundary.aiCreateOrder(db, tenant.id, {
      items: [{ productId: product.id, variantId: variant.id, quantity: 3 }],
    });

    expect(order.status).toBe(OrderStatus.PENDING_CONFIRMATION);
    expect(order.channel).toBe(OrderChannel.AI);

    const stock = await productService.getVariant(db, tenant.id, variant.id);
    expect(stock.stockQuantity).toBe(10);
  });
});
