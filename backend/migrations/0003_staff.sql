-- Per-tenant staff accounts, so more than one person can log into the same shop with their own
-- PIN. Every existing tenant's PIN becomes that tenant's "Owner" staff row, so nothing already
-- logged in breaks. tenants.pin_hash/pin_salt are left in place (unused going forward) rather
-- than dropped, since SQLite/D1 can't drop columns referenced by existing data cheaply.

CREATE TABLE staff (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  pin_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'STAFF' CHECK (role IN ('OWNER', 'STAFF')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_staff_tenant ON staff(tenant_id);

INSERT INTO staff (id, tenant_id, name, pin_hash, pin_salt, role, created_at)
SELECT lower(hex(randomblob(16))), id, 'Owner', pin_hash, pin_salt, 'OWNER', created_at
FROM tenants
WHERE pin_hash IS NOT NULL AND pin_salt IS NOT NULL;

ALTER TABLE orders ADD COLUMN last_actor_staff_id TEXT;
ALTER TABLE orders ADD COLUMN last_actor_name TEXT;
