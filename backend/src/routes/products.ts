import { Hono } from "hono";
import { AppEnv } from "../core/env";
import * as productService from "../services/productService";

export const products = new Hono<AppEnv>();

products.get("/products", async (c) => {
  const tenant = c.get("tenant");
  return c.json(await productService.listProducts(c.env.DB, tenant.id));
});

products.post("/products", async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json();
  const product = await productService.createProduct(c.env.DB, tenant.id, body);
  return c.json(product, 201);
});

products.get("/products/:id", async (c) => {
  const tenant = c.get("tenant");
  return c.json(await productService.getProduct(c.env.DB, tenant.id, c.req.param("id")));
});

products.put("/products/:id", async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json();
  return c.json(await productService.updateProduct(c.env.DB, tenant.id, c.req.param("id"), body));
});

products.delete("/products/:id", async (c) => {
  const tenant = c.get("tenant");
  await productService.deleteProduct(c.env.DB, tenant.id, c.req.param("id"));
  return c.body(null, 204);
});

products.get("/products/:id/variants", async (c) => {
  const tenant = c.get("tenant");
  return c.json(await productService.listVariants(c.env.DB, tenant.id, c.req.param("id")));
});

products.post("/products/:id/variants", async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json();
  const variant = await productService.createVariant(c.env.DB, tenant.id, c.req.param("id"), body);
  return c.json(variant, 201);
});
