import { beforeEach, describe, expect, it } from "vitest";
import app from "../src/index";
import { Tenant } from "../src/models/types";
import { makeTestDb, makeTestTenant } from "./support/setup";

const JWT_SECRET = "test-secret";

function envFor(db: D1Database) {
  return { DB: db, JWT_SECRET, META_VERIFY_TOKEN: "verify-token" };
}

describe("auth", () => {
  let db: D1Database;
  let tenant: Tenant;

  beforeEach(async () => {
    db = await makeTestDb();
    tenant = await makeTestTenant(db, { name: "Auth Shop", pin: "1234" });
  });

  it("logs in with the correct tenant id and pin", async () => {
    const res = await app.request(
      "/api/auth/login",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tenantId: tenant.id, pin: "1234" }) },
      envFor(db)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBeTypeOf("string");
    expect(body.tenant.id).toBe(tenant.id);
  });

  it("rejects a wrong pin", async () => {
    const res = await app.request(
      "/api/auth/login",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tenantId: tenant.id, pin: "0000" }) },
      envFor(db)
    );
    expect(res.status).toBe(401);
  });

  it("rejects an unknown tenant with the same error as a wrong pin", async () => {
    const res = await app.request(
      "/api/auth/login",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tenantId: "does-not-exist", pin: "1234" }) },
      envFor(db)
    );
    expect(res.status).toBe(401);
    const known = await app.request(
      "/api/auth/login",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tenantId: tenant.id, pin: "wrong" }) },
      envFor(db)
    );
    expect((await res.json()).detail).toBe((await known.json()).detail);
  });

  it("rejects tenant-scoped requests with no token", async () => {
    const res = await app.request(`/api/${tenant.id}/products`, {}, envFor(db));
    expect(res.status).toBe(401);
  });

  it("rejects tenant-scoped requests with a garbage token", async () => {
    const res = await app.request(
      `/api/${tenant.id}/products`,
      { headers: { Authorization: "Bearer not-a-real-token" } },
      envFor(db)
    );
    expect(res.status).toBe(401);
  });

  it("rejects a valid token for a different tenant (cross-tenant replay)", async () => {
    const otherTenant = await makeTestTenant(db, { name: "Other Shop", pin: "5678" });
    const loginRes = await app.request(
      "/api/auth/login",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tenantId: otherTenant.id, pin: "5678" }) },
      envFor(db)
    );
    const { token } = await loginRes.json();

    const res = await app.request(
      `/api/${tenant.id}/products`,
      { headers: { Authorization: `Bearer ${token}` } },
      envFor(db)
    );
    expect(res.status).toBe(403);
  });

  it("allows tenant-scoped requests with a valid matching token", async () => {
    const loginRes = await app.request(
      "/api/auth/login",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tenantId: tenant.id, pin: "1234" }) },
      envFor(db)
    );
    const { token } = await loginRes.json();

    const res = await app.request(
      `/api/${tenant.id}/products`,
      { headers: { Authorization: `Bearer ${token}` } },
      envFor(db)
    );
    expect(res.status).toBe(200);
  });

  it("creating a tenant requires a pin and never returns pin hash/salt", async () => {
    const missingPin = await app.request(
      "/api/tenants",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "No Pin Shop" }) },
      envFor(db)
    );
    expect(missingPin.status).toBe(422);

    const res = await app.request(
      "/api/tenants",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "New Shop", pin: "4242" }) },
      envFor(db)
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.pinHash).toBeUndefined();
    expect(body.pinSalt).toBeUndefined();
  });
});
