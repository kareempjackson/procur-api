-- Comprehensive seed migration for Procur platform
-- This migration populates all tables with realistic sample data for development and testing

-- ==================== USERS ====================

-- Insert sample users for different account types
INSERT INTO users (
  id, email, password, fullname, phone_number, profile_img, personal_address, country,
  role, individual_account_type, email_verified, is_active
) VALUES
-- Government users
('550e8400-e29b-41d4-a716-446655440001', 'admin@agriculture.gov', '$2b$10$hash1', 'Sarah Johnson', '+1-555-0101', 'https://example.com/profiles/sarah.jpg', '123 Government St, Washington DC', 'United States', 'admin', NULL, true, true),
('550e8400-e29b-41d4-a716-446655440002', 'inspector@agriculture.gov', '$2b$10$hash2', 'Michael Chen', '+1-555-0102', 'https://example.com/profiles/michael.jpg', '456 Federal Ave, Washington DC', 'United States', 'user', NULL, true, true),
('550e8400-e29b-41d4-a716-446655440003', 'procurement@agriculture.gov', '$2b$10$hash3', 'Emily Rodriguez', '+1-555-0103', 'https://example.com/profiles/emily.jpg', '789 Capitol Hill, Washington DC', 'United States', 'user', NULL, true, true),

-- Seller users (Farmers)
('550e8400-e29b-41d4-a716-446655440004', 'john@greenfarms.com', '$2b$10$hash4', 'John Smith', '+1-555-0201', 'https://example.com/profiles/john.jpg', '100 Farm Road, Iowa', 'United States', 'user', NULL, true, true),
('550e8400-e29b-41d4-a716-446655440005', 'mary@greenfarms.com', '$2b$10$hash5', 'Mary Smith', '+1-555-0202', 'https://example.com/profiles/mary.jpg', '100 Farm Road, Iowa', 'United States', 'user', NULL, true, true),
('550e8400-e29b-41d4-a716-446655440006', 'carlos@organicvalley.com', '$2b$10$hash6', 'Carlos Martinez', '+1-555-0301', 'https://example.com/profiles/carlos.jpg', '200 Valley Drive, California', 'United States', 'user', NULL, true, true),
('550e8400-e29b-41d4-a716-446655440007', 'lisa@oceanfresh.com', '$2b$10$hash7', 'Lisa Thompson', '+1-555-0401', 'https://example.com/profiles/lisa.jpg', '300 Harbor Blvd, Maine', 'United States', 'user', NULL, true, true),

-- Buyer users (Restaurants/Hotels)
('550e8400-e29b-41d4-a716-446655440008', 'chef@finedining.com', '$2b$10$hash8', 'Antoine Dubois', '+1-555-0501', 'https://example.com/profiles/antoine.jpg', '400 Culinary Ave, New York', 'United States', 'user', NULL, true, true),
('550e8400-e29b-41d4-a716-446655440009', 'manager@grandhotel.com', '$2b$10$hash9', 'Jennifer Williams', '+1-555-0601', 'https://example.com/profiles/jennifer.jpg', '500 Luxury Lane, California', 'United States', 'user', NULL, true, true),
('550e8400-e29b-41d4-a716-446655440010', 'buyer@freshmarket.com', '$2b$10$hash10', 'David Kim', '+1-555-0701', 'https://example.com/profiles/david.jpg', '600 Market Street, Texas', 'United States', 'user', NULL, true, true),

-- Individual account users (Drivers, QA)
('550e8400-e29b-41d4-a716-446655440011', 'driver1@logistics.com', '$2b$10$hash11', 'Robert Brown', '+1-555-0801', 'https://example.com/profiles/robert.jpg', '700 Transport Way, Illinois', 'United States', 'user', 'driver', true, true),
('550e8400-e29b-41d4-a716-446655440012', 'qa1@qualitycheck.com', '$2b$10$hash12', 'Amanda Davis', '+1-555-0901', 'https://example.com/profiles/amanda.jpg', '800 Quality Blvd, Florida', 'United States', 'user', 'qa', true, true);

-- ==================== ORGANIZATIONS ====================

-- Insert sample organizations
INSERT INTO organizations (
  id, name, business_name, account_type, business_type, address, country, phone_number,
  business_registration_number, tax_id, government_level, department, jurisdiction, status
) VALUES
-- Government organizations
('660e8400-e29b-41d4-a716-446655440001', 'US Department of Agriculture', 'USDA', 'government', 'general', '1400 Independence Ave SW, Washington DC 20250', 'United States', '+1-202-720-2791', 'GOV-USDA-001', 'TAX-GOV-001', 'federal', 'agriculture', 'United States', 'active'),
('660e8400-e29b-41d4-a716-446655440002', 'California Department of Food and Agriculture', 'CDFA', 'government', 'general', '1220 N Street, Sacramento CA 95814', 'United States', '+1-916-654-0433', 'GOV-CDFA-001', 'TAX-GOV-002', 'state', 'agriculture', 'California', 'active'),

-- Seller organizations (Farmers)
('660e8400-e29b-41d4-a716-446655440003', 'Green Valley Farms', 'Green Valley Farms LLC', 'seller', 'farmers', '100 Farm Road, Cedar Rapids IA 52402', 'United States', '+1-319-555-0200', 'BUS-GVF-001', 'TAX-GVF-001', NULL, NULL, NULL, 'active'),
('660e8400-e29b-41d4-a716-446655440004', 'Organic Valley Co-op', 'Organic Valley Cooperative', 'seller', 'farmers', '200 Valley Drive, Fresno CA 93721', 'United States', '+1-559-555-0300', 'BUS-OVC-001', 'TAX-OVC-001', NULL, NULL, NULL, 'active'),
('660e8400-e29b-41d4-a716-446655440005', 'Ocean Fresh Seafood', 'Ocean Fresh Seafood Inc', 'seller', 'fishermen', '300 Harbor Blvd, Portland ME 04101', 'United States', '+1-207-555-0400', 'BUS-OFS-001', 'TAX-OFS-001', NULL, NULL, NULL, 'active'),
('660e8400-e29b-41d4-a716-446655440006', 'Midwest Manufacturing', 'Midwest Manufacturing Corp', 'seller', 'manufacturers', '400 Industrial Pkwy, Detroit MI 48201', 'United States', '+1-313-555-0500', 'BUS-MMC-001', 'TAX-MMC-001', NULL, NULL, NULL, 'active'),

