import { Hono } from "hono";
import { AppEnv } from "../core/env";
import { hashPin } from "../core/pin";
import { generateRecoveryCode } from "../core/recoveryCode";
import * as staffRepository from "../repositories/staffRepository";

/** Self-service actions on the CALLER's own staff account — mounted under /api/:tenantId behind
 * authMiddleware + tenantMiddleware only (deliberately not requireOwner: every staff member,
 * not just the Owner, may back up their own PIN). */
export const staffSelf = new Hono<AppEnv>();

/** Generates (and overwrites) the caller's own recovery code. Returned in plaintext exactly
 * once — only its hash is ever stored, so this is the one chance to see/save it. */
staffSelf.post("/staff/me/recovery-code", async (c) => {
  const tenant = c.get("tenant");
  const staffId = c.get("authStaffId");

  const code = generateRecoveryCode();
  const { hash, salt } = await hashPin(code);
  await staffRepository.setRecoveryCode(c.env.DB, tenant.id, staffId, hash, salt);

  return c.json({ recoveryCode: code });
});
