import { OrderChannel, OrderStatus } from "../models/enums";
import { Order, OrderItem } from "../models/types";

function toOrderRow(row: Record<string, unknown>): Omit<Order, "items"> {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    orderNumber: row.order_number as string,
    customerId: (row.customer_id as string) ?? null,
    status: row.status as OrderStatus,
    channel: row.channel as OrderChannel,
    subtotal: row.subtotal as number,
    discount: row.discount as number,
    shippingFee: row.shipping_fee as number,
    total: row.total as number,
    note: (row.note as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    confirmedAt: (row.confirmed_at as string) ?? null,
    cancelledAt: (row.cancelled_at as string) ?? null,
    lastActorStaffId: (row.last_actor_staff_id as string) ?? null,
    lastActorName: (row.last_actor_name as string) ?? null,
  };
}

function toOrderItem(row: Record<string, unknown>): OrderItem {
  return {
    id: row.id as string,
    orderId: row.order_id as string,
    productId: row.product_id as string,
    variantId: row.variant_id as string,
    productNameSnapshot: row.product_name_snapshot as string,
    variantSnapshot: JSON.parse(row.variant_snapshot as string),
    unitPrice: row.unit_price as number,
    quantity: row.quantity as number,
    subtotal: row.subtotal as number,
  };
}

export function generateOrderNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = crypto.randomUUID().slice(0, 6).toUpperCase();
  return `ORD-${date}-${rand}`;
}

async function loadItems(db: D1Database, tenantId: string, orderId: string): Promise<OrderItem[]> {
  const { results } = await db
    .prepare("SELECT * FROM order_items WHERE order_id = ? AND tenant_id = ?")
    .bind(orderId, tenantId)
    .all();
  return results.map(toOrderItem);
}

export async function get(db: D1Database, tenantId: string, id: string): Promise<Order | null> {
  const row = await db.prepare("SELECT * FROM orders WHERE id = ? AND tenant_id = ?").bind(id, tenantId).first();
  if (!row) return null;
  const items = await loadItems(db, tenantId, id);
  return { ...toOrderRow(row), items };
}

export async function listAll(db: D1Database, tenantId: string): Promise<Order[]> {
  const { results } = await db
    .prepare("SELECT * FROM orders WHERE tenant_id = ? ORDER BY created_at DESC")
    .bind(tenantId)
    .all();
  const orders: Order[] = [];
  for (const row of results) {
    const base = toOrderRow(row);
    orders.push({ ...base, items: await loadItems(db, tenantId, base.id) });
  }
  return orders;
}

export async function create(
  db: D1Database,
  tenantId: string,
  fields: {
    id: string;
    customerId: string | null;
    channel: OrderChannel;
    discount: number;
    shippingFee: number;
    note: string | null;
    subtotal: number;
    total: number;
    items: Array<Omit<OrderItem, "id" | "orderId">>;
  }
): Promise<Order> {
  const now = new Date().toISOString();
  const orderNumber = generateOrderNumber();

  await db
    .prepare(
      `INSERT INTO orders
        (id, tenant_id, order_number, customer_id, status, channel, subtotal, discount, shipping_fee, total, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      fields.id,
      tenantId,
      orderNumber,
      fields.customerId,
      OrderStatus.PENDING_CONFIRMATION,
      fields.channel,
      fields.subtotal,
      fields.discount,
      fields.shippingFee,
      fields.total,
      fields.note,
      now,
      now
    )
    .run();

  const itemStatements = fields.items.map((item) =>
    db
      .prepare(
        `INSERT INTO order_items
          (id, order_id, tenant_id, product_id, variant_id, product_name_snapshot, variant_snapshot, unit_price, quantity, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        fields.id,
        tenantId,
        item.productId,
        item.variantId,
        item.productNameSnapshot,
        JSON.stringify(item.variantSnapshot),
        item.unitPrice,
        item.quantity,
        item.subtotal
      )
  );
  if (itemStatements.length > 0) await db.batch(itemStatements);

  return (await get(db, tenantId, fields.id))!;
}

/** Atomically moves an order from `from` to `to` only if it is currently `from`. Returns true on
 * success. This is what makes a double-confirm (or any duplicate transition call) safe: the
 * loser's UPDATE matches zero rows instead of racing on a read-then-write. */
export async function claimStatus(
  db: D1Database,
  tenantId: string,
  orderId: string,
  from: OrderStatus,
  to: OrderStatus,
  extra: { confirmedAt?: string; cancelledAt?: string; actor?: { staffId: string; name: string } } = {}
): Promise<boolean> {
  const now = new Date().toISOString();
  const sets = ["status = ?", "updated_at = ?"];
  const values: unknown[] = [to, now];
  if (extra.confirmedAt !== undefined) {
    sets.push("confirmed_at = ?");
    values.push(extra.confirmedAt);
  }
  if (extra.cancelledAt !== undefined) {
    sets.push("cancelled_at = ?");
    values.push(extra.cancelledAt);
  }
  if (extra.actor !== undefined) {
    sets.push("last_actor_staff_id = ?", "last_actor_name = ?");
    values.push(extra.actor.staffId, extra.actor.name);
  }
  values.push(orderId, tenantId, from);

  const result = await db
    .prepare(`UPDATE orders SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ? AND status = ?`)
    .bind(...values)
    .run();
  return (result.meta.changes ?? 0) === 1;
}

export function buildRevertToPendingStatement(db: D1Database, tenantId: string, orderId: string) {
  return db
    .prepare("UPDATE orders SET status = ?, confirmed_at = NULL, updated_at = ? WHERE id = ? AND tenant_id = ?")
    .bind(OrderStatus.PENDING_CONFIRMATION, new Date().toISOString(), orderId, tenantId);
}
