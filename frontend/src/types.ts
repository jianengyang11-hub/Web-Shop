export type OrderStatus =
  | "NEW"
  | "PENDING_CONFIRMATION"
  | "CONFIRMED"
  | "PREPARING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REJECTED";

export type OrderChannel = "AI" | "MANUAL" | "LINE" | "FACEBOOK" | "TELEGRAM" | "WEB";

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image: string | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  color: string | null;
  size: string | null;
  priceOverride: number | null;
  stockQuantity: number;
  lowStockThreshold: number;
  status: "ACTIVE" | "INACTIVE";
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  channel: string | null;
  channelUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
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
  lastActorName: string | null;
}

export type StaffRole = "OWNER" | "STAFF";

export interface Staff {
  id: string;
  name: string;
  role: StaffRole;
  createdAt: string;
}

export interface DashboardOverview {
  newOrders: number;
  pendingConfirmation: number;
  confirmedOrders: number;
  todaysSales: number;
  totalProducts: number;
  lowStockCount: number;
  recentOrders: { id: string; orderNumber: string; status: OrderStatus; total: number; createdAt: string }[];
}

export interface NotificationEvent {
  id: string;
  type: string;
  orderId: string;
  orderNumber: string;
  message: string;
  createdAt: string;
}
