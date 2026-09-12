import { VariantStatus } from "../models/enums";
import { ProductVariant } from "../models/types";

function toVariant(row: Record<string, unknown>): ProductVariant {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    productId: row.product_id as string,
    sku: row.sku as string,
    color: (row.color as string) ?? null,
    size: (row.size as string) ?? null,
    priceOverride: (row.price_override as number) ?? null,
    stockQuantity: row.stock_quantity as number,
    lowStockThreshold: row.low_stock_threshold as number,
    status: row.status as VariantStatus,
  };
}

export async function get(db: D1Database, tenantId: string, id: string): Promise<ProductVariant | null> {
  const row = await db.prepare("SELECT * FROM variants WHERE id = ? AND tenant_id = ?").bind(id, tenantId).first();
  return row ? toVariant(row) : null;
}

export async function listForProduct(db: D1Database, tenantId: string, productId: string): Promise<ProductVariant[]> {
  const { results } = await db
    .prepare("SELECT * FROM variants WHERE tenant_id = ? AND product_id = ? ORDER BY sku ASC")
    .bind(tenantId, productId)
    .all();
  return results.map(toVariant);
}

export async function listAll(db: D1Database, tenantId: string): Promise<ProductVariant[]> {
  const { results } = await db.prepare("SELECT * FROM variants WHERE tenant_id = ?").bind(tenantId).all();
  return results.map(toVariant);
}

export async function listLowStock(db: D1Database, tenantId: string): Promise<ProductVariant[]> {
  const { results } = await db
    .prepare("SELECT * FROM variants WHERE tenant_id = ? AND stock_quantity <= low_stock_threshold")
    .bind(tenantId)
    .all();
  return results.map(toVariant);
}

export async function create(
  db: D1Database,
  tenantId: string,
  productId: string,
  fields: {
    id: string;
    sku: string;
    color?: string | null;
    size?: string | null;
    priceOverride?: number | null;
    stockQuantity?: number;
    lowStockThreshold?: number;
    status?: VariantStatus;
  }
): Promise<ProductVariant> {
  await db
    .prepare(
      `INSERT INTO variants
        (id, tenant_id, product_id, sku, color, size, price_override, stock_quantity, low_stock_threshold, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      fields.id,
      tenantId,
      productId,
      fields.sku,
      fields.color ?? null,
      fields.size ?? null,
      fields.priceOverride ?? null,
      fields.stockQuantity ?? 0,
      fields.lowStockThreshold ?? 5,
      fields.status ?? VariantStatus.ACTIVE
    )
    .run();
  return (await get(db, tenantId, fields.id))!;
}

export async function update(
  db: D1Database,
  tenantId: string,
  id: string,
  fields: Partial<Pick<ProductVariant, "sku" | "color" | "size" | "priceOverride" | "lowStockThreshold" | "status">>
): Promise<ProductVariant> {
  const columnMap: Record<string, string> = {
    sku: "sku",
    color: "color",
    size: "size",
    priceOverride: "price_override",
    lowStockThreshold: "low_stock_threshold",
    status: "status",
  };
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    sets.push(`${columnMap[key]} = ?`);
    values.push(value);
  }
  if (sets.length === 0) return (await get(db, tenantId, id))!;
  values.push(id, tenantId);
  await db.prepare(`UPDATE variants SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`).bind(...values).run();
  return (await get(db, tenantId, id))!;
}

export async function setStock(db: D1Database, tenantId: string, id: string, stockQuantity: number): Promise<ProductVariant> {
  await db
    .prepare("UPDATE variants SET stock_quantity = ? WHERE id = ? AND tenant_id = ?")
    .bind(stockQuantity, id, tenantId)
    .run();
  return (await get(db, tenantId, id))!;
}

export async function remove(db: D1Database, tenantId: string, id: string): Promise<void> {
  await db.prepare("DELETE FROM variants WHERE id = ? AND tenant_id = ?").bind(id, tenantId).run();
}

/** Atomic conditional decrement — the core stock-safety primitive. Never goes negative because
 * the WHERE clause is checked by SQLite at write time, and D1 serializes writes to a database. */
export function buildDeductStatement(db: D1Database, tenantId: string, variantId: string, quantity: number) {
  return db
    .prepare("UPDATE variants SET stock_quantity = stock_quantity - ? WHERE id = ? AND tenant_id = ? AND stock_quantity >= ?")
    .bind(quantity, variantId, tenantId, quantity);
}

export function buildRestoreStatement(db: D1Database, tenantId: string, variantId: string, quantity: number) {
  return db
    .prepare("UPDATE variants SET stock_quantity = stock_quantity + ? WHERE id = ? AND tenant_id = ?")
    .bind(quantity, variantId, tenantId);
}
