-- ==================== GRENADA GOVERNMENT SEED DATA ====================
-- This migration creates comprehensive seed data for the Grenada government
-- to showcase how the government dashboard, charts, reports, and analytics will look
-- with realistic data including ~100 data points across farmers, products, and transactions.

-- ==================== GOVERNMENT ORGANIZATION ====================

-- Create Grenada Ministry of Agriculture
INSERT INTO organizations (
  id, name, business_name, account_type, business_type, address, country, 
  phone_number, business_registration_number, tax_id, 
  government_level, department, jurisdiction, status, created_at
) VALUES
('770e8400-e29b-41d4-a716-446655440100', 
 'Ministry of Agriculture, Lands, Forestry & Fisheries', 
 'Ministry of Agriculture Grenada', 
 'government', 
 'general', 
 'Botanical Gardens, Tanteen, St. Georges', 
 'Grenada', 
 '+1-473-440-2708',
 'GOV-GRD-MAFF-001', 
 'TAX-GOV-GRD-001', 
 'national', 
 'agriculture', 
 'Grenada', 
 'active',
 NOW() - INTERVAL '2 years'
)
ON CONFLICT (id) DO NOTHING;

-- ==================== GOVERNMENT USERS ====================

-- Create government users with different roles
INSERT INTO users (
  id, email, password, fullname, phone_number, country,
  role, email_verified, is_active, created_at
) VALUES
-- Admin user
('880e8400-e29b-41d4-a716-446655440101', 
 'minister@moagri.gov.gd', 
 '$2b$10$hashedpassword1', 
 'Dr. Dunstan Campbell', 
 '+1-473-440-2708', 
 'Grenada', 
 'admin', 
 true, 
 true,
 NOW() - INTERVAL '2 years'),

-- Procurement Officer
('880e8400-e29b-41d4-a716-446655440102', 
 'procurement@moagri.gov.gd', 
 '$2b$10$hashedpassword2', 
 'Sandra Joseph', 
 '+1-473-440-2710', 
 'Grenada', 
 'user', 
 true, 
 true,
 NOW() - INTERVAL '1 year'),

-- Inspector
('880e8400-e29b-41d4-a716-446655440103', 
 'inspector@moagri.gov.gd', 
 '$2b$10$hashedpassword3', 
 'Marcus Williams', 
 '+1-473-440-2711', 
 'Grenada', 
 'user', 
 true, 
 true,
 NOW() - INTERVAL '1 year'),

-- Data Analyst
('880e8400-e29b-41d4-a716-446655440104', 
 'analyst@moagri.gov.gd', 
 '$2b$10$hashedpassword4', 
 'Jennifer Baptiste', 
 '+1-473-440-2712', 
 'Grenada', 
 'user', 
 true, 
 true,
 NOW() - INTERVAL '8 months')
ON CONFLICT (id) DO NOTHING;

-- Link government users to organization
INSERT INTO organization_users (organization_id, user_id, role_id, is_active, joined_at)
SELECT 
  '770e8400-e29b-41d4-a716-446655440100',
  '880e8400-e29b-41d4-a716-446655440101',
  r.id,
  true,
  NOW() - INTERVAL '2 years'
FROM organization_roles r 
WHERE r.organization_id = '770e8400-e29b-41d4-a716-446655440100' AND r.name = 'admin'
ON CONFLICT (organization_id, user_id) DO NOTHING;

INSERT INTO organization_users (organization_id, user_id, role_id, is_active, joined_at)
SELECT 
  '770e8400-e29b-41d4-a716-446655440100',
  '880e8400-e29b-41d4-a716-446655440102',
  r.id,
  true,
  NOW() - INTERVAL '1 year'
FROM organization_roles r 
WHERE r.organization_id = '770e8400-e29b-41d4-a716-446655440100' AND r.name = 'procurement_officer'
ON CONFLICT (organization_id, user_id) DO NOTHING;

INSERT INTO organization_users (organization_id, user_id, role_id, is_active, joined_at)
SELECT 
  '770e8400-e29b-41d4-a716-446655440100',
  '880e8400-e29b-41d4-a716-446655440103',
  r.id,
  true,
  NOW() - INTERVAL '1 year'
FROM organization_roles r 
WHERE r.organization_id = '770e8400-e29b-41d4-a716-446655440100' AND r.name = 'inspector'
ON CONFLICT (organization_id, user_id) DO NOTHING;

INSERT INTO organization_users (organization_id, user_id, role_id, is_active, joined_at)
SELECT 
  '770e8400-e29b-41d4-a716-446655440100',
  '880e8400-e29b-41d4-a716-446655440104',
  r.id,
  true,
  NOW() - INTERVAL '8 months'
