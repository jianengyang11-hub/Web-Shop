import { OrderChannel, OrderStatus, ProductStatus, VariantStatus } from "./enums";

export interface Tenant {
  id: string;
  name: string;
  whatsappPhoneNumberId: string | null;
  whatsappAccessToken: string | null;
  messengerPageId: string | null;
  messengerAccessToken: string | null;
  pinHash: string | null;
  pinSalt: string | null;
  createdAt: string;
}

export type StaffRole = "OWNER" | "STAFF";

export interface Staff {
  id: string;
  tenantId: string;
  name: string;
  pinHash: string;
  pinSalt: string;
  role: StaffRole;
  createdAt: string;
}

export interface Product {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  price: number;
  image: string | null;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  tenantId: string;
  productId: string;
  sku: string;
  color: string | null;
  size: string | null;
  priceOverride: number | null;
  stockQuantity: number;
  lowStockThreshold: number;
  status: VariantStatus;
}

export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  phone: string | null;
  email: string | null;
  channel: string | null;
  channelUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantId: string;
  productNameSnapshot: string;
  variantSnapshot: { sku: string; color: string | null; size: string | null };
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

export interface Order {
  id: string;
  tenantId: string;
  orderNumber: string;
  customerId: string | null;
  status: OrderStatus;
  channel: OrderChannel;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  note: string | null;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  lastActorStaffId: string | null;
  lastActorName: string | null;
}
