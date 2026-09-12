import { Hono } from "hono";
import { AppEnv } from "../core/env";
import * as tenantRepository from "../repositories/tenantRepository";

/** Top-level, NOT tenant-scoped — used to create a new shop and to let the frontend's
 * "enter shop id" gate validate an id before storing it. No auth yet (see docs/ARCHITECTURE.md
 * TODOs) — anyone who knows a tenant id can read its data through the tenant-scoped API. */
export const tenants = new Hono<AppEnv>();

tenants.post("/tenants", async (c) => {
  const body = await c.req.json<{ name: string; whatsappPhoneNumberId?: string; whatsappAccessToken?: string }>();
  const tenant = await tenantRepository.create(c.env.DB, {
    id: crypto.randomUUID(),
    name: body.name,
    whatsappPhoneNumberId: body.whatsappPhoneNumberId ?? null,
    whatsappAccessToken: body.whatsappAccessToken ?? null,
  });
  return c.json(tenant, 201);
});

tenants.get("/tenants/:id", async (c) => {
  const tenant = await tenantRepository.get(c.env.DB, c.req.param("id"));
  if (!tenant) return c.json({ detail: `Tenant ${c.req.param("id")} not found` }, 404);
  return c.json(tenant);
});