FROM organization_roles r 
WHERE r.organization_id = '770e8400-e29b-41d4-a716-446655440100' AND r.name = 'staff'
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- ==================== FARMER ORGANIZATIONS ====================

-- Create 25 farmer organizations across Grenada's parishes
INSERT INTO organizations (
  id, name, business_name, account_type, business_type, address, country,
  phone_number, business_registration_number, status, created_at
) VALUES
-- St. George's Parish Farmers
('990e8400-e29b-41d4-a716-446655440110', 'Belmont Estate Farm', 'Belmont Estate Ltd', 'seller', 'farmers', 'Belmont, St. Patrick', 'Grenada', '+1-473-442-9524', 'BUS-GRD-001', 'active', NOW() - INTERVAL '18 months'),

('990e8400-e29b-41d4-a716-446655440120', 'Gouyave Organic Farms', 'Gouyave Organic Co-op', 'seller', 'farmers', 'Gouyave, St. John', 'Grenada', '+1-473-444-8280', 'BUS-GRD-002', 'active', NOW() - INTERVAL '16 months'),

('990e8400-e29b-41d4-a716-446655440130', 'Grand Roy Agricultural Society', 'Grand Roy Ag Society', 'seller', 'farmers', 'Grand Roy, St. John', 'Grenada', '+1-473-444-5123', 'BUS-GRD-003', 'active', NOW() - INTERVAL '14 months'),

('990e8400-e29b-41d4-a716-446655440140', 'Victoria Spice Gardens', 'Victoria Spice Ltd', 'seller', 'farmers', 'Victoria, St. Mark', 'Grenada', '+1-473-445-2389', 'BUS-GRD-004', 'active', NOW() - INTERVAL '20 months'),

('990e8400-e29b-41d4-a716-446655440150', 'Sauteurs Community Farm', 'Sauteurs Farm Co-op', 'seller', 'farmers', 'Sauteurs, St. Patrick', 'Grenada', '+1-473-442-9150', 'BUS-GRD-005', 'active', NOW() - INTERVAL '12 months'),

('990e8400-e29b-41d4-a716-446655440160', 'Grenville Fresh Produce', 'Grenville Produce Ltd', 'seller', 'farmers', 'Grenville, St. Andrew', 'Grenada', '+1-473-442-7458', 'BUS-GRD-006', 'active', NOW() - INTERVAL '22 months'),

('990e8400-e29b-41d4-a716-446655440170', 'Mt. Moritz Estate', 'Mt. Moritz Plantations', 'seller', 'farmers', 'Mt. Moritz, St. Andrew', 'Grenada', '+1-473-442-8345', 'BUS-GRD-007', 'active', NOW() - INTERVAL '15 months'),

('990e8400-e29b-41d4-a716-446655440180', 'Pearls Agricultural Co-op', 'Pearls Farm Co-op', 'seller', 'farmers', 'Pearls, St. Andrew', 'Grenada', '+1-473-442-7234', 'BUS-GRD-008', 'active', NOW() - INTERVAL '10 months'),

('990e8400-e29b-41d4-a716-446655440190', 'Westerhall Estate Farm', 'Westerhall Farms Ltd', 'seller', 'farmers', 'Westerhall, St. David', 'Grenada', '+1-473-444-4350', 'BUS-GRD-009', 'active', NOW() - INTERVAL '24 months'),

('990e8400-e29b-41d4-a716-aabbcc000100', 'La Sagesse Bay Farmers', 'La Sagesse Agriculture', 'seller', 'farmers', 'La Sagesse, St. David', 'Grenada', '+1-473-444-6458', 'BUS-GRD-010', 'active', NOW() - INTERVAL '13 months'),

('990e8400-e29b-41d4-a716-aabbcc000110', 'Annandale Estate', 'Annandale Agricultural Ltd', 'seller', 'farmers', 'Annandale, St. George', 'Grenada', '+1-473-440-2452', 'BUS-GRD-011', 'active', NOW() - INTERVAL '17 months'),

('990e8400-e29b-41d4-a716-aabbcc000120', 'River Antoine Estate', 'River Antoine Rum Estate', 'seller', 'farmers', 'River Antoine, St. Patrick', 'Grenada', '+1-473-442-7109', 'BUS-GRD-012', 'active', NOW() - INTERVAL '26 months'),

('990e8400-e29b-41d4-a716-aabbcc000130', 'Levera Green Farms', 'Levera Organic Farms', 'seller', 'farmers', 'Levera, St. Patrick', 'Grenada', '+1-473-442-9876', 'BUS-GRD-013', 'active', NOW() - INTERVAL '9 months'),

