/**
 * The only surface the AI (or the WhatsApp webhook, later) is allowed to touch.
 *
 * Per the Stock Business Rule, the AI may read products/stock and create orders, but an order
 * it creates can only ever land in PENDING_CONFIRMATION — it must never be able to confirm/reject
 * an order or change stock/price. This module intentionally does not import or expose
 * confirmOrder, rejectOrder, advanceStatus, setStock, or any product/variant mutation function,
 * so there is no code path from here into them. A test asserts this module's public surface
 * stays confirm/reject/stock-mutation free.
 */
import { OrderChannel } from "../models/enums";
import { Order, Product, ProductVariant } from "../models/types";
import * as productRepository from "../repositories/productRepository";
import * as variantRepository from "../repositories/variantRepository";
import { createOrder, OrderCreateInput } from "./orderService";

export async function listProducts(db: D1Database, tenantId: string): Promise<Product[]> {
  return productRepository.listAll(db, tenantId);
}

export async function getVariantStock(db: D1Database, tenantId: string, variantId: string): Promise<ProductVariant | null> {
  return variantRepository.get(db, tenantId, variantId);
}

/** Suggests in-stock variants for a product, for the AI to offer to the customer. */
export async function recommendVariants(db: D1Database, tenantId: string, productId: string): Promise<ProductVariant[]> {
  const variants = await variantRepository.listForProduct(db, tenantId, productId);
  return variants.filter((v) => v.stockQuantity > 0);
}

/** Creates an order on behalf of the AI. Delegates to the shared orderService so the same
 * validation/snapshot/state-machine logic applies — the order always starts at
 * PENDING_CONFIRMATION and never touches stock. */
export async function aiCreateOrder(db: D1Database, tenantId: string, payload: OrderCreateInput): Promise<Order> {
  return createOrder(db, tenantId, payload, OrderChannel.AI);
}
