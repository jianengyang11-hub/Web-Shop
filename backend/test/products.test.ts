import { beforeEach, describe, expect, it } from "vitest";
import { NotFoundError } from "../src/core/exceptions";
import { Tenant } from "../src/models/types";
import * as productService from "../src/services/productService";
import { makeTestDb, makeTestTenant } from "./support/setup";

describe("product service", () => {
  let db: D1Database;
  let tenant: Tenant;

  beforeEach(async () => {
    db = await makeTestDb();
    tenant = await makeTestTenant(db);
  });

  it("creates and fetches a product", async () => {
    const product = await productService.createProduct(db, tenant.id, { name: "T-Shirt", price: 199 });
    expect(product.status).toBe("ACTIVE");

    const fetched = await productService.getProduct(db, tenant.id, product.id);
    expect(fetched.name).toBe("T-Shirt");
  });

  it("updates a product", async () => {
    const product = await productService.createProduct(db, tenant.id, { name: "Mug", price: 99 });
    const updated = await productService.updateProduct(db, tenant.id, product.id, { price: 120 });
    expect(updated.price).toBe(120);
  });

  it("deletes a product", async () => {
    const product = await productService.createProduct(db, tenant.id, { name: "Cap", price: 50 });
    await productService.deleteProduct(db, tenant.id, product.id);
    await expect(productService.getProduct(db, tenant.id, product.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("creates a variant under a product", async () => {
    const product = await productService.createProduct(db, tenant.id, { name: "Shirt", price: 300 });
    const variant = await productService.createVariant(db, tenant.id, product.id, {
      sku: "SHIRT-M-BLK",
      color: "Black",
      size: "M",
      stockQuantity: 10,
    });
    expect(variant.stockQuantity).toBe(10);
    expect(variant.productId).toBe(product.id);

    const variants = await productService.listVariants(db, tenant.id, product.id);
    expect(variants).toHaveLength(1);
  });
});
