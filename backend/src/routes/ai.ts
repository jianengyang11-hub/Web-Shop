import { Hono } from "hono";
import { NotFoundError } from "../core/exceptions";
import { AppEnv } from "../core/env";
import * as variantRepository from "../repositories/variantRepository";
import * as aiBoundary from "../services/aiBoundary";

export const ai = new Hono<AppEnv>();

ai.get("/ai/products", async (c) => {
  const tenant = c.get("tenant");
  return c.json(await aiBoundary.listProducts(c.env.DB, tenant.id));
});

ai.get("/ai/stock/:variantId", async (c) => {
  const tenant = c.get("tenant");
  const variant = await variantRepository.get(c.env.DB, tenant.id, c.req.param("variantId"));
  if (!variant) throw new NotFoundError(`Variant ${c.req.param("variantId")} not found`);
  return c.json(variant);
});

ai.get("/ai/products/:productId/recommendations", async (c) => {
  const tenant = c.get("tenant");
  return c.json(await aiBoundary.recommendVariants(c.env.DB, tenant.id, c.req.param("productId")));
});

/** The only write endpoint the AI has. Always lands in PENDING_CONFIRMATION; there is no
 * AI-accessible endpoint that can confirm/reject or touch stock. */
ai.post("/ai/orders", async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json();
  const order = await aiBoundary.aiCreateOrder(c.env.DB, tenant.id, body);
  return c.json(order, 201);
});
