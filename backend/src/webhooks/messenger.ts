import { Hono } from "hono";
import { AppEnv } from "../core/env";
import * as customerRepository from "../repositories/customerRepository";
import * as tenantRepository from "../repositories/tenantRepository";
import { AUTO_ACK_MESSAGE, sendMessengerReply } from "../services/channelSender";

export const messenger = new Hono<AppEnv>();

interface MessengerEvent {
  sender?: { id?: string };
  message?: { mid?: string; text?: string };
}

interface MessengerWebhookPayload {
  entry?: Array<{
    id?: string; // Facebook Page id
    messaging?: MessengerEvent[];
  }>;
}

/** Same Meta verification handshake shape as the WhatsApp webhook, and the same shared
 * META_VERIFY_TOKEN — one Meta App, one verify token, regardless of which product's webhook
 * fields are subscribed. */
messenger.get("/api/webhooks/messenger", async (c) => {
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");

  if (mode === "subscribe" && token && token === c.env.META_VERIFY_TOKEN) {
    return c.text(challenge ?? "", 200);
  }
  return c.text("Forbidden", 403);
});

/** Receives inbound Facebook Messenger messages. Same shape/guarantees as the WhatsApp webhook:
 * always 200s quickly, resolves the tenant by the destination Page id, upserts the customer,
 * logs the message into the shared channel_messages table, and sends a fixed acknowledgement
 * reply if the tenant has a Messenger access token configured. No message-understanding logic —
 * order creation still only ever happens via aiBoundary.aiCreateOrder. */
messenger.post("/api/webhooks/messenger", async (c) => {
  try {
    const payload = await c.req.json<MessengerWebhookPayload>();
    await processWebhookPayload(c.env.DB, payload);
  } catch (err) {
    console.error("Messenger webhook processing error", err);
  }
  return c.text("OK", 200);
});

async function processWebhookPayload(db: D1Database, payload: MessengerWebhookPayload): Promise<void> {
  for (const entry of payload.entry ?? []) {
    const pageId = entry.id;
    if (!pageId) continue;

    const tenant = await tenantRepository.findByMessengerPageId(db, pageId);
    if (!tenant) {
      console.warn(`Messenger webhook: no tenant registered for page id ${pageId}`);
      continue;
    }

    for (const event of entry.messaging ?? []) {
      const senderId = event.sender?.id;
      if (!senderId || !event.message) continue;

      const customer = await customerRepository.findOrCreateByChannel(db, tenant.id, {
        id: crypto.randomUUID(),
        name: senderId,
        channel: "MESSENGER",
        channelUserId: senderId,
      });

      await db
        .prepare(
          `INSERT INTO channel_messages (id, tenant_id, customer_id, external_message_id, channel, direction, body, created_at)
           VALUES (?, ?, ?, ?, 'MESSENGER', 'INBOUND', ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          tenant.id,
          customer.id,
          event.message.mid ?? null,
          event.message.text ?? "[non-text message]",
          new Date().toISOString()
        )
        .run();

      await sendMessengerReply(tenant, senderId, AUTO_ACK_MESSAGE);
    }
  }
}
