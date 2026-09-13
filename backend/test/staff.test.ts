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

describe("staff (multi-user per shop)", () => {
  let db: D1Database;
  let tenant: Tenant;
  let ownerToken: string;

  beforeEach(async () => {
    db = await makeTestDb();
    tenant = await makeTestTenant(db, { name: "Staff Shop", pin: "1234" });
    const login1 = await login(db, tenant.id, "1234");
    ownerToken = login1.token;
  });

  it("login identifies which staff member owns the matching PIN", async () => {
    await makeTestStaff(db, tenant.id, { name: "Alice", pin: "5678", role: "STAFF" });

    const ownerLogin = await login(db, tenant.id, "1234");
    expect(ownerLogin.staff.name).toBe("Owner");
    expect(ownerLogin.staff.role).toBe("OWNER");

    const staffLogin = await login(db, tenant.id, "5678");
    expect(staffLogin.staff.name).toBe("Alice");
    expect(staffLogin.staff.role).toBe("STAFF");
  });

  it("owner can list and create staff", async () => {
    const listRes = await app.request(
      `/api/${tenant.id}/staff`,
      { headers: { Authorization: `Bearer ${ownerToken}` } },
      envFor(db)
    );
    expect(listRes.status).toBe(200);
    expect(await listRes.json()).toHaveLength(1);

    const createRes = await app.request(
      `/api/${tenant.id}/staff`,
      {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ name: "Bob", pin: "4321" }),
      },
      envFor(db)
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.name).toBe("Bob");
    expect(created.role).toBe("STAFF");
    expect(created.pinHash).toBeUndefined();

    const listAfter = await app.request(
      `/api/${tenant.id}/staff`,
      { headers: { Authorization: `Bearer ${ownerToken}` } },
      envFor(db)
    );
    expect(await listAfter.json()).toHaveLength(2);
  });

  it("rejects creating a staff member with a PIN already used in the shop", async () => {
    const res = await app.request(
      `/api/${tenant.id}/staff`,
      {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ name: "Duplicate PIN", pin: "1234" }),
      },
      envFor(db)
    );
    expect(res.status).toBe(409);
  });

  it("a STAFF-role token cannot manage staff", async () => {
    await makeTestStaff(db, tenant.id, { name: "Alice", pin: "5678", role: "STAFF" });
    const staffLogin = await login(db, tenant.id, "5678");

    const res = await app.request(
      `/api/${tenant.id}/staff`,
      { headers: { Authorization: `Bearer ${staffLogin.token}` } },
      envFor(db)
    );
    expect(res.status).toBe(403);
  });

  it("owner can reset a staff member's PIN, and the old PIN stops working", async () => {
    const alice = await makeTestStaff(db, tenant.id, { name: "Alice", pin: "5678", role: "STAFF" });

    const resetRes = await app.request(
      `/api/${tenant.id}/staff/${alice.id}/pin`,
      {
        method: "PUT",
        headers: { "content-type": "application/json", Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ pin: "9999" }),
      },
      envFor(db)
    );
    expect(resetRes.status).toBe(200);

    const oldPinLogin = await login(db, tenant.id, "5678");
    expect(oldPinLogin.token).toBeUndefined();

    const newPinLogin = await login(db, tenant.id, "9999");
    expect(newPinLogin.staff.name).toBe("Alice");
  });

  it("owner can remove a staff member", async () => {
    const alice = await makeTestStaff(db, tenant.id, { name: "Alice", pin: "5678", role: "STAFF" });

    const res = await app.request(
      `/api/${tenant.id}/staff/${alice.id}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${ownerToken}` } },
      envFor(db)
    );
    expect(res.status).toBe(200);

    const loginAfter = await login(db, tenant.id, "5678");
    expect(loginAfter.token).toBeUndefined();
  });

  it("allows removing one of two Owners, but blocks removing the last one", async () => {
    const owner1Id = (await login(db, tenant.id, "1234")).staff.id;
    const owner2 = await makeTestStaff(db, tenant.id, { name: "Owner 2", pin: "1111", role: "OWNER" });

    // Two Owners exist, so Owner 1 removing Owner 2 (not itself, not the last Owner) is fine.
    const res = await app.request(
      `/api/${tenant.id}/staff/${owner2.id}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${ownerToken}` } },
      envFor(db)
    );
    expect(res.status).toBe(200);

    // Only Owner 1 is left — removing them (the shop's last Owner) is blocked.
    const blockedRes = await app.request(
      `/api/${tenant.id}/staff/${owner1Id}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${ownerToken}` } },
      envFor(db)
    );
    expect(blockedRes.status).toBe(422);
  });

  it("blocks removing your own staff account even when another Owner exists", async () => {
    await makeTestStaff(db, tenant.id, { name: "Owner 2", pin: "1111", role: "OWNER" });

    const res = await app.request(
      `/api/${tenant.id}/staff/${(await login(db, tenant.id, "1234")).staff.id}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${ownerToken}` } },
      envFor(db)
    );
    expect(res.status).toBe(422);
  });
});
