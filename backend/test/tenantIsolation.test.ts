import { describe, expect, it } from "vitest";
import { NotFoundError } from "../src/core/exceptions";
import * as orderService from "../src/services/orderService";
import * as productService from "../src/services/productService";
import { makeTestDb, makeTestTenant } from "./support/setup";

describe("tenant isolation", () => {
  it("lets two tenants reuse the same SKU without colliding", async () => {
    const db = await makeTestDb();
    const tenantA = await makeTestTenant(db, { name: "Shop A" });
    const tenantB = await makeTestTenant(db, { name: "Shop B" });

    const productA = await productService.createProduct(db, tenantA.id, { name: "Widget", price: 10 });
    const productB = await productService.createProduct(db, tenantB.id, { name: "Widget", price: 20 });

    const variantA = await productService.createVariant(db, tenantA.id, productA.id, { sku: "SAME-SKU", stockQuantity: 5 });
    const variantB = await productService.createVariant(db, tenantB.id, productB.id, { sku: "SAME-SKU", stockQuantity: 50 });

    expect(variantA.sku).toBe(variantB.sku);
    expect((await productService.getVariant(db, tenantA.id, variantA.id)).stockQuantity).toBe(5);
    expect((await productService.getVariant(db, tenantB.id, variantB.id)).stockQuantity).toBe(50);
  });

  it("never returns another tenant's product, order, or stock", async () => {
    const db = await makeTestDb();
    const tenantA = await makeTestTenant(db, { name: "Shop A" });
    const tenantB = await makeTestTenant(db, { name: "Shop B" });

    const productA = await productService.createProduct(db, tenantA.id, { name: "A-only product", price: 10 });
    const variantA = await productService.createVariant(db, tenantA.id, productA.id, { sku: "A-SKU", stockQuantity: 5 });
    const orderA = await orderService.createOrder(db, tenantA.id, {
      items: [{ productId: productA.id, variantId: variantA.id, quantity: 1 }],
    });

    // Tenant B must not be able to see tenant A's data at all.
    await expect(productService.getProduct(db, tenantB.id, productA.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(productService.getVariant(db, tenantB.id, variantA.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(orderService.getOrder(db, tenantB.id, orderA.id)).rejects.toBeInstanceOf(NotFoundError);

    expect(await productService.listProducts(db, tenantB.id)).toHaveLength(0);
    expect(await orderService.listOrders(db, tenantB.id)).toHaveLength(0);
    expect(await productService.listAllStock(db, tenantB.id)).toHaveLength(0);
  });

  it("cannot confirm another tenant's order even by guessing its id", async () => {
    const db = await makeTestDb();
    const tenantA = await makeTestTenant(db, { name: "Shop A" });
    const tenantB = await makeTestTenant(db, { name: "Shop B" });

    const productA = await productService.createProduct(db, tenantA.id, { name: "Widget", price: 10 });
    const variantA = await productService.createVariant(db, tenantA.id, productA.id, { sku: "A-SKU-2", stockQuantity: 5 });
    const orderA = await orderService.createOrder(db, tenantA.id, {
      items: [{ productId: productA.id, variantId: variantA.id, quantity: 1 }],
    });

    await expect(orderService.confirmOrder(db, tenantB.id, orderA.id)).rejects.toBeInstanceOf(NotFoundError);
    expect((await orderService.getOrder(db, tenantA.id, orderA.id)).status).toBe("PENDING_CONFIRMATION");
  });
});
