import { Hono } from "hono";
import { AppEnv } from "../core/env";
import { OrderStatus } from "../models/enums";
import * as orderService from "../services/orderService";
import * as productService from "../services/productService";

export const dashboard = new Hono<AppEnv>();

dashboard.get("/dashboard/overview", async (c) => {
  const tenant = c.get("tenant");
  const db = c.env.DB;

  const [orders, products, lowStock] = await Promise.all([
    orderService.listOrders(db, tenant.id),
    productService.listProducts(db, tenant.id),
    productService.listLowStock(db, tenant.id),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const settled = new Set([OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.SHIPPED, OrderStatus.DELIVERED]);
  const todaysSales = orders
    .filter((o) => settled.has(o.status) && o.confirmedAt?.slice(0, 10) === today)
    .reduce((sum, o) => sum + o.total, 0);

  return c.json({
    newOrders: orders.filter((o) => o.status === OrderStatus.NEW).length,
    pendingConfirmation: orders.filter((o) => o.status === OrderStatus.PENDING_CONFIRMATION).length,
    confirmedOrders: orders.filter((o) => o.status === OrderStatus.CONFIRMED).length,
    todaysSales,
    totalProducts: products.length,
    lowStockCount: lowStock.length,
    recentOrders: orders.slice(0, 10).map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      total: o.total,
      createdAt: o.createdAt,
    })),
  });
});
