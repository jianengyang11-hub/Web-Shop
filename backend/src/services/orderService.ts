import { InsufficientStockError, InvalidTransitionError, NotFoundError } from "../core/exceptions";
import { OrderChannel, OrderStatus } from "../models/enums";
import { Order, OrderItem } from "../models/types";
import { mockNotificationService } from "../notifications/mockAdapter";
import * as customerRepository from "../repositories/customerRepository";
import * as orderRepository from "../repositories/orderRepository";
import * as productRepository from "../repositories/productRepository";
import * as variantRepository from "../repositories/variantRepository";
import { validateTransition } from "../stateMachine/orderStateMachine";

export interface CustomerInput {
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
  channel?: string;
  channelUserId?: string;
}

export interface OrderItemInput {
  productId: string;
  variantId: string;
  quantity: number;
}

export interface OrderCreateInput {
  customer?: CustomerInput;
  items: OrderItemInput[];
  discount?: number;
  shippingFee?: number;
  note?: string;
  channel?: OrderChannel;
}

export interface OrderActor {
  staffId: string;
  name: string;
}

async function resolveCustomerId(db: D1Database, tenantId: string, input?: CustomerInput): Promise<string | null> {
  if (!input) return null;
  if (input.id) {
    const customer = await customerRepository.get(db, tenantId, input.id);
    if (!customer) throw new NotFoundError(`Customer ${input.id} not found`);
    return customer.id;
  }
  if (input.channel && input.channelUserId) {
    const existing = await customerRepository.findByChannel(db, tenantId, input.channel, input.channelUserId);
    if (existing) return existing.id;
  }
  if (input.name) {
    const created = await customerRepository.create(db, tenantId, {
      id: crypto.randomUUID(),
      name: input.name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      channel: input.channel ?? null,
      channelUserId: input.channelUserId ?? null,
    });
    return created.id;
  }
  return null;
}

/** Creates an order and immediately submits it for owner review (PENDING_CONFIRMATION).
 * Never touches stock — deduction only ever happens inside confirmOrder(). */
export async function createOrder(
  db: D1Database,
  tenantId: string,
  payload: OrderCreateInput,
  channel: OrderChannel = OrderChannel.MANUAL
): Promise<Order> {
  validateTransition(OrderStatus.NEW, OrderStatus.PENDING_CONFIRMATION);

  const customerId = await resolveCustomerId(db, tenantId, payload.customer);

  const items: Array<Omit<OrderItem, "id" | "orderId">> = [];
  let subtotal = 0;
  for (const itemInput of payload.items) {
    const variant = await variantRepository.get(db, tenantId, itemInput.variantId);
    if (!variant || variant.productId !== itemInput.productId) {
      throw new NotFoundError(`Variant ${itemInput.variantId} not found for product ${itemInput.productId}`);
    }
    const product = await productRepository.get(db, tenantId, itemInput.productId);
    if (!product) throw new NotFoundError(`Product ${itemInput.productId} not found`);

    const unitPrice = variant.priceOverride ?? product.price;
    const itemSubtotal = unitPrice * itemInput.quantity;
    subtotal += itemSubtotal;

    items.push({
      productId: product.id,
      variantId: variant.id,
      productNameSnapshot: product.name,
      variantSnapshot: { sku: variant.sku, color: variant.color, size: variant.size },
      unitPrice,
      quantity: itemInput.quantity,
      subtotal: itemSubtotal,
    });
  }

  const discount = payload.discount ?? 0;
  const shippingFee = payload.shippingFee ?? 0;
  const total = subtotal - discount + shippingFee;

  return orderRepository.create(db, tenantId, {
    id: crypto.randomUUID(),
    customerId,
    channel: payload.channel ?? channel,
    discount,
    shippingFee,
    note: payload.note ?? null,
    subtotal,
    total,
    items,
  });
}

export async function getOrder(db: D1Database, tenantId: string, id: string): Promise<Order> {
  const order = await orderRepository.get(db, tenantId, id);
  if (!order) throw new NotFoundError(`Order ${id} not found`);
  return order;
}

export async function listOrders(db: D1Database, tenantId: string): Promise<Order[]> {
  return orderRepository.listAll(db, tenantId);
}

