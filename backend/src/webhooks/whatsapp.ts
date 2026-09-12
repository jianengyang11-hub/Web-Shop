import { Hono } from "hono";
import { AppEnv } from "../core/env";
import * as customerRepository from "../repositories/customerRepository";
import * as tenantRepository from "../repositories/tenantRepository";
import { AUTO_ACK_MESSAGE, sendWhatsAppReply } from "../services/channelSender";

export const whatsapp = new Hono<AppEnv>();

interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
}

interface WhatsAppWebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
        messages?: WhatsAppMessage[];
      };
    }>;
  }>;
}

/** Meta's webhook verification handshake — configured once in the Meta App dashboard against
 * this URL. Must echo back hub.challenge verbatim when the verify token matches. Shares
 * META_VERIFY_TOKEN with the Messenger webhook — it's one value per Meta App, not per channel. */
whatsapp.get("/webhooks/whatsapp", async (c) => {
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");

  if (mode === "subscribe" && token && token === c.env.META_VERIFY_TOKEN) {
    return c.text(challenge ?? "", 200);
  }
  return c.text("Forbidden", 403);
});

/** Receives inbound WhatsApp messages. Always acks 200 quickly (Meta retries aggressively on
 * non-2xx) — all processing is best-effort and wrapped so a parsing hiccup never surfaces as an
 * error to Meta. Resolves the tenant by the destination phone_number_id, upserts the sending
 * customer, logs the message, and sends a fixed acknowledgement reply if the tenant has a
 * WhatsApp access token configured. Turning message text into an order is intentionally NOT done
 * here — that stays the job of aiBoundary.aiCreateOrder, called by whatever AI layer later reads
 * these logged messages, keeping the same "AI never touches stock/confirm" boundary. */
whatsapp.post("/webhooks/whatsapp", async (c) => {
  try {
    const payload = await c.req.json<WhatsAppWebhookPayload>();
    await processWebhookPayload(c.env.DB, payload);
  } catch (err) {
    console.error("WhatsApp webhook processing error", err);
  }
  return c.text("OK", 200);
});

async function processWebhookPayload(db: D1Database, payload: WhatsAppWebhookPayload): Promise<void> {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      const tenant = await tenantRepository.findByWhatsappPhoneNumberId(db, phoneNumberId);
      if (!tenant) {
        console.warn(`WhatsApp webhook: no tenant registered for phone_number_id ${phoneNumberId}`);
        continue;
      }

      const contactsByWaId = new Map((value?.contacts ?? []).map((contact) => [contact.wa_id, contact]));

      for (const message of value?.messages ?? []) {
        const contact = contactsByWaId.get(message.from);
        const customer = await customerRepository.findOrCreateByChannel(db, tenant.id, {
          id: crypto.randomUUID(),
          name: contact?.profile?.name ?? message.from,
          channel: "WHATSAPP",
          channelUserId: message.from,
          phone: message.from,
        });

        await db
          .prepare(
            `INSERT INTO channel_messages (id, tenant_id, customer_id, external_message_id, channel, direction, body, created_at)
             VALUES (?, ?, ?, ?, 'WHATSAPP', 'INBOUND', ?, ?)`
          )
          .bind(
            crypto.randomUUID(),
            tenant.id,
            customer.id,
            message.id,
            message.text?.body ?? `[${message.type} message]`,
            new Date().toISOString()
          )
          .run();

        await sendWhatsAppReply(tenant, message.from, AUTO_ACK_MESSAGE);
      }
    }
  }
}
