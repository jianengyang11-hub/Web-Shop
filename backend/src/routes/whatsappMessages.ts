import { Hono } from "hono";
import { AppEnv } from "../core/env";

export const whatsappMessages = new Hono<AppEnv>();

/** Feeds the dashboard's AI Conversations page — inbound WhatsApp messages logged by the
 * webhook, plus whichever customer they came from. No NLP here; this is just the log. */
whatsappMessages.get("/whatsapp-messages", async (c) => {
  const tenant = c.get("tenant");
  const { results } = await c.env.DB.prepare(
    `SELECT m.*, cu.name AS customer_name, cu.phone AS customer_phone
     FROM whatsapp_messages m
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
      waMessageId: r.wa_message_id,
      direction: r.direction,
      body: r.body,
      createdAt: r.created_at,
    }))
  );
});