-- Buyer organizations
('660e8400-e29b-41d4-a716-446655440007', 'Fine Dining Restaurant Group', 'Fine Dining Group LLC', 'buyer', 'restaurants', '400 Culinary Ave, New York NY 10001', 'United States', '+1-212-555-0500', 'BUS-FDG-001', 'TAX-FDG-001', NULL, NULL, NULL, 'active'),
('660e8400-e29b-41d4-a716-446655440008', 'Grand Hotel Chain', 'Grand Hotel International', 'buyer', 'hotels', '500 Luxury Lane, Beverly Hills CA 90210', 'United States', '+1-310-555-0600', 'BUS-GHC-001', 'TAX-GHC-001', NULL, NULL, NULL, 'active'),
('660e8400-e29b-41d4-a716-446655440009', 'Fresh Market Supermarkets', 'Fresh Market Inc', 'buyer', 'supermarkets', '600 Market Street, Austin TX 73301', 'United States', '+1-512-555-0700', 'BUS-FMS-001', 'TAX-FMS-001', NULL, NULL, NULL, 'active'),
('660e8400-e29b-41d4-a716-446655440010', 'Global Export Partners', 'Global Export Partners LLC', 'buyer', 'exporters', '700 Trade Center, Miami FL 33101', 'United States', '+1-305-555-0800', 'BUS-GEP-001', 'TAX-GEP-001', NULL, NULL, NULL, 'active');

-- ==================== ORGANIZATION USERS ====================

-- Link users to organizations with appropriate roles
-- Note: Default roles are automatically created by triggers, so we need to get their IDs

-- Government organization memberships
INSERT INTO organization_users (organization_id, user_id, role_id, is_active, joined_at)
SELECT 
  '660e8400-e29b-41d4-a716-446655440001',
  '550e8400-e29b-41d4-a716-446655440001',
  r.id,
  true,
  NOW() - INTERVAL '90 days'
FROM organization_roles r 
WHERE r.organization_id = '660e8400-e29b-41d4-a716-446655440001' AND r.name = 'admin';

INSERT INTO organization_users (organization_id, user_id, role_id, is_active, joined_at)
SELECT 
  '660e8400-e29b-41d4-a716-446655440001',
  '550e8400-e29b-41d4-a716-446655440002',
  r.id,
  true,
  NOW() - INTERVAL '60 days'
FROM organization_roles r 
WHERE r.organization_id = '660e8400-e29b-41d4-a716-446655440001' AND r.name = 'inspector';

INSERT INTO organization_users (organization_id, user_id, role_id, is_active, joined_at)
SELECT 
  '660e8400-e29b-41d4-a716-446655440001',
  '550e8400-e29b-41d4-a716-446655440003',
  r.id,
  true,
  NOW() - INTERVAL '45 days'
FROM organization_roles r 
WHERE r.organization_id = '660e8400-e29b-41d4-a716-446655440001' AND r.name = 'procurement_officer';

-- Seller organization memberships
INSERT INTO organization_users (organization_id, user_id, role_id, is_active, joined_at)
SELECT 
  '660e8400-e29b-41d4-a716-446655440003',
  '550e8400-e29b-41d4-a716-446655440004',
  r.id,
  true,
  NOW() - INTERVAL '120 days'
FROM organization_roles r 
WHERE r.organization_id = '660e8400-e29b-41d4-a716-446655440003' AND r.name = 'admin';

INSERT INTO organization_users (organization_id, user_id, role_id, is_active, joined_at)
SELECT 
  '660e8400-e29b-41d4-a716-446655440003',
  '550e8400-e29b-41d4-a716-446655440005',
  r.id,
  true,
  NOW() - INTERVAL '100 days'
FROM organization_roles r 
WHERE r.organization_id = '660e8400-e29b-41d4-a716-446655440003' AND r.name = 'sales_manager';

INSERT INTO organization_users (organization_id, user_id, role_id, is_active, joined_at)
SELECT 
  '660e8400-e29b-41d4-a716-446655440004',
  '550e8400-e29b-41d4-a716-446655440006',
  r.id,
  true,
  NOW() - INTERVAL '80 days'
FROM organization_roles r 
WHERE r.organization_id = '660e8400-e29b-41d4-a716-446655440004' AND r.name = 'admin';

INSERT INTO organization_users (organization_id, user_id, role_id, is_active, joined_at)
SELECT 
  '660e8400-e29b-41d4-a716-446655440005',
  '550e8400-e29b-41d4-a716-446655440007',
  r.id,
  true,
  NOW() - INTERVAL '70 days'
FROM organization_roles r 
WHERE r.organization_id = '660e8400-e29b-41d4-a716-446655440005' AND r.name = 'admin';

-- Buyer organization memberships
INSERT INTO organization_users (organization_id, user_id, role_id, is_active, joined_at)
SELECT 
  '660e8400-e29b-41d4-a716-446655440007',
  '550e8400-e29b-41d4-a716-446655440008',
  r.id,
  true,
  NOW() - INTERVAL '150 days'
FROM organization_roles r 
WHERE r.organization_id = '660e8400-e29b-41d4-a716-446655440007' AND r.name = 'admin';

INSERT INTO organization_users (organization_id, user_id, role_id, is_active, joined_at)
SELECT 
  '660e8400-e29b-41d4-a716-446655440008',
  '550e8400-e29b-41d4-a716-446655440009',
  r.id,
  true,
  NOW() - INTERVAL '130 days'
FROM organization_roles r 
WHERE r.organization_id = '660e8400-e29b-41d4-a716-446655440008' AND r.name = 'admin';

INSERT INTO organization_users (organization_id, user_id, role_id, is_active, joined_at)
SELECT 
  '660e8400-e29b-41d4-a716-446655440009',
  '550e8400-e29b-41d4-a716-446655440010',
  r.id,
  true,
  NOW() - INTERVAL '110 days'
