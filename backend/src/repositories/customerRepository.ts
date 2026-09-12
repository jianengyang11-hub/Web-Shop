import { Customer } from "../models/types";

function toCustomer(row: Record<string, unknown>): Customer {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    name: row.name as string,
    phone: (row.phone as string) ?? null,
    email: (row.email as string) ?? null,
    channel: (row.channel as string) ?? null,
    channelUserId: (row.channel_user_id as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function get(db: D1Database, tenantId: string, id: string): Promise<Customer | null> {
  const row = await db.prepare("SELECT * FROM customers WHERE id = ? AND tenant_id = ?").bind(id, tenantId).first();
  return row ? toCustomer(row) : null;
}

export async function listAll(db: D1Database, tenantId: string): Promise<Customer[]> {
  const { results } = await db
    .prepare("SELECT * FROM customers WHERE tenant_id = ? ORDER BY created_at ASC")
    .bind(tenantId)
    .all();
  return results.map(toCustomer);
}

export async function findByChannel(db: D1Database, tenantId: string, channel: string, channelUserId: string): Promise<Customer | null> {
  const row = await db
    .prepare("SELECT * FROM customers WHERE tenant_id = ? AND channel = ? AND channel_user_id = ?")
    .bind(tenantId, channel, channelUserId)
    .first();
  return row ? toCustomer(row) : null;
}

export async function create(
  db: D1Database,
  tenantId: string,
  fields: { id: string; name: string; phone?: string | null; email?: string | null; channel?: string | null; channelUserId?: string | null }
): Promise<Customer> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO customers (id, tenant_id, name, phone, email, channel, channel_user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      fields.id,
      tenantId,
      fields.name,
      fields.phone ?? null,
      fields.email ?? null,
      fields.channel ?? null,
      fields.channelUserId ?? null,
      now,
      now
    )
    .run();
  return (await get(db, tenantId, fields.id))!;
}

/** Finds a customer by (channel, channelUserId) or creates one — used by the WhatsApp webhook
 * so repeated messages from the same number map to one customer record. */
export async function findOrCreateByChannel(
  db: D1Database,
  tenantId: string,
  fields: { id: string; name: string; channel: string; channelUserId: string; phone?: string | null }
): Promise<Customer> {
  const existing = await findByChannel(db, tenantId, fields.channel, fields.channelUserId);
  if (existing) return existing;
  return create(db, tenantId, fields);
}
