-- Core schema for the multi-tenant AI Online Shop Operating System.
-- All ids are TEXT (crypto.randomUUID(), generated in the Worker).

CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  whatsapp_phone_number_id TEXT UNIQUE,
  whatsapp_access_token TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  image TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_products_tenant ON products(tenant_id);

CREATE TABLE variants (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  sku TEXT NOT NULL,
  color TEXT,
  size TEXT,
  price_override REAL,
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  UNIQUE (tenant_id, sku)
);
CREATE INDEX idx_variants_tenant ON variants(tenant_id);
CREATE INDEX idx_variants_product ON variants(product_id);

CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  channel TEXT,
  channel_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (tenant_id, channel, channel_user_id)
);
CREATE INDEX idx_customers_tenant ON customers(tenant_id);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  order_number TEXT NOT NULL UNIQUE,
  customer_id TEXT REFERENCES customers(id),
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN (
    'NEW', 'PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED',
    'CANCELLED', 'REJECTED'
  )),
  channel TEXT NOT NULL DEFAULT 'MANUAL' CHECK (channel IN (
    'AI', 'MANUAL', 'LINE', 'FACEBOOK', 'TELEGRAM', 'WHATSAPP', 'WEB'
  )),
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  shipping_fee REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  confirmed_at TEXT,
  cancelled_at TEXT
);
CREATE INDEX idx_orders_tenant ON orders(tenant_id);
CREATE INDEX idx_orders_tenant_status ON orders(tenant_id, status);

CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  variant_id TEXT NOT NULL REFERENCES variants(id),
  product_name_snapshot TEXT NOT NULL,
  variant_snapshot TEXT NOT NULL,
  unit_price REAL NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  subtotal REAL NOT NULL
);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_tenant ON order_items(tenant_id);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  type TEXT NOT NULL,
  order_id TEXT,
  order_number TEXT,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_notifications_tenant ON notifications(tenant_id, created_at DESC);

CREATE TABLE whatsapp_messages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  customer_id TEXT REFERENCES customers(id),
  wa_message_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
  body TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_whatsapp_messages_tenant ON whatsapp_messages(tenant_id, created_at DESC);