FROM organization_roles r 
WHERE r.organization_id = '660e8400-e29b-41d4-a716-446655440009' AND r.name = 'admin';

-- ==================== PRODUCTS ====================

-- Insert sample products from sellers
INSERT INTO products (
  id, seller_org_id, name, description, short_description, sku, category, subcategory,
  base_price, currency, stock_quantity, unit_of_measurement, weight, condition,
  status, is_featured, is_organic, is_local, brand, created_by, slug
) VALUES
-- Green Valley Farms products
('770e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440003', 'Organic Sweet Corn', 'Fresh organic sweet corn harvested daily from our Iowa fields. Non-GMO, pesticide-free, and bursting with natural sweetness.', 'Fresh organic sweet corn from Iowa', 'GVF-CORN-001', 'vegetables', 'corn', 4.50, 'USD', 500, 'dozen', 2.5, 'new', 'active', true, true, true, 'Green Valley', '550e8400-e29b-41d4-a716-446655440004', 'organic-sweet-corn'),
('770e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440003', 'Farm Fresh Tomatoes', 'Vine-ripened heirloom tomatoes grown in rich Iowa soil. Perfect for restaurants and fresh markets.', 'Vine-ripened heirloom tomatoes', 'GVF-TOM-001', 'vegetables', 'tomatoes', 6.75, 'USD', 200, 'lb', 1.0, 'new', 'active', true, true, true, 'Green Valley', '550e8400-e29b-41d4-a716-446655440004', 'farm-fresh-tomatoes'),
('770e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440003', 'Premium Soybeans', 'High-quality soybeans perfect for processing and export. Consistent moisture content and excellent protein levels.', 'Premium quality soybeans', 'GVF-SOY-001', 'grains', 'soybeans', 15.25, 'USD', 1000, 'kg', 1.0, 'new', 'active', false, false, true, 'Green Valley', '550e8400-e29b-41d4-a716-446655440004', 'premium-soybeans'),

-- Organic Valley Co-op products
('770e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440004', 'Organic Avocados', 'Creamy, nutrient-rich organic avocados from California. Perfect ripeness guaranteed.', 'Organic California avocados', 'OVC-AVO-001', 'fruits', 'avocados', 3.25, 'USD', 300, 'piece', 0.2, 'new', 'active', true, true, true, 'Organic Valley', '550e8400-e29b-41d4-a716-446655440006', 'organic-avocados'),
('770e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440004', 'Organic Almonds', 'Raw organic almonds from sustainable California orchards. Rich in protein and healthy fats.', 'Raw organic almonds', 'OVC-ALM-001', 'nuts', 'almonds', 12.50, 'USD', 150, 'lb', 1.0, 'new', 'active', true, true, true, 'Organic Valley', '550e8400-e29b-41d4-a716-446655440006', 'organic-almonds'),
('770e8400-e29b-41d4-a716-446655440006', '660e8400-e29b-41d4-a716-446655440004', 'Organic Strawberries', 'Sweet, juicy organic strawberries picked at peak ripeness. Perfect for desserts and fresh eating.', 'Fresh organic strawberries', 'OVC-STR-001', 'fruits', 'berries', 8.75, 'USD', 100, 'lb', 1.0, 'new', 'active', true, true, true, 'Organic Valley', '550e8400-e29b-41d4-a716-446655440006', 'organic-strawberries'),

-- Ocean Fresh Seafood products
('770e8400-e29b-41d4-a716-446655440007', '660e8400-e29b-41d4-a716-446655440005', 'Atlantic Salmon Fillets', 'Fresh Atlantic salmon fillets, sustainably caught in Maine waters. Rich in omega-3 fatty acids.', 'Fresh Atlantic salmon fillets', 'OFS-SAL-001', 'seafood', 'salmon', 24.99, 'USD', 80, 'lb', 1.0, 'new', 'active', true, false, true, 'Ocean Fresh', '550e8400-e29b-41d4-a716-446655440007', 'atlantic-salmon-fillets'),
('770e8400-e29b-41d4-a716-446655440008', '660e8400-e29b-41d4-a716-446655440005', 'Maine Lobster Tails', 'Premium Maine lobster tails, flash-frozen to preserve freshness. Perfect for fine dining.', 'Premium Maine lobster tails', 'OFS-LOB-001', 'seafood', 'lobster', 35.50, 'USD', 50, 'piece', 0.3, 'new', 'active', true, false, true, 'Ocean Fresh', '550e8400-e29b-41d4-a716-446655440007', 'maine-lobster-tails'),
('770e8400-e29b-41d4-a716-446655440009', '660e8400-e29b-41d4-a716-446655440005', 'Fresh Scallops', 'Day-boat scallops from the Gulf of Maine. Sweet, tender, and perfect for searing.', 'Fresh day-boat scallops', 'OFS-SCA-001', 'seafood', 'scallops', 28.75, 'USD', 30, 'lb', 1.0, 'new', 'active', true, false, true, 'Ocean Fresh', '550e8400-e29b-41d4-a716-446655440007', 'fresh-scallops'),

-- Midwest Manufacturing products
('770e8400-e29b-41d4-a716-446655440010', '660e8400-e29b-41d4-a716-446655440006', 'Organic Pasta Sauce', 'Premium organic pasta sauce made with vine-ripened tomatoes and fresh herbs.', 'Premium organic pasta sauce', 'MMC-PAS-001', 'processed_foods', 'sauces', 5.99, 'USD', 500, 'piece', 0.7, 'new', 'active', false, true, false, 'Midwest Kitchen', '550e8400-e29b-41d4-a716-446655440004', 'organic-pasta-sauce'),
('770e8400-e29b-41d4-a716-446655440011', '660e8400-e29b-41d4-a716-446655440006', 'Artisan Bread Mix', 'Professional-grade artisan bread mix for restaurants and bakeries. Just add water and yeast.', 'Artisan bread mix for professionals', 'MMC-BRE-001', 'processed_foods', 'baking', 8.25, 'USD', 200, 'kg', 1.0, 'new', 'active', false, false, false, 'Midwest Kitchen', '550e8400-e29b-41d4-a716-446655440004', 'artisan-bread-mix');

-- ==================== PRODUCT IMAGES ====================

