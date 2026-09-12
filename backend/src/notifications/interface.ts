import { OrderEvent } from "./events";

/** Boundary between order/stock business logic and any real channel (WhatsApp, LINE, FB, ...).
 * Order services depend only on this interface so a real channel adapter can be swapped in
 * later without touching order or stock logic. */
export interface NotificationService {
  notify(db: D1Database, tenantId: string, event: OrderEvent): Promise<void>;
}
