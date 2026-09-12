import { Hono } from "hono";
import { AppEnv } from "../core/env";
import * as productService from "../services/productService";

export const variants = new Hono<AppEnv>();

variants.put("/variants/:id", async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json();
  return c.json(await productService.updateVariant(c.env.DB, tenant.id, c.req.param("id"), body));
});

variants.delete("/variants/:id", async (c) => {
  const tenant = c.get("tenant");
  await productService.deleteVariant(c.env.DB, tenant.id, c.req.param("id"));
  return c.body(null, 204);
});

variants.put("/variants/:id/stock", async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json();
  return c.json(await productService.setStock(c.env.DB, tenant.id, c.req.param("id"), body.stockQuantity));
});

variants.get("/stock", async (c) => {
  const tenant = c.get("tenant");
  return c.json(await productService.listAllStock(c.env.DB, tenant.id));
});

variants.get("/stock/low", async (c) => {
  const tenant = c.get("tenant");
  return c.json(await productService.listLowStock(c.env.DB, tenant.id));
});