-- Add product images
INSERT INTO product_images (product_id, image_url, alt_text, display_order, is_primary) VALUES
('770e8400-e29b-41d4-a716-446655440001', 'https://example.com/products/corn-1.jpg', 'Fresh organic sweet corn', 0, true),
('770e8400-e29b-41d4-a716-446655440001', 'https://example.com/products/corn-2.jpg', 'Corn field at Green Valley Farms', 1, false),
('770e8400-e29b-41d4-a716-446655440002', 'https://example.com/products/tomatoes-1.jpg', 'Vine-ripened heirloom tomatoes', 0, true),
('770e8400-e29b-41d4-a716-446655440004', 'https://example.com/products/avocados-1.jpg', 'Organic California avocados', 0, true),
('770e8400-e29b-41d4-a716-446655440007', 'https://example.com/products/salmon-1.jpg', 'Fresh Atlantic salmon fillets', 0, true),
('770e8400-e29b-41d4-a716-446655440008', 'https://example.com/products/lobster-1.jpg', 'Premium Maine lobster tails', 0, true);

-- ==================== BUYER ADDRESSES ====================

-- Check if buyer_addresses table exists before inserting
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'buyer_addresses') THEN
    -- Add buyer addresses
    INSERT INTO buyer_addresses (
  buyer_org_id, label, street_address, city, state, postal_code, country,
  contact_name, contact_phone, is_default, is_billing, is_shipping
) VALUES
('660e8400-e29b-41d4-a716-446655440007', 'Main Restaurant', '400 Culinary Ave', 'New York', 'NY', '10001', 'United States', 'Antoine Dubois', '+1-212-555-0500', true, true, true),
('660e8400-e29b-41d4-a716-446655440007', 'Secondary Location', '450 Broadway', 'New York', 'NY', '10013', 'United States', 'Sous Chef Marie', '+1-212-555-0501', false, false, true),
('660e8400-e29b-41d4-a716-446655440008', 'Hotel Main Kitchen', '500 Luxury Lane', 'Beverly Hills', 'CA', '90210', 'United States', 'Jennifer Williams', '+1-310-555-0600', true, true, true),
('660e8400-e29b-41d4-a716-446655440009', 'Distribution Center', '600 Market Street', 'Austin', 'TX', '73301', 'United States', 'David Kim', '+1-512-555-0700', true, true, true),
('660e8400-e29b-41d4-a716-446655440009', 'Store #2', '650 Commerce Blvd', 'Austin', 'TX', '73302', 'United States', 'Store Manager', '+1-512-555-0702', false, false, true);
  END IF;
END $$;

-- ==================== BUYER PREFERENCES ====================

-- Check if buyer_preferences table exists before inserting
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'buyer_preferences') THEN
    -- Add buyer preferences
    INSERT INTO buyer_preferences (
  buyer_org_id, email_notifications, sms_notifications, order_updates, price_alerts,
  new_product_alerts, preferred_currency, auto_reorder, public_reviews, share_purchase_history
) VALUES
('660e8400-e29b-41d4-a716-446655440007', true, false, true, true, true, 'USD', false, true, false),
('660e8400-e29b-41d4-a716-446655440008', true, true, true, false, true, 'USD', true, true, false),
('660e8400-e29b-41d4-a716-446655440009', true, false, true, true, false, 'USD', true, false, true),
('660e8400-e29b-41d4-a716-446655440010', false, false, true, false, false, 'USD', false, false, false);
  END IF;
END $$;

-- ==================== SHOPPING CARTS ====================

-- Check if shopping_carts table exists before inserting
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'shopping_carts') THEN
    -- Create shopping carts for buyers
    INSERT INTO shopping_carts (id, buyer_org_id, buyer_user_id) VALUES
    ('880e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440008'),
    ('880e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440009'),
    ('880e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440010');
  END IF;
END $$;

-- Check if cart_items table exists before inserting cart items
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cart_items') 
     AND EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'shopping_carts') THEN
    -- Add items to shopping carts
    INSERT INTO cart_items (cart_id, product_id, quantity) VALUES
    ('880e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440007', 5), -- Salmon fillets
    ('880e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440008', 2), -- Lobster tails
    ('880e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440004', 10), -- Avocados
    ('880e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440001', 20), -- Sweet corn
    ('880e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440002', 15), -- Tomatoes
    ('880e8400-e29b-41d4-a716-446655440003', '770e8400-e29b-41d4-a716-446655440005', 50), -- Almonds
    ('880e8400-e29b-41d4-a716-446655440003', '770e8400-e29b-41d4-a716-446655440010', 100); -- Pasta sauce
  END IF;
END $$;

-- ==================== ORDERS ====================

-- Create sample orders with generated order numbers
INSERT INTO orders (
  id, order_number, buyer_org_id, seller_org_id, buyer_user_id, status, payment_status,
  subtotal, tax_amount, shipping_amount, total_amount, currency,
  shipping_address, estimated_delivery_date, buyer_notes, accepted_at, shipped_at
) VALUES
('990e8400-e29b-41d4-a716-446655440001', generate_order_number(), '660e8400-e29b-41d4-a716-446655440007', '660e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440008', 'delivered', 'paid', 249.95, 24.99, 15.00, 289.94, 'USD', '{"street": "400 Culinary Ave", "city": "New York", "state": "NY", "postal_code": "10001", "country": "United States"}', CURRENT_DATE - INTERVAL '5 days', 'Please deliver to back entrance', NOW() - INTERVAL '10 days', NOW() - INTERVAL '7 days'),

