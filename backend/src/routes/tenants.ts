import { Hono } from "hono";
import { AppEnv } from "../core/env";
import { verifyAuthToken } from "../core/authToken";
import { hashPin } from "../core/pin";
import { ConflictError, ValidationError } from "../core/exceptions";
import { Tenant } from "../models/types";
import * as tenantRepository from "../repositories/tenantRepository";

/** Top-level, NOT tenant-scoped — used to create a new shop and to let the frontend's login
 * screen validate a shop id before asking for a PIN. Never returns pin_hash/pin_salt or any
 * integration access token — those stay behind the authenticated settings endpoint. */
export const tenants = new Hono<AppEnv>();

const TENANT_ID_PATTERN = /^[a-zA-Z0-9_-]{3,64}$/;

function toPublicTenant(tenant: Tenant) {
  return { id: tenant.id, name: tenant.name, createdAt: tenant.createdAt };
}

tenants.post("/tenants", async (c) => {
  const body = await c.req.json<{ id?: string; name: string; pin: string }>();
  if (!body.name || !body.name.trim()) {
    throw new ValidationError("name is required");
  }
  if (!body.pin || body.pin.length < 4) {
    throw new ValidationError("pin must be at least 4 characters");
  }

  const requestedId = body.id?.trim();
  if (requestedId && !TENANT_ID_PATTERN.test(requestedId)) {
    throw new ValidationError("id must be 3-64 characters: letters, numbers, - or _");
  }
  const id = requestedId || crypto.randomUUID();
  if (requestedId && (await tenantRepository.get(c.env.DB, id))) {
    throw new ConflictError(`Shop id "${id}" is already taken`);
  }

  const { hash, salt } = await hashPin(body.pin);
  const tenant = await tenantRepository.create(c.env.DB, {
    id,
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

/** Changes the PIN for a shop the caller already holds a valid token for. Not mounted under
 * /api/:tenantId/* (this router is registered before that wildcard), so auth is checked by hand
 * here — same tenant-match rule as authMiddleware, to stop a token for one shop resetting
 * another's PIN. */
tenants.put("/tenants/:id/pin", async (c) => {
  const tenantId = c.req.param("id");

  const secret = c.env.JWT_SECRET;
  if (!secret) {
    console.error("JWT_SECRET is not configured");
    return c.json({ detail: "Server misconfiguration" }, 500);
  }

  const header = c.req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) return c.json({ detail: "Missing bearer token" }, 401);

  let payload;
  try {
    payload = await verifyAuthToken(token, secret);
  } catch {
    return c.json({ detail: "Invalid or expired token" }, 401);
  }
  if (payload.tenantId !== tenantId) {
    return c.json({ detail: "Token does not grant access to this shop" }, 403);
  }

  const tenant = await tenantRepository.get(c.env.DB, tenantId);
  if (!tenant) return c.json({ detail: `Tenant ${tenantId} not found` }, 404);

  const body = await c.req.json<{ pin: string }>();
  if (!body.pin || body.pin.length < 4) {
    throw new ValidationError("pin must be at least 4 characters");
  }

  const { hash, salt } = await hashPin(body.pin);
  await tenantRepository.updatePin(c.env.DB, tenantId, hash, salt);
  return c.json({ ok: true });
});
