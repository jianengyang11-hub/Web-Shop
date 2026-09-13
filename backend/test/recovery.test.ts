import { beforeEach, describe, expect, it } from "vitest";
import app from "../src/index";
import { Tenant } from "../src/models/types";
import { makeTestDb, makeTestStaff, makeTestTenant } from "./support/setup";

const JWT_SECRET = "test-secret";

function envFor(db: D1Database) {
  return { DB: db, JWT_SECRET, META_VERIFY_TOKEN: "verify-token" };
}

async function login(db: D1Database, tenantId: string, pin: string) {
  const res = await app.request(
    "/api/auth/login",
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tenantId, pin }) },
    envFor(db)
  );
  return res.json();
}

describe("PIN recovery (forgot PIN, no shop id needed)", () => {
  let db: D1Database;
  let tenant: Tenant;
  let ownerToken: string;

  beforeEach(async () => {
    db = await makeTestDb();
    tenant = await makeTestTenant(db, { name: "Recovery Shop", pin: "1234" });
    ownerToken = (await login(db, tenant.id, "1234")).token;
  });

  it("returns a recovery code when a new shop is created", async () => {
    const res = await app.request(
      "/api/tenants",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Fresh Shop", pin: "4242" }) },
      envFor(db)
    );
    const body = await res.json();
    expect(body.recoveryCode).toMatch(/^[A-Z0-9]{5}-[A-Z0-9]{5}$/);
  });

  it("returns a recovery code when a new staff member is added", async () => {
    const res = await app.request(
      `/api/${tenant.id}/staff`,
      {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ name: "Alice", pin: "5678" }),
      },
      envFor(db)
    );
    const body = await res.json();
    expect(body.recoveryCode).toMatch(/^[A-Z0-9]{5}-[A-Z0-9]{5}$/);
  });

  it("lets a logged-in staff member generate their own recovery code", async () => {
    const res = await app.request(
      `/api/${tenant.id}/staff/me/recovery-code`,
      { method: "POST", headers: { Authorization: `Bearer ${ownerToken}` } },
      envFor(db)
    );
    expect(res.status).toBe(200);
    expect((await res.json()).recoveryCode).toMatch(/^[A-Z0-9]{5}-[A-Z0-9]{5}$/);
  });

  it("resets the PIN using only the recovery code — no shop id required", async () => {
    const genRes = await app.request(
      `/api/${tenant.id}/staff/me/recovery-code`,
      { method: "POST", headers: { Authorization: `Bearer ${ownerToken}` } },
      envFor(db)
    );
    const { recoveryCode } = await genRes.json();

    const recoverRes = await app.request(
      "/api/auth/recover",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recoveryCode, newPin: "9999" }) },
      envFor(db)
    );
    expect(recoverRes.status).toBe(200);
    const recovered = await recoverRes.json();
    expect(recovered.tenantId).toBe(tenant.id);
    expect(recovered.staffName).toBe("Owner");
    expect(recovered.newRecoveryCode).toMatch(/^[A-Z0-9]{5}-[A-Z0-9]{5}$/);
    expect(recovered.newRecoveryCode).not.toBe(recoveryCode);

    const oldPinLogin = await login(db, tenant.id, "1234");
    expect(oldPinLogin.token).toBeUndefined();
    const newPinLogin = await login(db, tenant.id, "9999");
    expect(newPinLogin.staff.name).toBe("Owner");
  });

  it("rotates the code so it cannot be reused after a successful recovery", async () => {
    const genRes = await app.request(
      `/api/${tenant.id}/staff/me/recovery-code`,
      { method: "POST", headers: { Authorization: `Bearer ${ownerToken}` } },
      envFor(db)
    );
    const { recoveryCode } = await genRes.json();

    await app.request(
      "/api/auth/recover",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recoveryCode, newPin: "9999" }) },
      envFor(db)
    );

    const replay = await app.request(
      "/api/auth/recover",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recoveryCode, newPin: "8888" }) },
      envFor(db)
    );
    expect(replay.status).toBe(401);
  });

  it("rejects an unknown or never-generated recovery code", async () => {
    const res = await app.request(
      "/api/auth/recover",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recoveryCode: "ZZZZZ-ZZZZZ", newPin: "9999" }) },
      envFor(db)
    );
    expect(res.status).toBe(401);
  });

  it("rejects a new PIN that's already used by another staff member in the same shop", async () => {
    await makeTestStaff(db, tenant.id, { name: "Alice", pin: "5678", role: "STAFF" });
    const genRes = await app.request(
      `/api/${tenant.id}/staff/me/recovery-code`,
      { method: "POST", headers: { Authorization: `Bearer ${ownerToken}` } },
      envFor(db)
    );
    const { recoveryCode } = await genRes.json();

    const res = await app.request(
      "/api/auth/recover",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recoveryCode, newPin: "5678" }) },
      envFor(db)
    );
    expect(res.status).toBe(409);
  });
});
