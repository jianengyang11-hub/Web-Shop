import { Hono } from "hono";
import { AppEnv } from "../core/env";

export const channelMessages = new Hono<AppEnv>();

/** Feeds the dashboard's AI Conversations page — inbound WhatsApp/Messenger messages logged by
 * the webhooks, plus whichever customer they came from. No NLP here; this is just the log.
 * Route path kept as /whatsapp-messages for frontend compatibility even though it now covers
 * both channels — the response's `channel` field distinguishes them. */
channelMessages.get("/whatsapp-messages", async (c) => {
  const tenant = c.get("tenant");
  const { results } = await c.env.DB.prepare(
    `SELECT m.*, cu.name AS customer_name, cu.phone AS customer_phone
     FROM channel_messages m
     LEFT JOIN customers cu ON cu.id = m.customer_id
     WHERE m.tenant_id = ?
     ORDER BY m.created_at DESC
     LIMIT 200`
  )
    .bind(tenant.id)
    .all();

  return c.json(
    results.map((r) => ({
      id: r.id,
      customerId: r.customer_id,
      customerName: r.customer_name ?? null,
      customerPhone: r.customer_phone ?? null,
      channel: r.channel,
      externalMessageId: r.external_message_id,
      direction: r.direction,
      body: r.body,
      createdAt: r.created_at,
    }))
  );
});