('990e8400-e29b-41d4-a716-446655440002', generate_order_number(), '660e8400-e29b-41d4-a716-446655440008', '660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440009', 'shipped', 'paid', 135.00, 13.50, 20.00, 168.50, 'USD', '{"street": "500 Luxury Lane", "city": "Beverly Hills", "state": "CA", "postal_code": "90210", "country": "United States"}', CURRENT_DATE + INTERVAL '2 days', 'Hotel kitchen delivery', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day'),

('990e8400-e29b-41d4-a716-446655440003', generate_order_number(), '660e8400-e29b-41d4-a716-446655440009', '660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440010', 'processing', 'paid', 187.50, 18.75, 25.00, 231.25, 'USD', '{"street": "600 Market Street", "city": "Austin", "state": "TX", "postal_code": "73301", "country": "United States"}', CURRENT_DATE + INTERVAL '3 days', 'Bulk order for multiple stores', NOW() - INTERVAL '2 days', NULL),

('990e8400-e29b-41d4-a716-446655440004', generate_order_number(), '660e8400-e29b-41d4-a716-446655440007', '660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440008', 'pending', 'pending', 90.00, 9.00, 12.00, 111.00, 'USD', '{"street": "400 Culinary Ave", "city": "New York", "state": "NY", "postal_code": "10001", "country": "United States"}', CURRENT_DATE + INTERVAL '5 days', 'Rush order for weekend special', NULL, NULL);

-- ==================== ORDER ITEMS ====================

-- Add order items for the orders
INSERT INTO order_items (
  order_id, product_id, product_name, product_sku, unit_price, quantity, total_price,
  product_snapshot
) VALUES
-- Order 1 items (Ocean Fresh Seafood)
('990e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440007', 'Atlantic Salmon Fillets', 'OFS-SAL-001', 24.99, 5, 124.95, '{"category": "seafood", "brand": "Ocean Fresh"}'),
('990e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440008', 'Maine Lobster Tails', 'OFS-LOB-001', 35.50, 2, 71.00, '{"category": "seafood", "brand": "Ocean Fresh"}'),
('990e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440009', 'Fresh Scallops', 'OFS-SCA-001', 28.75, 2, 54.00, '{"category": "seafood", "brand": "Ocean Fresh"}'),

-- Order 2 items (Green Valley Farms)
('990e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440001', 'Organic Sweet Corn', 'GVF-CORN-001', 4.50, 20, 90.00, '{"category": "vegetables", "brand": "Green Valley", "organic": true}'),
('990e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440002', 'Farm Fresh Tomatoes', 'GVF-TOM-001', 6.75, 10, 45.00, '{"category": "vegetables", "brand": "Green Valley", "organic": true}'),

-- Order 3 items (Organic Valley Co-op)
('990e8400-e29b-41d4-a716-446655440003', '770e8400-e29b-41d4-a716-446655440004', 'Organic Avocados', 'OVC-AVO-001', 3.25, 25, 81.25, '{"category": "fruits", "brand": "Organic Valley", "organic": true}'),
('990e8400-e29b-41d4-a716-446655440003', '770e8400-e29b-41d4-a716-446655440005', 'Organic Almonds', 'OVC-ALM-001', 12.50, 8, 100.00, '{"category": "nuts", "brand": "Organic Valley", "organic": true}'),
('990e8400-e29b-41d4-a716-446655440003', '770e8400-e29b-41d4-a716-446655440006', 'Organic Strawberries', 'OVC-STR-001', 8.75, 1, 6.25, '{"category": "fruits", "brand": "Organic Valley", "organic": true}'),

-- Order 4 items (Green Valley Farms)
('990e8400-e29b-41d4-a716-446655440004', '770e8400-e29b-41d4-a716-446655440001', 'Organic Sweet Corn', 'GVF-CORN-001', 4.50, 10, 45.00, '{"category": "vegetables", "brand": "Green Valley", "organic": true}'),
('990e8400-e29b-41d4-a716-446655440004', '770e8400-e29b-41d4-a716-446655440002', 'Farm Fresh Tomatoes', 'GVF-TOM-001', 6.75, 10, 45.00, '{"category": "vegetables", "brand": "Green Valley", "organic": true}');

-- ==================== TRANSACTIONS ====================

-- Create transactions for completed orders
INSERT INTO transactions (
  id, transaction_number, order_id, seller_org_id, buyer_org_id, type, status,
  amount, currency, payment_method, platform_fee, payment_processing_fee, net_amount,
  description, processed_at, settled_at
) VALUES
('aa0e8400-e29b-41d4-a716-446655440001', generate_transaction_number(), '990e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440007', 'sale', 'completed', 289.94, 'USD', 'credit_card', 14.50, 8.70, 266.74, 'Payment for seafood order', NOW() - INTERVAL '10 days', NOW() - INTERVAL '8 days'),

('aa0e8400-e29b-41d4-a716-446655440002', generate_transaction_number(), '990e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440008', 'sale', 'completed', 168.50, 'USD', 'bank_transfer', 8.43, 5.06, 154.01, 'Payment for organic vegetables', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day'),

('aa0e8400-e29b-41d4-a716-446655440003', generate_transaction_number(), '990e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440009', 'sale', 'pending', 231.25, 'USD', 'credit_card', 11.56, 6.94, 212.75, 'Payment for organic fruits and nuts', NOW() - INTERVAL '2 days', NULL);

-- ==================== PRODUCT REQUESTS ====================

-- Check if product_requests table exists before inserting
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'product_requests') THEN
    -- Create sample product requests (RFQs)
    INSERT INTO product_requests (
  id, request_number, buyer_org_id, buyer_user_id, product_name, product_type, category,
  description, quantity, unit_of_measurement, date_needed, budget_range, status, expires_at
) VALUES
('bb0e8400-e29b-41d4-a716-446655440001', generate_request_number(), '660e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440008', 'Premium Beef Steaks', 'meat', 'meat', 'Looking for high-quality beef steaks for our fine dining restaurant. Prefer grass-fed, aged beef.', 50, 'lb', CURRENT_DATE + INTERVAL '14 days', '{"min": 25, "max": 40, "currency": "USD"}', 'open', CURRENT_DATE + INTERVAL '30 days'),

('bb0e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440009', 'Organic Herbs', 'herbs', 'vegetables', 'Need fresh organic herbs (basil, thyme, rosemary) for hotel restaurants. Weekly delivery preferred.', 20, 'lb', CURRENT_DATE + INTERVAL '7 days', '{"min": 8, "max": 15, "currency": "USD"}', 'open', CURRENT_DATE + INTERVAL '21 days'),

('bb0e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440010', 'Seasonal Fruits', 'fruits', 'fruits', 'Looking for seasonal fruits for our supermarket chain. Need consistent supply and competitive pricing.', 500, 'lb', CURRENT_DATE + INTERVAL '10 days', '{"min": 3, "max": 8, "currency": "USD"}', 'open', CURRENT_DATE + INTERVAL '45 days');
  END IF;
END $$;

-- ==================== REQUEST QUOTES ====================

-- Check if request_quotes table exists before inserting
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'request_quotes') THEN
    -- Create quotes for product requests
    INSERT INTO request_quotes (
  id, request_id, seller_org_id, seller_user_id, unit_price, total_price, currency,
  available_quantity, delivery_date, notes, offered_product_id, status
) VALUES
-- Quotes for beef steaks request
('cc0e8400-e29b-41d4-a716-446655440001', 'bb0e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440004', 32.50, 1625.00, 'USD', 50, CURRENT_DATE + INTERVAL '12 days', 'Premium grass-fed beef, aged 21 days. Can provide certificates of quality.', NULL, 'pending'),

