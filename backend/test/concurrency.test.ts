import { describe, expect, it } from "vitest";
import { Tenant } from "../src/models/types";
import * as orderService from "../src/services/orderService";
import * as productService from "../src/services/productService";
import { makeTestDb, makeTestTenant } from "./support/setup";

describe("concurrent confirms", () => {
  it("never oversell a shared variant when two orders are confirmed at the same instant", async () => {
    const db: D1Database = await makeTestDb();
    const tenant: Tenant = await makeTestTenant(db);

    const product = await productService.createProduct(db, tenant.id, { name: "Limited", price: 50 });
    const variant = await productService.createVariant(db, tenant.id, product.id, { sku: "LIMITED-1", stockQuantity: 10 });

    const orderA = await orderService.createOrder(db, tenant.id, {
      items: [{ productId: product.id, variantId: variant.id, quantity: 6 }],
    });
    const orderB = await orderService.createOrder(db, tenant.id, {
      items: [{ productId: product.id, variantId: variant.id, quantity: 6 }],
    });

    // The "claim first" atomic UPDATE (WHERE status='PENDING_CONFIRMATION') means the outcome is
    // deterministic regardless of interleaving: whichever confirm's UPDATE lands first wins, and
    // the other matches zero rows and fails cleanly — no read-then-write race window to exploit.
    const [resultA, resultB] = await Promise.allSettled([
      orderService.confirmOrder(db, tenant.id, orderA.id),
      orderService.confirmOrder(db, tenant.id, orderB.id),
    ]);

    const outcomes = [resultA.status, resultB.status];
    expect(outcomes.filter((s) => s === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((s) => s === "rejected")).toHaveLength(1);

    const finalVariant = await productService.getVariant(db, tenant.id, variant.id);
    expect(finalVariant.stockQuantity).toBe(4);
    expect(finalVariant.stockQuantity).toBeGreaterThanOrEqual(0);
  });

  it("lets a second order succeed once enough stock remains after the first commit", async () => {
    const db: D1Database = await makeTestDb();
    const tenant: Tenant = await makeTestTenant(db);

    const product = await productService.createProduct(db, tenant.id, { name: "Plenty", price: 10 });
    const variant = await productService.createVariant(db, tenant.id, product.id, { sku: "PLENTY-1", stockQuantity: 10 });

    const orderA = await orderService.createOrder(db, tenant.id, {
      items: [{ productId: product.id, variantId: variant.id, quantity: 4 }],
    });
    const orderB = await orderService.createOrder(db, tenant.id, {
      items: [{ productId: product.id, variantId: variant.id, quantity: 4 }],
    });

    const results = await Promise.allSettled([
      orderService.confirmOrder(db, tenant.id, orderA.id),
      orderService.confirmOrder(db, tenant.id, orderB.id),
    ]);

    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    const finalVariant = await productService.getVariant(db, tenant.id, variant.id);
    expect(finalVariant.stockQuantity).toBe(2);
  });
});
