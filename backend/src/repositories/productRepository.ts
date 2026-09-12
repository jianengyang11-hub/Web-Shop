import { ProductStatus } from "../models/enums";
import { Product } from "../models/types";

function toProduct(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    price: row.price as number,
    image: (row.image as string) ?? null,
    status: row.status as ProductStatus,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function get(db: D1Database, tenantId: string, id: string): Promise<Product | null> {
  const row = await db.prepare("SELECT * FROM products WHERE id = ? AND tenant_id = ?").bind(id, tenantId).first();
  return row ? toProduct(row) : null;
}

export async function listAll(db: D1Database, tenantId: string): Promise<Product[]> {
  const { results } = await db
    .prepare("SELECT * FROM products WHERE tenant_id = ? ORDER BY created_at ASC")
    .bind(tenantId)
    .all();
  return results.map(toProduct);
}

export async function create(
  db: D1Database,
  tenantId: string,
  fields: { id: string; name: string; description?: string | null; price: number; image?: string | null; status?: ProductStatus }
): Promise<Product> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO products (id, tenant_id, name, description, price, image, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      fields.id,
      tenantId,
      fields.name,
      fields.description ?? null,
      fields.price,
      fields.image ?? null,
      fields.status ?? ProductStatus.ACTIVE,
      now,
      now
    )
    .run();
  return (await get(db, tenantId, fields.id))!;
}

export async function update(
  db: D1Database,
  tenantId: string,
  id: string,
  fields: Partial<Pick<Product, "name" | "description" | "price" | "image" | "status">>
): Promise<Product> {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    sets.push(`${key} = ?`);
    values.push(value);
  }
  sets.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(id, tenantId);

  await db.prepare(`UPDATE products SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`).bind(...values).run();
  return (await get(db, tenantId, id))!;
}

export async function remove(db: D1Database, tenantId: string, id: string): Promise<void> {
  await db.prepare("DELETE FROM products WHERE id = ? AND tenant_id = ?").bind(id, tenantId).run();
}
