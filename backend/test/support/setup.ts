import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hashPin } from "../../src/core/pin";
import { Staff, Tenant } from "../../src/models/types";
import * as staffRepository from "../../src/repositories/staffRepository";
import * as tenantRepository from "../../src/repositories/tenantRepository";
import { createTestD1 } from "./d1";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "../../migrations");
const migrationSql = ["0001_init.sql", "0002_auth_and_settings.sql", "0003_staff.sql", "0004_recovery_code.sql"]
  .map((file) => readFileSync(join(migrationsDir, file), "utf-8"))
  .join("\n");

export async function makeTestDb(): Promise<D1Database> {
  return createTestD1(migrationSql);
}

/** Creates a tenant and, if `pin` is given, an Owner staff row for it (what real login checks
 * against). Returns the tenant; use makeTestStaff for the Owner row, or add more with
 * staffRepository.create directly for multi-staff tests. */
export async function makeTestTenant(
  db: D1Database,
  fields: Partial<{ name: string; whatsappPhoneNumberId: string; messengerPageId: string; pin: string }> = {}
): Promise<Tenant> {
  const tenant = await tenantRepository.create(db, {
    id: crypto.randomUUID(),
    name: fields.name ?? "Test Shop",
    whatsappPhoneNumberId: fields.whatsappPhoneNumberId ?? null,
    messengerPageId: fields.messengerPageId ?? null,
  });
  if (fields.pin) {
    const { hash, salt } = await hashPin(fields.pin);
    await staffRepository.create(db, {
      id: crypto.randomUUID(),
      tenantId: tenant.id,
      name: "Owner",
      pinHash: hash,
      pinSalt: salt,
      role: "OWNER",
    });
  }
  return tenant;
}

export async function makeTestStaff(
  db: D1Database,
  tenantId: string,
  fields: Partial<{ name: string; pin: string; role: "OWNER" | "STAFF" }> = {}
): Promise<Staff> {
  const { hash, salt } = await hashPin(fields.pin ?? "0000");
  return staffRepository.create(db, {
    id: crypto.randomUUID(),
    tenantId,
    name: fields.name ?? "Staff",
    pinHash: hash,
    pinSalt: salt,
    role: fields.role ?? "STAFF",
  });
}
