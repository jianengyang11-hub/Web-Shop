import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hashPin } from "../../src/core/pin";
import { Tenant } from "../../src/models/types";
import * as tenantRepository from "../../src/repositories/tenantRepository";
import { createTestD1 } from "./d1";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "../../migrations");
const migrationSql = ["0001_init.sql", "0002_auth_and_settings.sql"]
  .map((file) => readFileSync(join(migrationsDir, file), "utf-8"))
  .join("\n");

export async function makeTestDb(): Promise<D1Database> {
  return createTestD1(migrationSql);
}

export async function makeTestTenant(
  db: D1Database,
  fields: Partial<{ name: string; whatsappPhoneNumberId: string; messengerPageId: string; pin: string }> = {}
): Promise<Tenant> {
  const pinFields = fields.pin ? await hashPin(fields.pin) : undefined;
  return tenantRepository.create(db, {
    id: crypto.randomUUID(),
    name: fields.name ?? "Test Shop",
    whatsappPhoneNumberId: fields.whatsappPhoneNumberId ?? null,
    messengerPageId: fields.messengerPageId ?? null,
    pinHash: pinFields?.hash ?? null,
    pinSalt: pinFields?.salt ?? null,
  });
}
