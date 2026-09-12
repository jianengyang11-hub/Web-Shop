import { OrderEvent } from "./events";
import { NotificationService } from "./interface";

/** Logs events into D1 so the dashboard's Notifications page can list them. Stands in for a
 * real WhatsApp/LINE/Facebook channel adapter, which can implement the same NotificationService
 * interface later without any change to order/stock logic. */
export const mockNotificationService: NotificationService = {
  async notify(db: D1Database, tenantId: string, event: OrderEvent): Promise<void> {
    console.log(`[notification] ${event.type}: ${event.message}`);
    await db
      .prepare(
        "INSERT INTO notifications (id, tenant_id, type, order_id, order_number, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(crypto.randomUUID(), tenantId, event.type, event.orderId, event.orderNumber, event.message, new Date().toISOString())
      .run();
  },
};

export async function listNotifications(db: D1Database, tenantId: string) {
  const { results } = await db
    .prepare("SELECT * FROM notifications WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 100")
    .bind(tenantId)
    .all();
  return results.map((r) => ({
    id: r.id,
    type: r.type,
    orderId: r.order_id,
    orderNumber: r.order_number,
    message: r.message,
    createdAt: r.created_at,
  }));
}
