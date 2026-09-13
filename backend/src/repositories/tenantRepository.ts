import { Tenant } from "../models/types";

function toTenant(row: Record<string, unknown>): Tenant {
  return {
    id: row.id as string,
    name: row.name as string,
    whatsappPhoneNumberId: (row.whatsapp_phone_number_id as string) ?? null,
    whatsappAccessToken: (row.whatsapp_access_token as string) ?? null,
    messengerPageId: (row.messenger_page_id as string) ?? null,
    messengerAccessToken: (row.messenger_access_token as string) ?? null,
    pinHash: (row.pin_hash as string) ?? null,
    pinSalt: (row.pin_salt as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function get(db: D1Database, id: string): Promise<Tenant | null> {
  const row = await db.prepare("SELECT * FROM tenants WHERE id = ?").bind(id).first();
  return row ? toTenant(row) : null;
}

export async function findByWhatsappPhoneNumberId(db: D1Database, phoneNumberId: string): Promise<Tenant | null> {
  const row = await db
    .prepare("SELECT * FROM tenants WHERE whatsapp_phone_number_id = ?")
    .bind(phoneNumberId)
    .first();
  return row ? toTenant(row) : null;
}

export async function findByMessengerPageId(db: D1Database, pageId: string): Promise<Tenant | null> {
  const row = await db.prepare("SELECT * FROM tenants WHERE messenger_page_id = ?").bind(pageId).first();
  return row ? toTenant(row) : null;
}

export async function create(
  db: D1Database,
  fields: {
    id: string;
    name: string;
    whatsappPhoneNumberId?: string | null;
    whatsappAccessToken?: string | null;
    messengerPageId?: string | null;
    messengerAccessToken?: string | null;
    pinHash?: string | null;
    pinSalt?: string | null;
  }
): Promise<Tenant> {
  await db
    .prepare(
      `INSERT INTO tenants
        (id, name, whatsapp_phone_number_id, whatsapp_access_token, messenger_page_id, messenger_access_token, pin_hash, pin_salt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      fields.id,
      fields.name,
      fields.whatsappPhoneNumberId ?? null,
      fields.whatsappAccessToken ?? null,
      fields.messengerPageId ?? null,
      fields.messengerAccessToken ?? null,
      fields.pinHash ?? null,
      fields.pinSalt ?? null
    )
    .run();
  return (await get(db, fields.id))!;
}

const INTEGRATION_COLUMNS: Record<string, string> = {
  whatsappPhoneNumberId: "whatsapp_phone_number_id",
  whatsappAccessToken: "whatsapp_access_token",
  messengerPageId: "messenger_page_id",
  messengerAccessToken: "messenger_access_token",
};

export async function updateIntegrations(
  db: D1Database,
  tenantId: string,
  fields: Partial<
    Pick<Tenant, "whatsappPhoneNumberId" | "whatsappAccessToken" | "messengerPageId" | "messengerAccessToken">
  >
): Promise<Tenant> {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    sets.push(`${INTEGRATION_COLUMNS[key]} = ?`);
    values.push(value);
  }
  if (sets.length > 0) {
    values.push(tenantId);
    await db.prepare(`UPDATE tenants SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
  }
  return (await get(db, tenantId))!;
}