-- Quotes for organic herbs request
('cc0e8400-e29b-41d4-a716-446655440002', 'bb0e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440006', 12.00, 240.00, 'USD', 20, CURRENT_DATE + INTERVAL '5 days', 'Fresh organic herbs, harvested same day as delivery. Weekly delivery available.', NULL, 'pending'),

-- Quotes for seasonal fruits request
('cc0e8400-e29b-41d4-a716-446655440003', 'bb0e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440006', 5.50, 2750.00, 'USD', 500, CURRENT_DATE + INTERVAL '8 days', 'Seasonal mix of apples, pears, and citrus fruits. Can provide consistent weekly supply.', '770e8400-e29b-41d4-a716-446655440004', 'pending');
  END IF;
END $$;

-- ==================== SCHEDULED POSTS ====================

-- Create sample scheduled posts for sellers
INSERT INTO scheduled_posts (
  id, seller_org_id, product_id, title, content, post_type, scheduled_for, status,
  platforms, views_count, likes_count, shares_count, created_by
) VALUES
('dd0e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440003', '770e8400-e29b-41d4-a716-446655440001', 'Fresh Sweet Corn Now Available!', 'Our organic sweet corn is ready for harvest! 🌽 Fresh from our Iowa fields, these ears are bursting with natural sweetness. Perfect for your restaurant or market. Order now for same-day delivery! #OrganicFarming #FreshProduce #Iowa', 'product_promotion', NOW() + INTERVAL '2 hours', 'scheduled', '{"facebook", "instagram", "twitter"}', 0, 0, 0, '550e8400-e29b-41d4-a716-446655440004'),

('dd0e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440004', '770e8400-e29b-41d4-a716-446655440004', 'Avocado Season is Here!', 'California avocados are at their peak! 🥑 Creamy, nutrient-rich, and perfectly ripe. Our organic avocados are perfect for restaurants, hotels, and markets. Bulk orders available with special pricing. #OrganicAvocados #California #HealthyEating', 'seasonal', NOW() + INTERVAL '1 day', 'scheduled', '{"facebook", "instagram"}', 0, 0, 0, '550e8400-e29b-41d4-a716-446655440006'),

('dd0e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440005', '770e8400-e29b-41d4-a716-446655440007', 'Fresh Maine Salmon Special', 'Just in from the cold waters of Maine! 🐟 Our Atlantic salmon fillets are rich in omega-3s and perfect for fine dining. Sustainably caught and flash-frozen for maximum freshness. Limited quantities available. #MaineSeafood #Sustainable #FreshFish', 'sale_announcement', NOW() + INTERVAL '6 hours', 'scheduled', '{"facebook", "instagram", "linkedin"}', 0, 0, 0, '550e8400-e29b-41d4-a716-446655440007'),

-- Published posts with engagement metrics
('dd0e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440003', '770e8400-e29b-41d4-a716-446655440002', 'Heirloom Tomatoes Ready!', 'Our vine-ripened heirloom tomatoes are ready for harvest! 🍅 Grown in rich Iowa soil with no pesticides. These beauties are perfect for your summer menu. Available in multiple varieties. #HeirloomTomatoes #OrganicFarming #SummerHarvest', 'product_promotion', NOW() - INTERVAL '2 days', 'published', '{"facebook", "instagram"}', 245, 18, 5, '550e8400-e29b-41d4-a716-446655440004');

-- Update the published post with published_at timestamp
UPDATE scheduled_posts 
SET published_at = NOW() - INTERVAL '2 days'
WHERE id = 'dd0e8400-e29b-41d4-a716-446655440004';

-- ==================== GOVERNMENT TABLES ====================

-- Check if government_tables table exists before inserting
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'government_tables') THEN
    -- Create sample government tables
    INSERT INTO government_tables (
  id, government_org_id, name, description, icon, color, data_sources, fields, views,
  is_public, created_by
) VALUES
('ee0e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', 'Farmer Registry', 'Registry of all registered farmers in the United States', '🌾', '#10B981', 
'[{"id": "farmers", "name": "Farmers", "table": "organizations", "filters": {"account_type": "seller", "business_type": "farmers", "country": "United States"}}]',
'[{"id": "name", "name": "Farm Name", "type": "text"}, {"id": "location", "name": "Location", "type": "text"}, {"id": "size", "name": "Farm Size (acres)", "type": "number"}, {"id": "crops", "name": "Primary Crops", "type": "multi_select"}, {"id": "organic", "name": "Organic Certified", "type": "boolean"}, {"id": "registration_date", "name": "Registration Date", "type": "date"}]',
'[{"id": "default", "name": "All Farmers", "filters": {}, "sort": {"field": "registration_date", "direction": "desc"}}, {"id": "organic", "name": "Organic Farms", "filters": {"organic": true}}]',
false, '550e8400-e29b-41d4-a716-446655440001'),