('990e8400-e29b-41d4-a716-aabbcc000140', 'Concord Valley Farmers', 'Concord Farm Association', 'seller', 'farmers', 'Concord, St. John', 'Grenada', '+1-473-444-9234', 'BUS-GRD-014', 'active', NOW() - INTERVAL '19 months'),

('990e8400-e29b-41d4-a716-aabbcc000150', 'Mirabeau Estate Farm', 'Mirabeau Agricultural Estate', 'seller', 'farmers', 'Mirabeau, St. Andrew', 'Grenada', '+1-473-442-8567', 'BUS-GRD-015', 'active', NOW() - INTERVAL '21 months'),

('990e8400-e29b-41d4-a716-aabbcc000160', 'Tivoli Organic Gardens', 'Tivoli Gardens Co-op', 'seller', 'farmers', 'Tivoli, St. Andrew', 'Grenada', '+1-473-442-7890', 'BUS-GRD-016', 'active', NOW() - INTERVAL '11 months'),

('990e8400-e29b-41d4-a716-aabbcc000170', 'Palmiste Highland Farm', 'Palmiste Agriculture', 'seller', 'farmers', 'Palmiste, St. Andrew', 'Grenada', '+1-473-442-9345', 'BUS-GRD-017', 'active', NOW() - INTERVAL '14 months'),

('990e8400-e29b-41d4-a716-aabbcc000180', 'Woburn Community Farm', 'Woburn Farmers Co-op', 'seller', 'farmers', 'Woburn, St. George', 'Grenada', '+1-473-444-2345', 'BUS-GRD-018', 'active', NOW() - INTERVAL '8 months'),

('990e8400-e29b-41d4-a716-aabbcc000190', 'Calivigny Island Growers', 'Calivigny Farms Ltd', 'seller', 'farmers', 'Calivigny, St. George', 'Grenada', '+1-473-444-5678', 'BUS-GRD-019', 'active', NOW() - INTERVAL '16 months'),

('990e8400-e29b-41d4-a716-aabbcc000200', 'Grand Anse Valley Farms', 'Grand Anse Agriculture', 'seller', 'farmers', 'Grand Anse, St. George', 'Grenada', '+1-473-444-8901', 'BUS-GRD-020', 'active', NOW() - INTERVAL '23 months'),

('990e8400-e29b-41d4-a716-aabbcc000210', 'St. Marks Spice Co-op', 'St. Marks Spice Farmers', 'seller', 'farmers', 'St. Marks, St. Mark', 'Grenada', '+1-473-445-3456', 'BUS-GRD-021', 'active', NOW() - INTERVAL '12 months'),

('990e8400-e29b-41d4-a716-aabbcc000220', 'Mount Rich Estate', 'Mount Rich Plantations', 'seller', 'farmers', 'Mount Rich, St. Patrick', 'Grenada', '+1-473-442-9654', 'BUS-GRD-022', 'active', NOW() - INTERVAL '18 months'),

('990e8400-e29b-41d4-a716-aabbcc000230', 'Telescope Bay Farmers', 'Telescope Agriculture', 'seller', 'farmers', 'Telescope, St. Andrew', 'Grenada', '+1-473-442-8123', 'BUS-GRD-023', 'active', NOW() - INTERVAL '10 months'),

('990e8400-e29b-41d4-a716-aabbcc000240', 'Happy Hill Green Farm', 'Happy Hill Organic', 'seller', 'farmers', 'Happy Hill, St. George', 'Grenada', '+1-473-440-3567', 'BUS-GRD-024', 'active', NOW() - INTERVAL '7 months'),

('990e8400-e29b-41d4-a716-aabbcc000250', 'Morne Jaloux Estate', 'Morne Jaloux Agriculture', 'seller', 'farmers', 'Morne Jaloux, St. George', 'Grenada', '+1-473-440-4789', 'BUS-GRD-025', 'active', NOW() - INTERVAL '15 months')
ON CONFLICT (id) DO NOTHING;

-- ==================== PRODUCTS (~100 products) ====================

-- Helper function to generate varied quantities and prices
-- We'll create ~4 products per farmer on average = 100 products

-- Cocoa Products (Major export crop)
INSERT INTO products (
  id, seller_org_id, name, description, sku, category, subcategory,
  base_price, currency, stock_quantity, unit_of_measurement, 
  weight, condition, status, is_organic, created_by, created_at
) 
SELECT 
  gen_random_uuid(),
  org.id,
  'Organic Cocoa Beans',
  'Premium organic cocoa beans, fermented and sun-dried following traditional methods',
  'COCOA-' || substring(org.id::text, 1, 8),
  'Agriculture',
  'Cocoa',
  8.50 + (random() * 2.5),
  'XCD',
  floor(random() * 5000 + 2000)::int,
  'kg',
  1.0,
  'new',
  'active',
  true,
  '880e8400-e29b-41d4-a716-446655440101',
  NOW() - (random() * INTERVAL '12 months')
