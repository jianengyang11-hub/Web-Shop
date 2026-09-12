import { NotFoundError } from "../core/exceptions";
import { ProductStatus, VariantStatus } from "../models/enums";
import { Product, ProductVariant } from "../models/types";
import * as productRepository from "../repositories/productRepository";
import * as variantRepository from "../repositories/variantRepository";

export async function listProducts(db: D1Database, tenantId: string): Promise<Product[]> {
  return productRepository.listAll(db, tenantId);
}

export async function getProduct(db: D1Database, tenantId: string, id: string): Promise<Product> {
  const product = await productRepository.get(db, tenantId, id);
  if (!product) throw new NotFoundError(`Product ${id} not found`);
  return product;
}

export async function createProduct(
  db: D1Database,
  tenantId: string,
  fields: { name: string; description?: string | null; price: number; image?: string | null; status?: ProductStatus }
): Promise<Product> {
  return productRepository.create(db, tenantId, { id: crypto.randomUUID(), ...fields });
}

export async function updateProduct(
  db: D1Database,
  tenantId: string,
  id: string,
  fields: Partial<Pick<Product, "name" | "description" | "price" | "image" | "status">>
): Promise<Product> {
  await getProduct(db, tenantId, id);
  return productRepository.update(db, tenantId, id, fields);
}

export async function deleteProduct(db: D1Database, tenantId: string, id: string): Promise<void> {
  await getProduct(db, tenantId, id);
  await productRepository.remove(db, tenantId, id);
}

export async function listVariants(db: D1Database, tenantId: string, productId: string): Promise<ProductVariant[]> {
  await getProduct(db, tenantId, productId);
  return variantRepository.listForProduct(db, tenantId, productId);
}

export async function getVariant(db: D1Database, tenantId: string, variantId: string): Promise<ProductVariant> {
  const variant = await variantRepository.get(db, tenantId, variantId);
  if (!variant) throw new NotFoundError(`Variant ${variantId} not found`);
  return variant;
}

export async function createVariant(
  db: D1Database,
  tenantId: string,
  productId: string,
  fields: {
    sku: string;
    color?: string | null;
    size?: string | null;
    priceOverride?: number | null;
    stockQuantity?: number;
    lowStockThreshold?: number;
    status?: VariantStatus;
  }
): Promise<ProductVariant> {
  await getProduct(db, tenantId, productId);
  return variantRepository.create(db, tenantId, productId, { id: crypto.randomUUID(), ...fields });
}

export async function updateVariant(
  db: D1Database,
  tenantId: string,
  variantId: string,
  fields: Partial<Pick<ProductVariant, "sku" | "color" | "size" | "priceOverride" | "lowStockThreshold" | "status">>
): Promise<ProductVariant> {
  await getVariant(db, tenantId, variantId);
  return variantRepository.update(db, tenantId, variantId, fields);
}

export async function deleteVariant(db: D1Database, tenantId: string, variantId: string): Promise<void> {
  await getVariant(db, tenantId, variantId);
  await variantRepository.remove(db, tenantId, variantId);
}

/** Direct stock correction by the Owner (stocktake/restock) — distinct from order confirmation
 * deduction, which goes through orderService.confirmOrder's claim-first D1 batch. */
export async function setStock(db: D1Database, tenantId: string, variantId: string, stockQuantity: number): Promise<ProductVariant> {
  await getVariant(db, tenantId, variantId);
  return variantRepository.setStock(db, tenantId, variantId, stockQuantity);
}

export async function listAllStock(db: D1Database, tenantId: string): Promise<ProductVariant[]> {
  return variantRepository.listAll(db, tenantId);
}

export async function listLowStock(db: D1Database, tenantId: string): Promise<ProductVariant[]> {
  return variantRepository.listLowStock(db, tenantId);
}
