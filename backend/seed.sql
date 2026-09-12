-- Demo data for manual testing / first look at the dashboard.
-- Tenant id is a readable slug (ids are plain TEXT, no format requirement) so it's easy to type
-- into the frontend's "Enter Shop ID" gate.

INSERT INTO tenants (id, name, created_at) VALUES
  ('shop_demo', 'Demo Shop', datetime('now'));

INSERT INTO products (id, tenant_id, name, description, price, image, status, created_at, updated_at) VALUES
  ('prod_tshirt', 'shop_demo', 'เสื้อยืด Cotton', 'เสื้อยืดผ้าฝ้าย 100%', 259.00, NULL, 'ACTIVE', datetime('now'), datetime('now')),
  ('prod_mug', 'shop_demo', 'แก้วเซรามิก', 'แก้วเซรามิกลายน่ารัก', 149.00, NULL, 'ACTIVE', datetime('now'), datetime('now')),
  ('prod_cap', 'shop_demo', 'หมวกแก๊ป', 'หมวกแก๊ปปักโลโก้', 199.00, NULL, 'ACTIVE', datetime('now'), datetime('now'));

INSERT INTO variants (id, tenant_id, product_id, sku, color, size, price_override, stock_quantity, low_stock_threshold, status) VALUES
  ('var_tshirt_s_black', 'shop_demo', 'prod_tshirt', 'TSHIRT-S-BLK', 'Black', 'S', NULL, 20, 5, 'ACTIVE'),
  ('var_tshirt_m_black', 'shop_demo', 'prod_tshirt', 'TSHIRT-M-BLK', 'Black', 'M', NULL, 15, 5, 'ACTIVE'),
  ('var_tshirt_l_white', 'shop_demo', 'prod_tshirt', 'TSHIRT-L-WHT', 'White', 'L', NULL, 3, 5, 'ACTIVE'),
  ('var_mug_default',    'shop_demo', 'prod_mug',    'MUG-STD',      NULL,    NULL, NULL, 30, 5, 'ACTIVE'),
  ('var_cap_navy',       'shop_demo', 'prod_cap',    'CAP-NAVY',     'Navy',  NULL, NULL, 0,  5, 'ACTIVE');
