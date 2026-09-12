import { Tenant } from "../models/types";

function toTenant(row: Record<string, unknown>): Tenant {
  return {
    id: row.id as string,
    name: row.name as string,
    whatsappPhoneNumberId: (row.whatsapp_phone_number_id as string) ?? null,
    whatsappAccessToken: (row.whatsapp_access_token as string) ?? null,
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

export async function create(
  db: D1Database,
  fields: { id: string; name: string; whatsappPhoneNumberId?: string | null; whatsappAccessToken?: string | null }
): Promise<Tenant> {
  await db
    .prepare(
      "INSERT INTO tenants (id, name, whatsapp_phone_number_id, whatsapp_access_token) VALUES (?, ?, ?, ?)"
    )
    .bind(fields.id, fields.name, fields.whatsappPhoneNumberId ?? null, fields.whatsappAccessToken ?? null)
    .run();
  return (await get(db, fields.id))!;
}
