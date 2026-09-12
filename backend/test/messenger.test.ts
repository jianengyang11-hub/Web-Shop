import { beforeEach, describe, expect, it } from "vitest";
import { messenger } from "../src/webhooks/messenger";
import * as customerRepository from "../src/repositories/customerRepository";
import { Tenant } from "../src/models/types";
import { makeTestDb, makeTestTenant } from "./support/setup";

const VERIFY_TOKEN = "test-verify-token";

describe("Messenger webhook", () => {
  let db: D1Database;
  let tenant: Tenant;

  beforeEach(async () => {
    db = await makeTestDb();
    tenant = await makeTestTenant(db, { messengerPageId: "page-123" });
  });

  it("echoes the challenge when the verify token matches", async () => {
    const res = await messenger.request(
      "/api/webhooks/messenger?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=xyz789",
      {},
      { DB: db, META_VERIFY_TOKEN: VERIFY_TOKEN }
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("xyz789");
  });

  it("rejects a wrong verify token", async () => {
    const res = await messenger.request(
      "/api/webhooks/messenger?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=xyz789",
      {},
      { DB: db, META_VERIFY_TOKEN: VERIFY_TOKEN }
    );
    expect(res.status).toBe(403);
  });

  it("logs an inbound message and upserts the customer", async () => {
    const payload = {
      entry: [
        {
          id: "page-123",
          messaging: [{ sender: { id: "psid-1" }, message: { mid: "mid.1", text: "Hi there" } }],
        },
      ],
    };

    const res = await messenger.request(
      "/api/webhooks/messenger",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) },
      { DB: db, META_VERIFY_TOKEN: VERIFY_TOKEN }
    );
    expect(res.status).toBe(200);

    const customer = await customerRepository.findByChannel(db, tenant.id, "MESSENGER", "psid-1");
    expect(customer).not.toBeNull();

    const { results } = await db.prepare("SELECT * FROM channel_messages WHERE tenant_id = ?").bind(tenant.id).all();
    expect(results).toHaveLength(1);
    expect(results[0].body).toBe("Hi there");
    expect(results[0].channel).toBe("MESSENGER");
  });

  it("acks an unknown page id without throwing", async () => {
    const payload = {
      entry: [{ id: "unknown-page", messaging: [{ sender: { id: "psid-2" }, message: { text: "Hi" } }] }],
    };

    const res = await messenger.request(
      "/api/webhooks/messenger",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) },
      { DB: db, META_VERIFY_TOKEN: VERIFY_TOKEN }
    );
    expect(res.status).toBe(200);
  });
});
