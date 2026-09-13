import { Hono } from "hono";
import { AppEnv } from "../core/env";
import { signAuthToken } from "../core/authToken";
import * as staffRepository from "../repositories/staffRepository";
import * as tenantRepository from "../repositories/tenantRepository";

/** Not tenant-scoped by path — the tenant id is part of the login payload, since there's no
 * token yet at this point. */
export const auth = new Hono<AppEnv>();

const INVALID_CREDENTIALS = "Invalid shop id or PIN";

auth.post("/auth/login", async (c) => {
  const body = await c.req.json<{ tenantId: string; pin: string }>();
  const tenant = await tenantRepository.get(c.env.DB, body.tenantId ?? "");

  // Same error for "no such tenant" and "wrong PIN" so this endpoint doesn't reveal which
  // tenant ids exist. The PIN identifies WHICH staff member is logging in — every staff row in
  // the shop is tried until one matches (see staffRepository.findByPin).
  if (!tenant) return c.json({ detail: INVALID_CREDENTIALS }, 401);

  const staff = await staffRepository.findByPin(c.env.DB, tenant.id, body.pin ?? "");
  if (!staff) return c.json({ detail: INVALID_CREDENTIALS }, 401);

  const secret = c.env.JWT_SECRET;
  if (!secret) {
    console.error("JWT_SECRET is not configured");
    return c.json({ detail: "Server misconfiguration" }, 500);
  }

  const token = await signAuthToken(tenant.id, staff.id, staff.role, secret);
  return c.json({
    token,
    tenant: { id: tenant.id, name: tenant.name },
    staff: { id: staff.id, name: staff.name, role: staff.role },
  });
});
