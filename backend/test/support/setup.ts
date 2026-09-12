import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Tenant } from "../../src/models/types";
import * as tenantRepository from "../../src/repositories/tenantRepository";
import { createTestD1 } from "./d1";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationSql = readFileSync(join(__dirname, "../../migrations/0001_init.sql"), "utf-8");

export async function makeTestDb(): Promise<D1Database> {
  return createTestD1(migrationSql);
}

export async function makeTestTenant(db: D1Database, fields: Partial<{ name: string; whatsappPhoneNumberId: string }> = {}): Promise<Tenant> {
  return tenantRepository.create(db, {
    id: crypto.randomUUID(),
    name: fields.name ?? "Test Shop",
    whatsappPhoneNumberId: fields.whatsappPhoneNumberId ?? null,
  });
}