FROM organizations org
WHERE org.country = 'Grenada' 
  AND org.business_type = 'farmers'
LIMIT 12;

-- Nutmeg Products (Grenada's signature crop)
INSERT INTO products (
  id, seller_org_id, name, description, sku, category, subcategory,
  base_price, currency, stock_quantity, unit_of_measurement,
  weight, condition, status, is_organic, created_by, created_at
)
SELECT 
  gen_random_uuid(),
  org.id,
  'Whole Nutmeg',
  'Grade A whole nutmeg, hand-selected for quality and aroma',
  'NUTMEG-' || substring(org.id::text, 1, 8),
  'Spices',
  'Nutmeg',
  12.00 + (random() * 4.0),
  'XCD',
  floor(random() * 5000 + 2000)::int,
  'kg',
  1.0,
  'new',
  'active',
  false,
  '880e8400-e29b-41d4-a716-446655440101',
  NOW() - (random() * INTERVAL '12 months')
FROM organizations org
WHERE org.country = 'Grenada'
  AND org.business_type = 'farmers'
LIMIT 15;

-- Mace Products (byproduct of nutmeg)
INSERT INTO products (
  id, seller_org_id, name, description, sku, category, subcategory,
  base_price, currency, stock_quantity, unit_of_measurement,
  weight, condition, status, is_organic, created_by, created_at
)
SELECT 
  gen_random_uuid(),
  org.id,
  'Dried Mace',
  'Premium quality dried mace, perfect for culinary and medicinal use',
  'MACE-' || substring(org.id::text, 1, 8),
  'Spices',
  'Mace',
  18.00 + (random() * 6.0),
  'XCD',
  floor(random() * 5000 + 2000)::int,
  'kg',
  1.0,
  'new',
  'active',
  false,
  '880e8400-e29b-41d4-a716-446655440101',
  NOW() - (random() * INTERVAL '12 months')
FROM organizations org
WHERE org.country = 'Grenada'
  AND org.business_type = 'farmers'
LIMIT 10;

-- Banana Products
INSERT INTO products (
  id, seller_org_id, name, description, sku, category, subcategory,
  base_price, currency, stock_quantity, unit_of_measurement,
  weight, condition, status, is_organic, created_by, created_at
)
SELECT 
  gen_random_uuid(),
  org.id,
  'Fresh Bananas',
  'Fresh Cavendish bananas, harvested at optimal ripeness',
  'BANANA-' || substring(org.id::text, 1, 8),
  'Fruits',
  'Banana',
  2.50 + (random() * 1.5),
  'XCD',
  floor(random() * 5000 + 2000)::int,
  'kg',
  1.0,
  'new',
  'active',
  false,
  '880e8400-e29b-41d4-a716-446655440101',
  NOW() - (random() * INTERVAL '6 months')
FROM organizations org
WHERE org.country = 'Grenada'
  AND org.business_type = 'farmers'
LIMIT 14;

-- Coconut Products
INSERT INTO products (
  id, seller_org_id, name, description, sku, category, subcategory,
  base_price, currency, stock_quantity, unit_of_measurement,
  weight, condition, status, is_organic, created_by, created_at
)
SELECT 
  gen_random_uuid(),
  org.id,
  'Fresh Coconuts',
  'Fresh mature coconuts, excellent for water and meat',
  'COCONUT-' || substring(org.id::text, 1, 8),
  'Fruits',
  'Coconut',
  3.00 + (random() * 1.0),
  'XCD',
  floor(random() * 5000 + 2000)::int,
  'piece',
  1.5,
  'new',
  'active',
  false,
  '880e8400-e29b-41d4-a716-446655440101',
  NOW() - (random() * INTERVAL '9 months')
FROM organizations org
WHERE org.country = 'Grenada'
  AND org.business_type = 'farmers'
LIMIT 8;

-- Vegetable Products
INSERT INTO products (
  id, seller_org_id, name, description, sku, category, subcategory,
  base_price, currency, stock_quantity, unit_of_measurement,
  weight, condition, status, is_organic, created_by, created_at
)
SELECT 
  gen_random_uuid(),
  org.id,
  product_name,
  'Fresh ' || product_name || ' grown using sustainable practices',
  upper(replace(product_name, ' ', '-')) || '-' || substring(org.id::text, 1, 8),
  'Vegetables',
  product_name,
  4.00 + (random() * 3.0),
  'XCD',
  floor(random() * 5000 + 2000)::int,
  'kg',
  1.0,
  'new',
  'active',
  true,
  '880e8400-e29b-41d4-a716-446655440101',
  NOW() - (random() * INTERVAL '6 months')
FROM organizations org,
  (VALUES ('Tomato'), ('Lettuce'), ('Cabbage'), ('Cucumber'), ('Bell Pepper'), ('Carrot')) AS v(product_name)
WHERE org.country = 'Grenada'
  AND org.business_type = 'farmers'
LIMIT 18;

-- Spice Products
INSERT INTO products (
  id, seller_org_id, name, description, sku, category, subcategory,
  base_price, currency, stock_quantity, unit_of_measurement,
  weight, condition, status, is_organic, created_by, created_at
)
SELECT 
  gen_random_uuid(),
  org.id,
  spice_name,
  'Premium quality ' || spice_name || ' from Grenada',
  upper(replace(spice_name, ' ', '-')) || '-' || substring(org.id::text, 1, 8),
  'Spices',
  spice_name,
  10.00 + (random() * 8.0),
  'XCD',
  floor(random() * 5000 + 2000)::int,
  'kg',
  1.0,
  'new',
  'active',
  false,
  '880e8400-e29b-41d4-a716-446655440101',
  NOW() - (random() * INTERVAL '12 months')
FROM organizations org,
  (VALUES ('Cinnamon'), ('Cloves'), ('Ginger'), ('Turmeric'), ('Bay Leaves')) AS s(spice_name)
WHERE org.country = 'Grenada'
  AND org.business_type = 'farmers'
LIMIT 12;

-- Root Crops
INSERT INTO products (
  id, seller_org_id, name, description, sku, category, subcategory,
  base_price, currency, stock_quantity, unit_of_measurement,
  weight, condition, status, is_organic, created_by, created_at
)
SELECT 
  gen_random_uuid(),
  org.id,
  crop_name,
  'Fresh ' || crop_name || ', a Grenadian staple root vegetable',
  upper(replace(crop_name, ' ', '-')) || '-' || substring(org.id::text, 1, 8),
  'Root Crops',
  crop_name,
  3.50 + (random() * 2.5),
  'XCD',
  floor(random() * 5000 + 2000)::int,
  'kg',
  1.0,
  'new',
  'active',
  false,
  '880e8400-e29b-41d4-a716-446655440101',
  NOW() - (random() * INTERVAL '8 months')
FROM organizations org,
  (VALUES ('Dasheen'), ('Yam'), ('Sweet Potato'), ('Cassava')) AS c(crop_name)
WHERE org.country = 'Grenada'
  AND org.business_type = 'farmers'
LIMIT 11;

-- ==================== GOVERNMENT TABLES ====================

-- Create government data tables for visualization
INSERT INTO government_tables (
  id, government_org_id, name, description, icon, color,
  data_sources, fields, views, is_public, created_by, created_at
) VALUES
-- Farmers Registry Table
('aa0e8400-e29b-41d4-a716-446655440110',
 '770e8400-e29b-41d4-a716-446655440100',
 'Farmers Registry',
 'Complete registry of all registered farmers in Grenada with detailed farm information',
 '🌾',
 '#10b981',
 '[{"id": "farmers", "table": "organizations", "filters": {"country": "Grenada", "account_type": "seller", "business_type": "farmers"}}]'::jsonb,
 '[{"id": "name", "name": "Farm Name", "type": "text"}, {"id": "total_acreage", "name": "Total Acreage", "type": "number"}, {"id": "utilized_acreage", "name": "Utilized Acreage", "type": "number"}, {"id": "crops", "name": "Crops", "type": "multi_select"}, {"id": "status", "name": "Status", "type": "select"}]'::jsonb,
 '[{"id": "default", "name": "All Farmers", "type": "table"}]'::jsonb,
 true,
 '880e8400-e29b-41d4-a716-446655440101',
 NOW() - INTERVAL '6 months'),

-- Products Catalog Table
('aa0e8400-e29b-41d4-a716-446655440120',
 '770e8400-e29b-41d4-a716-446655440100',
 'Agricultural Products Catalog',
 'Comprehensive catalog of all agricultural products available from Grenadian farmers',
 '🥬',
 '#3b82f6',
 '[{"id": "products", "table": "products", "filters": {}}]'::jsonb,
 '[{"id": "name", "name": "Product Name", "type": "text"}, {"id": "category", "name": "Category", "type": "select"}, {"id": "stock_quantity", "name": "Stock Quantity", "type": "number"}, {"id": "base_price", "name": "Price", "type": "currency"}, {"id": "seller_org_id", "name": "Vendor", "type": "relation"}]'::jsonb,
 '[{"id": "default", "name": "All Products", "type": "table"}, {"id": "by_category", "name": "By Category", "type": "table", "groupBy": "category"}]'::jsonb,
 true,
 '880e8400-e29b-41d4-a716-446655440101',
 NOW() - INTERVAL '6 months'),

-- Production Tracking Table
('aa0e8400-e29b-41d4-a716-446655440130',
 '770e8400-e29b-41d4-a716-446655440100',
 'Production Tracking',
 'Track production volumes and trends across different crops and regions',
 '📊',
 '#8b5cf6',
 '[{"id": "products", "table": "products", "filters": {}}]'::jsonb,
 '[{"id": "category", "name": "Crop Category", "type": "select"}, {"id": "total_quantity", "name": "Total Production", "type": "number"}, {"id": "avg_price", "name": "Average Price", "type": "currency"}]'::jsonb,
 '[{"id": "default", "name": "Overview", "type": "table"}]'::jsonb,
  false,
  '880e8400-e29b-41d4-a716-446655440101',
  NOW() - INTERVAL '5 months')
ON CONFLICT (id) DO NOTHING;

-- ==================== GOVERNMENT CHARTS ====================

INSERT INTO government_charts (
  id, government_org_id, table_id, name, description, chart_type,
  config, data_config, width, height, position, is_active, created_by, created_at
) VALUES
-- Total Farmers by Parish (Pie Chart)
('bb0e8400-e29b-41d4-a716-446655440110',
 '770e8400-e29b-41d4-a716-446655440100',
 'aa0e8400-e29b-41d4-a716-446655440110',
 'Farmers Distribution by Parish',
 'Distribution of registered farmers across Grenadian parishes',
 'pie',
 '{"colors": ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"]}'::jsonb,
 '{"groupBy": "address", "aggregation": "count"}'::jsonb,
 6,
 4,
 '{"x": 0, "y": 0}'::jsonb,
 true,
 '880e8400-e29b-41d4-a716-446655440101',
 NOW() - INTERVAL '5 months'),

-- Production Volume by Crop (Bar Chart)
('bb0e8400-e29b-41d4-a716-446655440120',
 '770e8400-e29b-41d4-a716-446655440100',
 'aa0e8400-e29b-41d4-a716-446655440120',
 'Production Volume by Crop Type',
 'Total production volume for major crops in Grenada',
 'bar',
 '{"orientation": "vertical", "colors": ["#10b981"]}'::jsonb,
 '{"groupBy": "category", "aggregation": "sum", "field": "stock_quantity"}'::jsonb,
 6,
 4,
 '{"x": 6, "y": 0}'::jsonb,
 true,
 '880e8400-e29b-41d4-a716-446655440101',
 NOW() - INTERVAL '5 months'),

-- Price Trends Over Time (Line Chart)
('bb0e8400-e29b-41d4-a716-446655440130',
 '770e8400-e29b-41d4-a716-446655440100',
 'aa0e8400-e29b-41d4-a716-446655440120',
 'Average Price Trends',
 'Historical price trends for major agricultural products',
 'line',
 '{"smooth": true, "colors": ["#3b82f6", "#10b981", "#f59e0b"]}'::jsonb,
 '{"groupBy": "created_at", "aggregation": "avg", "field": "base_price", "timeframe": "month"}'::jsonb,
 12,
 4,
 '{"x": 0, "y": 4}'::jsonb,
 true,
 '880e8400-e29b-41d4-a716-446655440101',
 NOW() - INTERVAL '5 months'),

-- Total Acreage Metric
('bb0e8400-e29b-41d4-a716-446655440140',
 '770e8400-e29b-41d4-a716-446655440100',
 'aa0e8400-e29b-41d4-a716-446655440110',
 'Total Agricultural Acreage',
 'Total acreage under cultivation in Grenada',
 'metric',
 '{"format": "number", "suffix": " acres", "color": "#10b981"}'::jsonb,
 '{"aggregation": "sum", "field": "total_acreage"}'::jsonb,
 3,
 2,
 '{"x": 0, "y": 8}'::jsonb,
 true,
 '880e8400-e29b-41d4-a716-446655440101',
 NOW() - INTERVAL '5 months'),

-- Total Farmers Metric
('bb0e8400-e29b-41d4-a716-446655440150',
 '770e8400-e29b-41d4-a716-446655440100',
 'aa0e8400-e29b-41d4-a716-446655440110',
 'Total Registered Farmers',
 'Total number of registered farmers in Grenada',
 'metric',
 '{"format": "number", "color": "#3b82f6"}'::jsonb,
 '{"aggregation": "count"}'::jsonb,
 3,
 2,
 '{"x": 3, "y": 8}'::jsonb,
 true,
 '880e8400-e29b-41d4-a716-446655440101',
 NOW() - INTERVAL '5 months'),

-- Total Products Metric
('bb0e8400-e29b-41d4-a716-446655440160',
 '770e8400-e29b-41d4-a716-446655440100',
 'aa0e8400-e29b-41d4-a716-446655440120',
 'Total Products Available',
 'Total number of products in the marketplace',
 'metric',
 '{"format": "number", "color": "#8b5cf6"}'::jsonb,
 '{"aggregation": "count"}'::jsonb,
 3,
 2,
 '{"x": 6, "y": 8}'::jsonb,
 true,
 '880e8400-e29b-41d4-a716-446655440101',
 NOW() - INTERVAL '5 months'),

-- Market Value Metric
('bb0e8400-e29b-41d4-a716-446655440170',
 '770e8400-e29b-41d4-a716-446655440100',
 'aa0e8400-e29b-41d4-a716-446655440120',
 'Total Market Value',
 'Total estimated market value of all available products',
 'metric',
 '{"format": "currency", "currency": "XCD", "color": "#f59e0b"}'::jsonb,
 '{"aggregation": "sum", "field": "base_price"}'::jsonb,
 3,
 2,
 '{"x": 9, "y": 8}'::jsonb,
  true,
  '880e8400-e29b-41d4-a716-446655440101',
  NOW() - INTERVAL '5 months')
ON CONFLICT (id) DO NOTHING;

-- ==================== GOVERNMENT REPORTS ====================

INSERT INTO government_reports (
  id, government_org_id, name, description, tables, charts, format, status, created_by, created_at
) VALUES
-- Quarterly Production Report
('cc0e8400-e29b-41d4-a716-446655440110',
 '770e8400-e29b-41d4-a716-446655440100',
 'Q4 2024 Agricultural Production Report',
 'Comprehensive quarterly report on agricultural production, market trends, and farmer statistics',
 '["aa0e8400-e29b-41d4-a716-446655440110", "aa0e8400-e29b-41d4-a716-446655440120", "aa0e8400-e29b-41d4-a716-446655440130"]'::jsonb,
 '["bb0e8400-e29b-41d4-a716-446655440110", "bb0e8400-e29b-41d4-a716-446655440120", "bb0e8400-e29b-41d4-a716-446655440130"]'::jsonb,
 'pdf',
 'completed',
 '880e8400-e29b-41d4-a716-446655440101',
 NOW() - INTERVAL '3 months'),

-- Annual Spice Export Report
('cc0e8400-e29b-41d4-a716-446655440120',
 '770e8400-e29b-41d4-a716-446655440100',
 '2024 Spice Export Analysis',
 'Annual report on spice production and export potential for nutmeg, mace, cinnamon, and other spices',
 '["aa0e8400-e29b-41d4-a716-446655440120"]'::jsonb,
 '["bb0e8400-e29b-41d4-a716-446655440120", "bb0e8400-e29b-41d4-a716-446655440130"]'::jsonb,
 'pdf',
 'completed',
 '880e8400-e29b-41d4-a716-446655440102',
 NOW() - INTERVAL '2 months'),

-- Farmer Registration Summary
('cc0e8400-e29b-41d4-a716-446655440130',
 '770e8400-e29b-41d4-a716-446655440100',
 'Farmer Registration Summary - 2024',
 'Summary of new farmer registrations and agricultural land utilization',
 '["aa0e8400-e29b-41d4-a716-446655440110"]'::jsonb,
 '["bb0e8400-e29b-41d4-a716-446655440110", "bb0e8400-e29b-41d4-a716-446655440140", "bb0e8400-e29b-41d4-a716-446655440150"]'::jsonb,
 'xlsx',
 'completed',
 '880e8400-e29b-41d4-a716-446655440104',
 NOW() - INTERVAL '1 month'),

-- Market Intelligence Report
('cc0e8400-e29b-41d4-a716-446655440140',
 '770e8400-e29b-41d4-a716-446655440100',
 'Market Intelligence Report - January 2025',
 'Monthly market intelligence including price trends, supply-demand analysis, and market opportunities',
 '["aa0e8400-e29b-41d4-a716-446655440120", "aa0e8400-e29b-41d4-a716-446655440130"]'::jsonb,
 '["bb0e8400-e29b-41d4-a716-446655440130", "bb0e8400-e29b-41d4-a716-446655440170"]'::jsonb,
 'pdf',
  'draft',
  '880e8400-e29b-41d4-a716-446655440104',
  NOW() - INTERVAL '1 week')
ON CONFLICT (id) DO NOTHING;

-- ==================== SAMPLE ORDERS/TRANSACTIONS ====================
-- Create some sample orders to populate market intelligence data

-- Note: These would typically come from buyer organizations
-- For now, we'll create a few sample buyer orgs for the transactions

INSERT INTO organizations (
  id, name, business_name, account_type, business_type, address, country,
  phone_number, status, created_at
) VALUES
('dd0e8400-e29b-41d4-a716-446655440110',
 'Grand Anse Hotel & Spa',
 'Grand Anse Hotel Group',
 'buyer',
 'hotels',
 'Grand Anse Beach, St. George',
 'Grenada',
 '+1-473-444-4371',
 'active',
 NOW() - INTERVAL '1 year'),

('dd0e8400-e29b-41d4-a716-446655440120',
 'True Blue Bay Resort',
 'True Blue Hospitality Ltd',
 'buyer',
 'hotels',
 'Old Mill Avenue, True Blue',
 'Grenada',
 '+1-473-443-8783',
 'active',
 NOW() - INTERVAL '1 year'),

('dd0e8400-e29b-41d4-a716-446655440130',
 'Caribbean Spice Exporters',
 'Caribbean Spice Export Ltd',
 'buyer',
 'exporters',
 'Melville Street, St. George',
 'Grenada',
 '+1-473-440-2345',
 'active',
 NOW() - INTERVAL '2 years')
ON CONFLICT (id) DO NOTHING;

-- Create sample orders
INSERT INTO orders (
  id, buyer_org_id, seller_org_id, products, 
  subtotal, tax, shipping_cost, total_amount,
  status, currency, created_at, updated_at
)
SELECT 
  gen_random_uuid(),
  buyer_org.id,
  seller_org.id,
  jsonb_build_array(
    jsonb_build_object(
      'product_id', p.id,
      'name', p.name,
      'quantity', floor(random() * 100 + 20)::int,
      'unit_price', p.base_price,
      'total', (floor(random() * 100 + 20) * p.base_price)
    )
  ),
  floor(random() * 2000 + 500)::numeric,
  floor(random() * 200 + 50)::numeric,
  floor(random() * 100 + 20)::numeric,
  floor(random() * 2300 + 570)::numeric,
  CASE floor(random() * 4)
    WHEN 0 THEN 'completed'
    WHEN 1 THEN 'completed'
    WHEN 2 THEN 'processing'
    ELSE 'pending'
  END,
  'XCD',
  NOW() - (random() * INTERVAL '90 days'),
  NOW() - (random() * INTERVAL '85 days')
FROM 
  (SELECT id FROM organizations WHERE country = 'Grenada' AND account_type = 'buyer' ORDER BY random() LIMIT 3) buyer_org,
  (SELECT id FROM organizations WHERE country = 'Grenada' AND account_type = 'seller' ORDER BY random() LIMIT 10) seller_org,
  LATERAL (
    SELECT id, name, base_price 
    FROM products 
    WHERE seller_org_id = seller_org.id 
    ORDER BY random() 
    LIMIT 1
  ) p
LIMIT 35
ON CONFLICT (id) DO NOTHING;

-- ==================== COMPLETION MESSAGE ====================

DO $$
BEGIN
  RAISE NOTICE '✅ Grenada Government seed data created successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Summary:';
  RAISE NOTICE '  - 1 Government Organization (Ministry of Agriculture)';
  RAISE NOTICE '  - 4 Government Users (Minister, Procurement Officer, Inspector, Analyst)';
  RAISE NOTICE '  - 25 Farmer Organizations across all parishes';
  RAISE NOTICE '  - ~100 Agricultural Products (Cocoa, Nutmeg, Spices, Fruits, Vegetables)';
  RAISE NOTICE '  - 3 Government Data Tables (Farmers Registry, Products Catalog, Production Tracking)';
  RAISE NOTICE '  - 7 Government Charts (Distribution, Production, Trends, Metrics)';
  RAISE NOTICE '  - 4 Government Reports (Quarterly, Annual, Registration, Market Intelligence)';
  RAISE NOTICE '  - 3 Buyer Organizations';
  RAISE NOTICE '  - 35 Sample Orders/Transactions';
  RAISE NOTICE '';
  RAISE NOTICE '🔐 Test Login Credentials:';
  RAISE NOTICE '  Admin: minister@moagri.gov.gd';
  RAISE NOTICE '  Procurement: procurement@moagri.gov.gd';
  RAISE NOTICE '  Inspector: inspector@moagri.gov.gd';
  RAISE NOTICE '  Analyst: analyst@moagri.gov.gd';
  RAISE NOTICE '';
  RAISE NOTICE '🌴 The government dashboard should now display realistic data!';
END $$;