('ee0e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440001', 'Product Safety Inspections', 'Track product safety inspections and compliance', '🔍', '#EF4444',
'[{"id": "products", "name": "Products", "table": "products", "joins": [{"table": "organizations", "on": "products.seller_org_id = organizations.id", "filters": {"country": "United States"}}]}]',
'[{"id": "product_name", "name": "Product Name", "type": "text"}, {"id": "seller", "name": "Seller", "type": "relation"}, {"id": "inspection_date", "name": "Inspection Date", "type": "date"}, {"id": "status", "name": "Compliance Status", "type": "select"}, {"id": "inspector", "name": "Inspector", "type": "text"}, {"id": "notes", "name": "Notes", "type": "text"}]',
'[{"id": "recent", "name": "Recent Inspections", "sort": {"field": "inspection_date", "direction": "desc"}}, {"id": "failed", "name": "Failed Inspections", "filters": {"status": "failed"}}]',
false, '550e8400-e29b-41d4-a716-446655440002'),

('ee0e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440001', 'Market Prices', 'Track agricultural product market prices', '💰', '#F59E0B',
'[{"id": "products", "name": "Products", "table": "products", "joins": [{"table": "organizations", "on": "products.seller_org_id = organizations.id", "filters": {"country": "United States"}}]}]',
'[{"id": "product", "name": "Product", "type": "text"}, {"id": "category", "name": "Category", "type": "select"}, {"id": "current_price", "name": "Current Price", "type": "currency"}, {"id": "price_change", "name": "Price Change (%)", "type": "percentage"}, {"id": "last_updated", "name": "Last Updated", "type": "date"}]',
'[{"id": "all", "name": "All Products", "sort": {"field": "last_updated", "direction": "desc"}}, {"id": "vegetables", "name": "Vegetables", "filters": {"category": "vegetables"}}]',
true, '550e8400-e29b-41d4-a716-446655440001');
  END IF;
END $$;

-- ==================== GOVERNMENT CHARTS ====================

-- Check if government_charts table exists before inserting
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'government_charts') THEN
    -- Create sample government charts
    INSERT INTO government_charts (
  id, government_org_id, table_id, name, description, chart_type, config, data_config,
  width, height, position, created_by
) VALUES
('ff0e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', 'ee0e8400-e29b-41d4-a716-446655440001', 'Farmers by State', 'Distribution of registered farmers by state', 'bar',
'{"xAxis": "state", "yAxis": "count", "color": "#10B981"}',
'{"groupBy": "state", "aggregation": "count"}',
6, 4, '{"x": 0, "y": 0}', '550e8400-e29b-41d4-a716-446655440001'),

('ff0e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440001', 'ee0e8400-e29b-41d4-a716-446655440001', 'Organic vs Conventional', 'Percentage of organic vs conventional farms', 'pie',
'{"colors": ["#10B981", "#6B7280"]}',
'{"groupBy": "organic", "aggregation": "count"}',
6, 4, '{"x": 6, "y": 0}', '550e8400-e29b-41d4-a716-446655440001'),

('ff0e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440001', 'ee0e8400-e29b-41d4-a716-446655440003', 'Price Trends', 'Agricultural product price trends over time', 'line',
'{"xAxis": "date", "yAxis": "price", "color": "#F59E0B"}',
'{"groupBy": "date", "aggregation": "avg", "field": "current_price"}',
12, 6, '{"x": 0, "y": 4}', '550e8400-e29b-41d4-a716-446655440001');
  END IF;
END $$;

-- ==================== GOVERNMENT REPORTS ====================

-- Check if government_reports table exists before inserting
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'government_reports') THEN
    -- Create sample government reports
    INSERT INTO government_reports (
  id, government_org_id, name, description, tables, charts, format, status, created_by
) VALUES
('gg0e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', 'Monthly Agriculture Report', 'Comprehensive monthly report on agricultural activities and compliance',
'["ee0e8400-e29b-41d4-a716-446655440001", "ee0e8400-e29b-41d4-a716-446655440002", "ee0e8400-e29b-41d4-a716-446655440003"]',
'["ff0e8400-e29b-41d4-a716-446655440001", "ff0e8400-e29b-41d4-a716-446655440002", "ff0e8400-e29b-41d4-a716-446655440003"]',
'pdf', 'draft', '550e8400-e29b-41d4-a716-446655440001'),

('gg0e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440001', 'Compliance Summary', 'Summary of product safety inspections and compliance status',
'["ee0e8400-e29b-41d4-a716-446655440002"]',
'[]',
'xlsx', 'completed', '550e8400-e29b-41d4-a716-446655440002');

    -- Update completed report with file info
    UPDATE government_reports 
    SET file_url = 'https://example.com/reports/compliance-summary-2024.xlsx',
        generated_at = NOW() - INTERVAL '1 day',
        expires_at = NOW() + INTERVAL '30 days'
    WHERE id = 'gg0e8400-e29b-41d4-a716-446655440002';
  END IF;
END $$;

-- ==================== GOVERNMENT-SELLER PERMISSIONS ====================

-- Grant government organizations permission to manage seller accounts
INSERT INTO government_seller_permissions (
  government_org_id, seller_org_id, permission_type, status, granted_by, approved_by,
  reason, valid_from, valid_until
) VALUES
('660e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440003', 'full_access', 'approved', '550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440002', 'Regulatory oversight and compliance monitoring', NOW() - INTERVAL '30 days', NOW() + INTERVAL '365 days'),
('660e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440004', 'inspection_only', 'approved', '550e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440002', 'Product safety inspections', NOW() - INTERVAL '20 days', NOW() + INTERVAL '180 days'),
('660e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440004', 'compliance_monitoring', 'approved', '550e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440001', 'State-level compliance monitoring for California operations', NOW() - INTERVAL '15 days', NOW() + INTERVAL '365 days');

-- ==================== BUYER FAVORITES ====================

-- Check if buyer_favorite_products table exists before inserting
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'buyer_favorite_products') THEN
    -- Add favorite products and sellers for buyers
    INSERT INTO buyer_favorite_products (buyer_org_id, product_id) VALUES
