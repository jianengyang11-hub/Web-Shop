import { Hono } from "hono";
import { AppEnv } from "../core/env";
import { hashPin } from "../core/pin";
import { ValidationError } from "../core/exceptions";
import { Tenant } from "../models/types";
import * as tenantRepository from "../repositories/tenantRepository";

/** Top-level, NOT tenant-scoped — used to create a new shop and to let the frontend's login
 * screen validate a shop id before asking for a PIN. Never returns pin_hash/pin_salt or any
 * integration access token — those stay behind the authenticated settings endpoint. */
export const tenants = new Hono<AppEnv>();

function toPublicTenant(tenant: Tenant) {
  return { id: tenant.id, name: tenant.name, createdAt: tenant.createdAt };
}

tenants.post("/tenants", async (c) => {
  const body = await c.req.json<{ name: string; pin: string }>();
  if (!body.pin || body.pin.length < 4) {
    throw new ValidationError("pin must be at least 4 characters");
  }
  const { hash, salt } = await hashPin(body.pin);
  const tenant = await tenantRepository.create(c.env.DB, {
    id: crypto.randomUUID(),
    name: body.name,
    pinHash: hash,
    pinSalt: salt,
  });
  return c.json(toPublicTenant(tenant), 201);
});

tenants.get("/tenants/:id", async (c) => {
  const tenant = await tenantRepository.get(c.env.DB, c.req.param("id"));
  if (!tenant) return c.json({ detail: `Tenant ${c.req.param("id")} not found` }, 404);
  return c.json(toPublicTenant(tenant));
});
