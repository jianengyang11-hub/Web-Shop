import { beforeEach, describe, expect, it } from "vitest";
import { whatsapp } from "../src/webhooks/whatsapp";
import * as customerRepository from "../src/repositories/customerRepository";
import { Tenant } from "../src/models/types";
import { makeTestDb, makeTestTenant } from "./support/setup";

const VERIFY_TOKEN = "test-verify-token";

describe("WhatsApp webhook", () => {
  let db: D1Database;
  let tenant: Tenant;

  beforeEach(async () => {
    db = await makeTestDb();
    tenant = await makeTestTenant(db, { whatsappPhoneNumberId: "1234567890" });
  });

  it("echoes the challenge when the verify token matches", async () => {
    const res = await whatsapp.request(
      "/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=abc123",
      {},
      { DB: db, WHATSAPP_VERIFY_TOKEN: VERIFY_TOKEN }
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("abc123");
  });

  it("rejects a wrong verify token", async () => {
    const res = await whatsapp.request(
      "/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc123",
      {},
      { DB: db, WHATSAPP_VERIFY_TOKEN: VERIFY_TOKEN }
    );
    expect(res.status).toBe(403);
  });

  it("logs an inbound message and upserts the customer", async () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "1234567890" },
                contacts: [{ profile: { name: "Somchai" }, wa_id: "66812345678" }],
                messages: [{ from: "66812345678", id: "wamid.1", timestamp: "123", type: "text", text: { body: "Hello!" } }],
              },
            },
          ],
        },
      ],
    };

    const res = await whatsapp.request(
      "/webhooks/whatsapp",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) },
      { DB: db, WHATSAPP_VERIFY_TOKEN: VERIFY_TOKEN }
    );
    expect(res.status).toBe(200);

    const customer = await customerRepository.findByChannel(db, tenant.id, "WHATSAPP", "66812345678");
    expect(customer).not.toBeNull();
    expect(customer!.name).toBe("Somchai");

    const { results } = await db.prepare("SELECT * FROM whatsapp_messages WHERE tenant_id = ?").bind(tenant.id).all();
    expect(results).toHaveLength(1);
    expect(results[0].body).toBe("Hello!");
    expect(results[0].direction).toBe("INBOUND");
  });

  it("acks unknown phone_number_id without throwing", async () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "does-not-exist" },
                messages: [{ from: "66899999999", id: "wamid.2", timestamp: "123", type: "text", text: { body: "Hi" } }],
              },
            },
          ],
        },
      ],
    };

    const res = await whatsapp.request(
      "/webhooks/whatsapp",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) },
      { DB: db, WHATSAPP_VERIFY_TOKEN: VERIFY_TOKEN }
    );
    expect(res.status).toBe(200);
  });
});