('660e8400-e29b-41d4-a716-446655440007', '770e8400-e29b-41d4-a716-446655440007'), -- Fine Dining likes Salmon
('660e8400-e29b-41d4-a716-446655440007', '770e8400-e29b-41d4-a716-446655440008'), -- Fine Dining likes Lobster
('660e8400-e29b-41d4-a716-446655440008', '770e8400-e29b-41d4-a716-446655440001'), -- Hotel likes Sweet Corn
('660e8400-e29b-41d4-a716-446655440008', '770e8400-e29b-41d4-a716-446655440002'), -- Hotel likes Tomatoes
('660e8400-e29b-41d4-a716-446655440009', '770e8400-e29b-41d4-a716-446655440004'), -- Supermarket likes Avocados
('660e8400-e29b-41d4-a716-446655440009', '770e8400-e29b-41d4-a716-446655440005'); -- Supermarket likes Almonds
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'buyer_favorite_sellers') THEN
    INSERT INTO buyer_favorite_sellers (buyer_org_id, seller_org_id) VALUES
    ('660e8400-e29b-41d4-a716-446655440007', '660e8400-e29b-41d4-a716-446655440005'), -- Fine Dining likes Ocean Fresh
    ('660e8400-e29b-41d4-a716-446655440008', '660e8400-e29b-41d4-a716-446655440003'), -- Hotel likes Green Valley Farms
    ('660e8400-e29b-41d4-a716-446655440009', '660e8400-e29b-41d4-a716-446655440004'); -- Supermarket likes Organic Valley
  END IF;
END $$;

-- ==================== ORDER REVIEWS ====================

-- Check if order_reviews table exists before inserting
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'order_reviews') THEN
    -- Add reviews for completed orders
    INSERT INTO order_reviews (
  order_id, buyer_org_id, buyer_user_id, seller_org_id, overall_rating, product_quality_rating,
  delivery_rating, service_rating, title, comment, is_verified_purchase, is_public
) VALUES
('990e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440008', '660e8400-e29b-41d4-a716-446655440005', 5, 5, 4, 5, 'Excellent Seafood Quality', 'The salmon and lobster were absolutely fresh and delicious. Our customers loved the dishes we prepared. Delivery was prompt and professional. Will definitely order again!', true, true),

('990e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440009', '660e8400-e29b-41d4-a716-446655440003', 4, 5, 3, 4, 'Great Organic Produce', 'The vegetables were fresh and truly organic. The corn was incredibly sweet. Delivery was a bit delayed but the quality made up for it. Good communication throughout.', true, true);
  END IF;
END $$;

-- ==================== FINAL UPDATES ====================

-- Update stock quantities based on orders
UPDATE products SET stock_quantity = stock_quantity - 5 WHERE id = '770e8400-e29b-41d4-a716-446655440007'; -- Salmon
UPDATE products SET stock_quantity = stock_quantity - 2 WHERE id = '770e8400-e29b-41d4-a716-446655440008'; -- Lobster
UPDATE products SET stock_quantity = stock_quantity - 2 WHERE id = '770e8400-e29b-41d4-a716-446655440009'; -- Scallops
UPDATE products SET stock_quantity = stock_quantity - 30 WHERE id = '770e8400-e29b-41d4-a716-446655440001'; -- Sweet Corn
UPDATE products SET stock_quantity = stock_quantity - 20 WHERE id = '770e8400-e29b-41d4-a716-446655440002'; -- Tomatoes
UPDATE products SET stock_quantity = stock_quantity - 25 WHERE id = '770e8400-e29b-41d4-a716-446655440004'; -- Avocados
UPDATE products SET stock_quantity = stock_quantity - 8 WHERE id = '770e8400-e29b-41d4-a716-446655440005'; -- Almonds
UPDATE products SET stock_quantity = stock_quantity - 1 WHERE id = '770e8400-e29b-41d4-a716-446655440006'; -- Strawberries

-- Update response counts for product requests
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'product_requests') THEN
    UPDATE product_requests SET response_count = 1 WHERE id = 'bb0e8400-e29b-41d4-a716-446655440001';
    UPDATE product_requests SET response_count = 1 WHERE id = 'bb0e8400-e29b-41d4-a716-446655440002';
    UPDATE product_requests SET response_count = 1 WHERE id = 'bb0e8400-e29b-41d4-a716-446655440003';
  END IF;
END $$;

-- Add some audit log entries for government actions
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'government_seller_audit_log') 
     AND EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'government_seller_permissions') THEN
    INSERT INTO government_seller_audit_log (
      permission_id, government_user_id, action, target_table, target_record_id, reason
    )
    SELECT 
      gsp.id,
      '550e8400-e29b-41d4-a716-446655440002',
      'view_profile',
      'organizations',
      gsp.seller_org_id,
      'Routine compliance check'
    FROM government_seller_permissions gsp
    WHERE gsp.government_org_id = '660e8400-e29b-41d4-a716-446655440001'
    LIMIT 3;
  END IF;
END $$;

-- Create indexes for better performance on frequently queried columns
CREATE INDEX IF NOT EXISTS idx_products_seller_status ON products(seller_org_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_status ON orders(buyer_org_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_seller_status ON orders(seller_org_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_seller_status ON transactions(seller_org_id, status);

-- Create cart_items index only if table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cart_items') THEN
    CREATE INDEX IF NOT EXISTS idx_cart_items_product_quantity ON cart_items(product_id, quantity);
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON TABLE products IS 'Seeded with 11 sample products across different categories from 4 seller organizations';
COMMENT ON TABLE orders IS 'Seeded with 4 sample orders in different statuses (pending, processing, shipped, delivered)';
COMMENT ON TABLE users IS 'Seeded with 12 sample users across all account types (government, sellers, buyers, drivers, QA)';
COMMENT ON TABLE organizations IS 'Seeded with 10 sample organizations (2 government, 4 sellers, 4 buyers)';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Database seeding completed successfully!';
    RAISE NOTICE 'Created:';
    RAISE NOTICE '- 12 users across all account types';
    RAISE NOTICE '- 10 organizations (2 government, 4 sellers, 4 buyers)';
    RAISE NOTICE '- 11 products with images';
    RAISE NOTICE '- 4 orders with items and transactions';
    RAISE NOTICE '- 3 shopping carts with items';
    RAISE NOTICE '- 3 product requests with quotes';
    RAISE NOTICE '- 4 scheduled posts';
    RAISE NOTICE '- 3 government tables with charts and reports';
    RAISE NOTICE '- Sample addresses, preferences, favorites, and reviews';
    RAISE NOTICE 'All data is ready for API testing and UI development!';
END $$;
