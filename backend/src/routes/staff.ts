import { Hono } from "hono";
import { AppEnv } from "../core/env";
import { requireOwner } from "../middleware/auth";
import { ConflictError, NotFoundError, ValidationError } from "../core/exceptions";
import { hashPin } from "../core/pin";
import { generateRecoveryCode } from "../core/recoveryCode";
import { Staff } from "../models/types";
import * as staffRepository from "../repositories/staffRepository";

/** Owner-only staff management: add/remove staff for the current shop and reset their PINs.
 * Mounted under /api/:tenantId, behind authMiddleware + tenantMiddleware + requireOwner. */
export const staff = new Hono<AppEnv>();

staff.use("*", requireOwner);

function toPublicStaff(member: Staff) {
  return { id: member.id, name: member.name, role: member.role, createdAt: member.createdAt };
}

staff.get("/staff", async (c) => {
  const tenant = c.get("tenant");
  const list = await staffRepository.listByTenant(c.env.DB, tenant.id);
  return c.json(list.map(toPublicStaff));
});

staff.post("/staff", async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json<{ name: string; pin: string }>();
  if (!body.name || !body.name.trim()) {
    throw new ValidationError("name is required");
  }
  if (!body.pin || body.pin.length < 4) {
    throw new ValidationError("pin must be at least 4 characters");
  }
  if (await staffRepository.pinTakenInTenant(c.env.DB, tenant.id, body.pin)) {
    throw new ConflictError("PIN นี้ถูกใช้งานโดยพนักงานคนอื่นในร้านนี้แล้ว กรุณาเลือก PIN อื่น");
  }

  const { hash, salt } = await hashPin(body.pin);
  const created = await staffRepository.create(c.env.DB, {
    id: crypto.randomUUID(),
    tenantId: tenant.id,
    name: body.name.trim(),
    pinHash: hash,
    pinSalt: salt,
    role: "STAFF",
  });

  // Shown once here, for the Owner to pass along to the new staff member — same as the recovery
  // code generated at shop creation.
  const recoveryCode = generateRecoveryCode();
  const { hash: codeHash, salt: codeSalt } = await hashPin(recoveryCode);
  await staffRepository.setRecoveryCode(c.env.DB, tenant.id, created.id, codeHash, codeSalt);

  return c.json({ ...toPublicStaff(created), recoveryCode }, 201);
});

staff.put("/staff/:staffId/pin", async (c) => {
  const tenant = c.get("tenant");
  const staffId = c.req.param("staffId");
  const target = await staffRepository.get(c.env.DB, tenant.id, staffId);
  if (!target) throw new NotFoundError(`Staff ${staffId} not found`);

  const body = await c.req.json<{ pin: string }>();
  if (!body.pin || body.pin.length < 4) {
    throw new ValidationError("pin must be at least 4 characters");
  }
  if (await staffRepository.pinTakenInTenant(c.env.DB, tenant.id, body.pin, staffId)) {
    throw new ConflictError("PIN นี้ถูกใช้งานโดยพนักงานคนอื่นในร้านนี้แล้ว กรุณาเลือก PIN อื่น");
  }

  const { hash, salt } = await hashPin(body.pin);
  await staffRepository.updatePin(c.env.DB, tenant.id, staffId, hash, salt);
  return c.json({ ok: true });
});

staff.delete("/staff/:staffId", async (c) => {
  const tenant = c.get("tenant");
  const staffId = c.req.param("staffId");
  const target = await staffRepository.get(c.env.DB, tenant.id, staffId);
  if (!target) throw new NotFoundError(`Staff ${staffId} not found`);

  if (target.role === "OWNER" && (await staffRepository.countOwners(c.env.DB, tenant.id)) <= 1) {
    throw new ValidationError("Cannot remove the shop's last Owner");
  }
  if (staffId === c.get("authStaffId")) {
    throw new ValidationError("You cannot remove your own staff account while logged in as it");
  }

  await staffRepository.remove(c.env.DB, tenant.id, staffId);
  return c.json({ ok: true });
});
