import { Staff, StaffRole } from "../models/types";
import { verifyPin } from "../core/pin";

function toStaff(row: Record<string, unknown>): Staff {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    name: row.name as string,
    pinHash: row.pin_hash as string,
    pinSalt: row.pin_salt as string,
    role: row.role as StaffRole,
    createdAt: row.created_at as string,
  };
}

export async function get(db: D1Database, tenantId: string, id: string): Promise<Staff | null> {
  const row = await db
    .prepare("SELECT * FROM staff WHERE id = ? AND tenant_id = ?")
    .bind(id, tenantId)
    .first();
  return row ? toStaff(row) : null;
}

export async function listByTenant(db: D1Database, tenantId: string): Promise<Staff[]> {
  const { results } = await db
    .prepare("SELECT * FROM staff WHERE tenant_id = ? ORDER BY created_at ASC")
    .bind(tenantId)
    .all();
  return results.map(toStaff);
}

/** Tries a login PIN against every staff row in the tenant (each has its own salt, so there's no
 * way to look one up by PIN directly). Small per-tenant staff counts keep this cheap. */
export async function findByPin(db: D1Database, tenantId: string, pin: string): Promise<Staff | null> {
  const staffList = await listByTenant(db, tenantId);
  for (const staff of staffList) {
    if (await verifyPin(pin, staff.pinSalt, staff.pinHash)) return staff;
  }
  return null;
}

/** True if some OTHER staff member in the tenant already uses this PIN — two staff sharing a PIN
 * would make findByPin ambiguous, so this is checked before create/reset. */
export async function pinTakenInTenant(
  db: D1Database,
  tenantId: string,
  pin: string,
  excludeStaffId?: string
): Promise<boolean> {
  const staffList = await listByTenant(db, tenantId);
  for (const staff of staffList) {
    if (staff.id === excludeStaffId) continue;
    if (await verifyPin(pin, staff.pinSalt, staff.pinHash)) return true;
  }
  return false;
}

export async function create(
  db: D1Database,
  fields: { id: string; tenantId: string; name: string; pinHash: string; pinSalt: string; role: StaffRole }
): Promise<Staff> {
  await db
    .prepare(
      `INSERT INTO staff (id, tenant_id, name, pin_hash, pin_salt, role) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(fields.id, fields.tenantId, fields.name, fields.pinHash, fields.pinSalt, fields.role)
    .run();
  return (await get(db, fields.tenantId, fields.id))!;
}

export async function updatePin(db: D1Database, tenantId: string, staffId: string, pinHash: string, pinSalt: string): Promise<void> {
  await db
    .prepare("UPDATE staff SET pin_hash = ?, pin_salt = ? WHERE id = ? AND tenant_id = ?")
    .bind(pinHash, pinSalt, staffId, tenantId)
    .run();
}

export async function countOwners(db: D1Database, tenantId: string): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM staff WHERE tenant_id = ? AND role = 'OWNER'")
    .bind(tenantId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function remove(db: D1Database, tenantId: string, staffId: string): Promise<void> {
  await db.prepare("DELETE FROM staff WHERE id = ? AND tenant_id = ?").bind(staffId, tenantId).run();
}