/** The only place stock is ever deducted, and only when the Owner confirms.
 *
 * D1 has no interactive multi-round-trip transaction, so safety comes from two atomic
 * conditional UPDATEs instead of a lock:
 *   1. "Claim" the order first: UPDATE ... WHERE status='PENDING_CONFIRMATION'. If this affects
 *      zero rows, someone already confirmed/rejected it — bail out before touching stock. This
 *      is what makes a double-confirm (or a race on the *same* order) safe.
 *   2. Deduct every item's stock via one UPDATE ... WHERE stock_quantity >= ? each, run together
 *      in a single db.batch() (D1 wraps a batch in one transaction). A statement that matches
 *      zero rows doesn't throw, so every result's `meta.changes` is checked explicitly.
 * If any item lacked stock, everything is compensated in one more batch (stock added back,
 * order reverted to PENDING_CONFIRMATION) so the net effect is "nothing happened" — no partial
 * deduction, order stays PENDING_CONFIRMATION, exactly as required.
 */
export async function confirmOrder(db: D1Database, tenantId: string, orderId: string, actor?: OrderActor): Promise<Order> {
  const order = await getOrder(db, tenantId, orderId);
  validateTransition(order.status, OrderStatus.CONFIRMED);

  const now = new Date().toISOString();
  const claimed = await orderRepository.claimStatus(db, tenantId, orderId, OrderStatus.PENDING_CONFIRMATION, OrderStatus.CONFIRMED, {
    confirmedAt: now,
    actor,
  });
  if (!claimed) {
    throw new InvalidTransitionError(`Order ${orderId} is no longer PENDING_CONFIRMATION (already handled)`);
  }

  if (order.items.length > 0) {
    const deductStatements = order.items.map((item) =>
      variantRepository.buildDeductStatement(db, tenantId, item.variantId, item.quantity)
    );
    const results = await db.batch(deductStatements);
    const allOk = results.every((r) => (r.meta.changes ?? 0) === 1);

    if (!allOk) {
      const compensations = order.items
        .map((item, i) => ((results[i].meta.changes ?? 0) === 1 ? variantRepository.buildRestoreStatement(db, tenantId, item.variantId, item.quantity) : null))
        .filter((stmt): stmt is D1PreparedStatement => stmt !== null);
      compensations.push(orderRepository.buildRevertToPendingStatement(db, tenantId, orderId));
      await db.batch(compensations);
      throw new InsufficientStockError(`Insufficient stock to confirm order ${orderId}`);
    }
  }

  const confirmed = await getOrder(db, tenantId, orderId);
  await mockNotificationService.notify(db, tenantId, {
    type: "ORDER_CONFIRMED",
    orderId: confirmed.id,
    orderNumber: confirmed.orderNumber,
    message: `Order ${confirmed.orderNumber} confirmed`,
  });
  return confirmed;
}

export async function rejectOrder(db: D1Database, tenantId: string, orderId: string, actor?: OrderActor): Promise<Order> {
  const order = await getOrder(db, tenantId, orderId);
  validateTransition(order.status, OrderStatus.REJECTED);

  const claimed = await orderRepository.claimStatus(db, tenantId, orderId, order.status, OrderStatus.REJECTED, { actor });
  if (!claimed) throw new InvalidTransitionError(`Order ${orderId} is no longer ${order.status}`);

  const updated = await getOrder(db, tenantId, orderId);
  await mockNotificationService.notify(db, tenantId, {
    type: "ORDER_REJECTED",
    orderId: updated.id,
    orderNumber: updated.orderNumber,
    message: `Order ${updated.orderNumber} rejected`,
  });
  return updated;
}

/** Handles the non-stock-affecting transitions: preparing, shipped, delivered, cancelled. */
export async function advanceStatus(
  db: D1Database,
  tenantId: string,
  orderId: string,
  target: OrderStatus,
  actor?: OrderActor
): Promise<Order> {
  const order = await getOrder(db, tenantId, orderId);
  validateTransition(order.status, target);

  const extra = target === OrderStatus.CANCELLED ? { cancelledAt: new Date().toISOString(), actor } : { actor };
  const claimed = await orderRepository.claimStatus(db, tenantId, orderId, order.status, target, extra);
  if (!claimed) throw new InvalidTransitionError(`Order ${orderId} is no longer ${order.status}`);

  const updated = await getOrder(db, tenantId, orderId);
  await mockNotificationService.notify(db, tenantId, {
    type: `ORDER_${target}`,
    orderId: updated.id,
    orderNumber: updated.orderNumber,
    message: `Order ${updated.orderNumber} is now ${target}`,
  });
  return updated;
}
