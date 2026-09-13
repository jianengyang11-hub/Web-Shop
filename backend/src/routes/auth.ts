import { Hono } from "hono";
import { AppEnv } from "../core/env";
import { signAuthToken } from "../core/authToken";
import { ConflictError, ValidationError } from "../core/exceptions";
import { hashPin } from "../core/pin";
import { generateRecoveryCode } from "../core/recoveryCode";
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

/** "Forgot PIN" recovery — no shop id needed, since the recovery code itself identifies which
 * staff member (in which shop) it belongs to. Sets a new PIN and rotates the recovery code (the
 * old one stops working) so a code, once used, can't be replayed. */
auth.post("/auth/recover", async (c) => {
  const body = await c.req.json<{ recoveryCode: string; newPin: string }>();
  if (!body.newPin || body.newPin.length < 4) {
    throw new ValidationError("newPin must be at least 4 characters");
  }

  const match = await staffRepository.findByRecoveryCode(c.env.DB, body.recoveryCode ?? "");
  if (!match) return c.json({ detail: "Invalid or already-used recovery code" }, 401);

  if (await staffRepository.pinTakenInTenant(c.env.DB, match.staff.tenantId, body.newPin, match.staff.id)) {
    throw new ConflictError("PIN นี้ถูกใช้งานโดยพนักงานคนอื่นในร้านนี้แล้ว กรุณาเลือก PIN อื่น");
  }

  const { hash: pinHash, salt: pinSalt } = await hashPin(body.newPin);
  await staffRepository.updatePin(c.env.DB, match.staff.tenantId, match.staff.id, pinHash, pinSalt);

  const newRecoveryCode = generateRecoveryCode();
  const { hash: codeHash, salt: codeSalt } = await hashPin(newRecoveryCode);
  await staffRepository.setRecoveryCode(c.env.DB, match.staff.tenantId, match.staff.id, codeHash, codeSalt);

  return c.json({
    tenantId: match.staff.tenantId,
    tenantName: match.tenantName,
    staffName: match.staff.name,
    newRecoveryCode,
  });
});
