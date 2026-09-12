-- Second demo tenant (id literally "demo_shop" as requested), separate from "shop_demo",
-- useful for testing multi-tenant isolation from the dashboard.

INSERT INTO tenants (id, name, created_at) VALUES
  ('demo_shop', 'Demo Shop 2', datetime('now'));

INSERT INTO products (id, tenant_id, name, description, price, image, status, created_at, updated_at) VALUES
  ('ds_prod_shoes', 'demo_shop', 'รองเท้าผ้าใบ', 'รองเท้าผ้าใบสำหรับวิ่ง', 890.00, NULL, 'ACTIVE', datetime('now'), datetime('now')),
  ('ds_prod_bag',   'demo_shop', 'กระเป๋าสะพาย', 'กระเป๋าสะพายข้างผ้าแคนวาส', 350.00, NULL, 'ACTIVE', datetime('now'), datetime('now'));

INSERT INTO variants (id, tenant_id, product_id, sku, color, size, price_override, stock_quantity, low_stock_threshold, status) VALUES
  ('ds_var_shoes_40_black', 'demo_shop', 'ds_prod_shoes', 'SHOES-40-BLK', 'Black', '40', NULL, 12, 5, 'ACTIVE'),
  ('ds_var_shoes_42_black', 'demo_shop', 'ds_prod_shoes', 'SHOES-42-BLK', 'Black', '42', NULL, 8,  5, 'ACTIVE'),
  ('ds_var_shoes_44_white', 'demo_shop', 'ds_prod_shoes', 'SHOES-44-WHT', 'White', '44', NULL, 2,  5, 'ACTIVE'),
  ('ds_var_bag_beige',      'demo_shop', 'ds_prod_bag',   'BAG-BEIGE',    'Beige', NULL, NULL, 25, 5, 'ACTIVE');
