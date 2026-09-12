import { beforeEach, describe, expect, it } from "vitest";
import app from "../src/index";
import { Tenant } from "../src/models/types";
import { makeTestDb, makeTestTenant } from "./support/setup";

const JWT_SECRET = "test-secret";

function envFor(db: D1Database) {
  return { DB: db, JWT_SECRET, META_VERIFY_TOKEN: "verify-token" };
}

async function loginToken(db: D1Database, tenant: Tenant, pin: string): Promise<string> {
  const res = await app.request(
    "/api/auth/login",
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tenantId: tenant.id, pin }) },
    envFor(db)
  );
  return (await res.json()).token;
}

describe("integration settings", () => {
  let db: D1Database;
  let tenant: Tenant;
  let token: string;

  beforeEach(async () => {
    db = await makeTestDb();
    tenant = await makeTestTenant(db, { pin: "1234" });
    token = await loginToken(db, tenant, "1234");
  });

  it("requires auth", async () => {
    const res = await app.request(`/api/${tenant.id}/settings/integrations`, {}, envFor(db));
    expect(res.status).toBe(401);
  });

  it("saves and reflects WhatsApp/Messenger credentials", async () => {
    const putRes = await app.request(
      `/api/${tenant.id}/settings/integrations`,
      {
        method: "PUT",
        headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          whatsappPhoneNumberId: "15550001111",
          whatsappAccessToken: "wa-token",
          messengerPageId: "page-999",
          messengerAccessToken: "fb-token",
        }),
      },
      envFor(db)
    );
    expect(putRes.status).toBe(200);
    const saved = await putRes.json();
    expect(saved.whatsappPhoneNumberId).toBe("15550001111");
    expect(saved.messengerAccessToken).toBe("fb-token");

    const getRes = await app.request(
      `/api/${tenant.id}/settings/integrations`,
      { headers: { Authorization: `Bearer ${token}` } },
      envFor(db)
    );
    const fetched = await getRes.json();
    expect(fetched).toEqual(saved);
  });
});
