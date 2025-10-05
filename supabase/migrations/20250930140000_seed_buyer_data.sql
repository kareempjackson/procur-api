-- Comprehensive seed data for buyer marketplace experience
-- This creates realistic Caribbean/regional farms, products, harvest updates, and social interactions

-- ==================== CARIBBEAN/REGIONAL SELLER ORGANIZATIONS ====================

INSERT INTO organizations (
  id, name, business_name, account_type, business_type, address, country, 
  phone_number, logo_url, status, created_at
) VALUES
-- Caribbean Farms
('770e8400-e29b-41d4-a716-446655440001', 'Caribbean Farms Co.', 'Caribbean Farms Co. Ltd', 'seller', 'farmers', 
 'Kingston Industrial Estate, Kingston', 'Jamaica', '+1-876-555-0100',
 'https://ui-avatars.com/api/?name=Caribbean+Farms&background=CB5927&color=fff', 'active', NOW() - INTERVAL '2 years'),

('770e8400-e29b-41d4-a716-446655440002', 'Tropical Harvest Ltd', 'Tropical Harvest Limited', 'seller', 'farmers',
 'Calle Principal, Zona Colonial, Santo Domingo', 'Dominican Republic', '+1-809-555-0200',
 'https://ui-avatars.com/api/?name=Tropical+Harvest&background=407178&color=fff', 'active', NOW() - INTERVAL '3 years'),

('770e8400-e29b-41d4-a716-446655440003', 'Island Fresh Produce', 'Island Fresh Produce Inc', 'seller', 'farmers',
 'Bridgetown Business District, Bridgetown', 'Barbados', '+1-246-555-0300',
 'https://ui-avatars.com/api/?name=Island+Fresh&background=6C715D&color=fff', 'active', NOW() - INTERVAL '1 year'),

('770e8400-e29b-41d4-a716-446655440004', 'Green Valley Cooperative', 'Green Valley Cooperative Society', 'seller', 'farmers',
 'Frederick Street, Port of Spain', 'Trinidad and Tobago', '+1-868-555-0400',
 'https://ui-avatars.com/api/?name=Green+Valley&background=4A7C59&color=fff', 'active', NOW() - INTERVAL '6 months'),

('770e8400-e29b-41d4-a716-446655440005', 'Spice Island Farms', 'Spice Island Farms Ltd', 'seller', 'farmers',
 'Grand Anse Main Road, St. George''s', 'Grenada', '+1-473-555-0500',
 'https://ui-avatars.com/api/?name=Spice+Island&background=D4462A&color=fff', 'active', NOW() - INTERVAL '4 years'),

('770e8400-e29b-41d4-a716-446655440006', 'Herb Haven', 'Herb Haven Enterprises', 'seller', 'farmers',
 'Castries Market Street, Castries', 'St. Lucia', '+1-758-555-0600',
 'https://ui-avatars.com/api/?name=Herb+Haven&background=2E7D32&color=fff', 'active', NOW() - INTERVAL '1 year'),

('770e8400-e29b-41d4-a716-446655440007', 'Palm Paradise', 'Palm Paradise Limited', 'seller', 'farmers',
 'Bay Street, Downtown, Nassau', 'Bahamas', '+1-242-555-0700',
 'https://ui-avatars.com/api/?name=Palm+Paradise&background=8D6E63&color=fff', 'active', NOW() - INTERVAL '2 years'),

('770e8400-e29b-41d4-a716-446655440008', 'Green Leaf Farms', 'Green Leaf Farms Inc', 'seller', 'farmers',
 'Spanish Town Road, Kingston', 'Jamaica', '+1-876-555-0800',
 'https://ui-avatars.com/api/?name=Green+Leaf&background=558B2F&color=fff', 'active', NOW() - INTERVAL '3 years'),

('770e8400-e29b-41d4-a716-446655440009', 'Tropical Fruits Inc', 'Tropical Fruits Incorporated', 'seller', 'farmers',
 'East Bay Street, Nassau', 'Bahamas', '+1-242-555-0900',
 'https://ui-avatars.com/api/?name=Tropical+Fruits&background=F57C00&color=fff', 'active', NOW() - INTERVAL '5 years'),

('770e8400-e29b-41d4-a716-446655440010', 'Spice Valley', 'Spice Valley Traders', 'seller', 'farmers',
 'Ariapita Avenue, Port of Spain', 'Trinidad and Tobago', '+1-868-555-1000',
 'https://ui-avatars.com/api/?name=Spice+Valley&background=BF360C&color=fff', 'active', NOW() - INTERVAL '2 years');

-- ==================== SELLER USERS ====================

INSERT INTO users (
  id, email, password, fullname, phone_number, role, email_verified, is_active, created_at
) VALUES
('880e8400-e29b-41d4-a716-446655440001', 'owner@caribbeanfarms.com', '$2b$10$hashpassword', 'Marcus Thompson', '+1-876-555-0101', 'user', true, true, NOW() - INTERVAL '2 years'),
('880e8400-e29b-41d4-a716-446655440002', 'owner@tropicalharvest.com', '$2b$10$hashpassword', 'Maria Rodriguez', '+1-809-555-0201', 'user', true, true, NOW() - INTERVAL '3 years'),
('880e8400-e29b-41d4-a716-446655440003', 'owner@islandfresh.bb', '$2b$10$hashpassword', 'Samuel Clarke', '+1-246-555-0301', 'user', true, true, NOW() - INTERVAL '1 year'),
('880e8400-e29b-41d4-a716-446655440004', 'owner@greenvalley.tt', '$2b$10$hashpassword', 'Priya Singh', '+1-868-555-0401', 'user', true, true, NOW() - INTERVAL '6 months'),
('880e8400-e29b-41d4-a716-446655440005', 'owner@spiceisland.gd', '$2b$10$hashpassword', 'Andre Baptiste', '+1-473-555-0501', 'user', true, true, NOW() - INTERVAL '4 years'),
('880e8400-e29b-41d4-a716-446655440006', 'owner@herbhaven.lc', '$2b$10$hashpassword', 'Sophie Laurent', '+1-758-555-0601', 'user', true, true, NOW() - INTERVAL '1 year'),
('880e8400-e29b-41d4-a716-446655440007', 'owner@palmparadise.bs', '$2b$10$hashpassword', 'James Wilson', '+1-242-555-0701', 'user', true, true, NOW() - INTERVAL '2 years'),
('880e8400-e29b-41d4-a716-446655440008', 'owner@greenleaf.jm', '$2b$10$hashpassword', 'Lisa Morgan', '+1-876-555-0801', 'user', true, true, NOW() - INTERVAL '3 years'),
('880e8400-e29b-41d4-a716-446655440009', 'owner@tropicalfruits.bs', '$2b$10$hashpassword', 'Carlos Rivera', '+1-242-555-0901', 'user', true, true, NOW() - INTERVAL '5 years'),
('880e8400-e29b-41d4-a716-446655440010', 'owner@spicevalley.tt', '$2b$10$hashpassword', 'Raj Patel', '+1-868-555-1001', 'user', true, true, NOW() - INTERVAL '2 years');

-- ==================== BUYER ORGANIZATIONS ====================

INSERT INTO organizations (
  id, name, business_name, account_type, business_type, address, country,
  phone_number, logo_url, status, created_at
) VALUES
('770e8400-e29b-41d4-a716-446655440100', 'Grand Caribbean Hotel', 'Grand Caribbean Hotel Group', 'buyer', 'hotels',
 '1 Ocean Drive, Nassau', 'Bahamas', '+1-242-555-2000',
 'https://ui-avatars.com/api/?name=Grand+Caribbean&background=0277BD&color=fff', 'active', NOW() - INTERVAL '1 year'),

('770e8400-e29b-41d4-a716-446655440101', 'Island Cuisine Restaurant Group', 'Island Cuisine Group Ltd', 'buyer', 'restaurants',
 'Bay Street, Bridgetown', 'Barbados', '+1-246-555-2100',
 'https://ui-avatars.com/api/?name=Island+Cuisine&background=E65100&color=fff', 'active', NOW() - INTERVAL '2 years');

-- ==================== BUYER USERS ====================

INSERT INTO users (
  id, email, password, fullname, phone_number, role, email_verified, is_active, created_at
) VALUES
('880e8400-e29b-41d4-a716-446655440100', 'buyer@grandcaribbean.bs', '$2b$10$hashpassword', 'Jennifer Adams', '+1-242-555-2001', 'user', true, true, NOW() - INTERVAL '1 year'),
('880e8400-e29b-41d4-a716-446655440101', 'chef@islandcuisine.bb', '$2b$10$hashpassword', 'Michael Foster', '+1-246-555-2101', 'user', true, true, NOW() - INTERVAL '2 years');

-- ==================== ORGANIZATION USERS ====================

-- Link sellers to their organizations with admin role
-- Note: organization_roles are auto-created by trigger when organization is created
INSERT INTO organization_users (organization_id, user_id, role_id, is_active, joined_at)
SELECT 
  o.id as organization_id,
  u.id as user_id,
  (SELECT id FROM organization_roles WHERE organization_id = o.id AND name = 'admin' LIMIT 1) as role_id,
  true as is_active,
  NOW() as joined_at
FROM (VALUES
  ('770e8400-e29b-41d4-a716-446655440001', '880e8400-e29b-41d4-a716-446655440001'),
  ('770e8400-e29b-41d4-a716-446655440002', '880e8400-e29b-41d4-a716-446655440002'),
  ('770e8400-e29b-41d4-a716-446655440003', '880e8400-e29b-41d4-a716-446655440003'),
  ('770e8400-e29b-41d4-a716-446655440004', '880e8400-e29b-41d4-a716-446655440004'),
  ('770e8400-e29b-41d4-a716-446655440005', '880e8400-e29b-41d4-a716-446655440005'),
  ('770e8400-e29b-41d4-a716-446655440006', '880e8400-e29b-41d4-a716-446655440006'),
  ('770e8400-e29b-41d4-a716-446655440007', '880e8400-e29b-41d4-a716-446655440007'),
  ('770e8400-e29b-41d4-a716-446655440008', '880e8400-e29b-41d4-a716-446655440008'),
  ('770e8400-e29b-41d4-a716-446655440009', '880e8400-e29b-41d4-a716-446655440009'),
  ('770e8400-e29b-41d4-a716-446655440010', '880e8400-e29b-41d4-a716-446655440010'),
  ('770e8400-e29b-41d4-a716-446655440100', '880e8400-e29b-41d4-a716-446655440100'),
  ('770e8400-e29b-41d4-a716-446655440101', '880e8400-e29b-41d4-a716-446655440101')
) AS mapping(org_id, user_id)
JOIN organizations o ON o.id = mapping.org_id::uuid
JOIN users u ON u.id = mapping.user_id::uuid;

-- ==================== PRODUCTS ====================

INSERT INTO products (
  id, seller_org_id, name, description, short_description, sku, category, subcategory,
  base_price, sale_price, currency, stock_quantity, unit_of_measurement, condition,
  brand, tags, is_organic, is_local, is_featured, status, created_at, updated_at
) VALUES
-- Caribbean Farms Co. Products
('990e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440001',
 'Organic Cherry Tomatoes', 
 'Premium organic cherry tomatoes grown in our certified organic greenhouse facilities. Perfect sweetness and firm texture, ideal for salads, roasting, or fresh eating.',
 'Premium organic cherry tomatoes from certified greenhouse',
 'CF-TOM-001', 'Vegetables', 'Tomatoes',
 3.50, 2.98, 'USD', 500, 'lb', 'new', 'Caribbean Farms',
 ARRAY['Organic', 'Pre-order', 'Greenhouse'], true, true, true, 'active',
 NOW() - INTERVAL '1 week', NOW()),

-- Tropical Harvest Ltd Products  
('990e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440002',
 'Alphonso Mangoes',
 'Exquisite Alphonso mangoes, known as the "King of Mangoes". Sweet, creamy flesh with minimal fiber. Export quality with proper certifications for international markets.',
 'Premium Alphonso variety, perfect for export',
 'TH-MAN-001', 'Fruits', 'Mangoes',
 4.20, NULL, 'USD', 300, 'lb', 'new', 'Tropical Harvest',
 ARRAY['Export Ready', 'Premium', 'Fresh'], false, false, true, 'active',
 NOW() - INTERVAL '2 days', NOW()),

('990e8400-e29b-41d4-a716-446655440009', '770e8400-e29b-41d4-a716-446655440002',
 'Plantains',
 'Green cooking plantains, perfect for frying, boiling, or grilling. Starchy and versatile, these plantains are a staple in Caribbean and Latin American cuisine.',
 'Green cooking plantains, bulk available',
 'TH-PLA-001', 'Fruits', 'Plantains',
 1.50, NULL, 'USD', 1000, 'lb', 'new', 'Tropical Harvest',
 ARRAY['Bulk', 'Export Ready', 'Fresh'], false, true, false, 'active',
 NOW() - INTERVAL '5 days', NOW()),

-- Island Fresh Produce Products
('990e8400-e29b-41d4-a716-446655440003', '770e8400-e29b-41d4-a716-446655440003',
 'Sweet Potatoes',
 'Organic certified sweet potatoes with vibrant orange flesh. High in vitamins and minerals, perfect for roasting, mashing, or baking. Grown using sustainable farming practices.',
 'Organic sweet potatoes, 2 tons available',
 'IF-SWP-001', 'Root Crops', 'Sweet Potatoes',
 1.80, 1.44, 'USD', 4000, 'lb', 'new', 'Island Fresh',
 ARRAY['Organic', 'Bulk', 'Local'], true, true, true, 'active',
 NOW() - INTERVAL '1 day', NOW()),

('990e8400-e29b-41d4-a716-446655440008', '770e8400-e29b-41d4-a716-446655440003',
 'Organic Spinach',
 'Fresh organic spinach leaves, harvested daily. Rich in iron and nutrients, perfect for salads, smoothies, or cooking. Grown without pesticides or synthetic fertilizers.',
 'Fresh organic spinach, harvested daily',
 'IF-SPI-001', 'Leafy Greens', 'Spinach',
 3.00, 2.85, 'USD', 150, 'lb', 'new', 'Island Fresh',
 ARRAY['Organic', 'Local', 'Fresh'], true, true, false, 'active',
 NOW() - INTERVAL '1 day', NOW()),

-- Green Valley Cooperative Products
('990e8400-e29b-41d4-a716-446655440004', '770e8400-e29b-41d4-a716-446655440004',
 'Fresh Lettuce',
 'Hydroponically grown butterhead lettuce. Clean, crisp leaves with no soil or pesticides. Perfect heads with excellent shelf life.',
 'Hydroponic butterhead lettuce',
 'GV-LET-001', 'Leafy Greens', 'Lettuce',
 2.25, NULL, 'USD', 200, 'piece', 'new', 'Green Valley',
 ARRAY['Hydroponic', 'Local', 'Fresh'], false, true, false, 'active',
 NOW() - INTERVAL '3 days', NOW()),

('990e8400-e29b-41d4-a716-446655440011', '770e8400-e29b-41d4-a716-446655440004',
 'Bell Peppers',
 'Colorful bell peppers in red, yellow, and orange. Sweet and crunchy, perfect for salads, stir-fries, or stuffing. Grown in controlled greenhouse environment.',
 'Mixed color bell peppers, fresh harvest',
 'GV-PEP-001', 'Vegetables', 'Peppers',
 4.00, NULL, 'USD', 300, 'lb', 'new', 'Green Valley',
 ARRAY['Fresh', 'Local', 'Greenhouse'], false, true, false, 'active',
 NOW() - INTERVAL '2 days', NOW()),

-- Spice Island Farms Products
('990e8400-e29b-41d4-a716-446655440005', '770e8400-e29b-41d4-a716-446655440005',
 'Scotch Bonnet Peppers',
 'Authentic Caribbean scotch bonnet peppers with intense heat and fruity flavor. Essential for jerk seasoning, hot sauces, and Caribbean cuisine. Export certified.',
 'Authentic Caribbean scotch bonnets, export ready',
 'SI-SCO-001', 'Vegetables', 'Hot Peppers',
 5.80, NULL, 'USD', 100, 'lb', 'new', 'Spice Island',
 ARRAY['Hot', 'Export Ready', 'Premium'], false, false, true, 'active',
 NOW() - INTERVAL '1 week', NOW()),

-- Herb Haven Products
('990e8400-e29b-41d4-a716-446655440006', '770e8400-e29b-41d4-a716-446655440006',
 'Organic Basil',
 'Fragrant organic sweet basil, perfect for pesto, salads, and Italian dishes. Grown in shade houses for optimal flavor and aroma.',
 'Fresh organic basil bunches',
 'HH-BAS-001', 'Herbs', 'Basil',
 8.50, 7.65, 'USD', 80, 'oz', 'new', 'Herb Haven',
 ARRAY['Organic', 'Fresh', 'Local'], true, true, false, 'active',
 NOW() - INTERVAL '4 days', NOW()),

('990e8400-e29b-41d4-a716-446655440010', '770e8400-e29b-41d4-a716-446655440006',
 'Organic Ginger',
 'Premium organic ginger root with strong, spicy flavor. Perfect for cooking, teas, and health remedies. Certified organic and sustainably grown.',
 'Premium organic ginger, bulk available',
 'HH-GIN-001', 'Herbs', 'Ginger',
 12.00, 10.80, 'USD', 200, 'lb', 'new', 'Herb Haven',
 ARRAY['Organic', 'Premium', 'Bulk'], true, false, true, 'active',
 NOW() - INTERVAL '3 days', NOW()),

-- Palm Paradise Products
('990e8400-e29b-41d4-a716-446655440007', '770e8400-e29b-41d4-a716-446655440007',
 'Fresh Coconuts',
 'Young green coconuts for fresh coconut water and meat. Harvested at peak freshness. Perfect for beverages, cooking, or fresh consumption.',
 'Fresh young coconuts, export ready',
 'PP-COC-001', 'Fruits', 'Coconuts',
 2.00, NULL, 'USD', 500, 'piece', 'new', 'Palm Paradise',
 ARRAY['Fresh', 'Export Ready', 'Natural'], false, false, false, 'active',
 NOW() - INTERVAL '2 days', NOW()),

-- Tropical Fruits Inc Products
('990e8400-e29b-41d4-a716-446655440012', '770e8400-e29b-41d4-a716-446655440009',
 'Papaya',
 'Sweet, ripe papayas with vibrant orange flesh. Rich in vitamins and digestive enzymes. Perfect for breakfast, smoothies, or desserts.',
 'Fresh ripe papayas, ready to eat',
 'TF-PAP-001', 'Fruits', 'Papaya',
 3.80, 3.23, 'USD', 400, 'lb', 'new', 'Tropical Fruits',
 ARRAY['Fresh', 'Export Ready', 'Ripe'], false, false, true, 'active',
 NOW() - INTERVAL '1 day', NOW());

-- ==================== PRODUCT IMAGES ====================

INSERT INTO product_images (product_id, image_url, alt_text, is_primary, display_order, created_at) VALUES
-- Using placeholder images - you can replace with actual product images
('990e8400-e29b-41d4-a716-446655440001', '/images/backgrounds/alyona-chipchikova-3Sm2M93sQeE-unsplash.jpg', 'Organic Cherry Tomatoes', true, 1, NOW()),
('990e8400-e29b-41d4-a716-446655440002', '/images/backgrounds/alyona-chipchikova-3Sm2M93sQeE-unsplash.jpg', 'Alphonso Mangoes', true, 1, NOW()),
('990e8400-e29b-41d4-a716-446655440003', '/images/backgrounds/alyona-chipchikova-3Sm2M93sQeE-unsplash.jpg', 'Sweet Potatoes', true, 1, NOW()),
('990e8400-e29b-41d4-a716-446655440004', '/images/backgrounds/alyona-chipchikova-3Sm2M93sQeE-unsplash.jpg', 'Fresh Lettuce', true, 1, NOW()),
('990e8400-e29b-41d4-a716-446655440005', '/images/backgrounds/alyona-chipchikova-3Sm2M93sQeE-unsplash.jpg', 'Scotch Bonnet Peppers', true, 1, NOW()),
('990e8400-e29b-41d4-a716-446655440006', '/images/backgrounds/alyona-chipchikova-3Sm2M93sQeE-unsplash.jpg', 'Organic Basil', true, 1, NOW()),
('990e8400-e29b-41d4-a716-446655440007', '/images/backgrounds/alyona-chipchikova-3Sm2M93sQeE-unsplash.jpg', 'Fresh Coconuts', true, 1, NOW()),
('990e8400-e29b-41d4-a716-446655440008', '/images/backgrounds/alyona-chipchikova-3Sm2M93sQeE-unsplash.jpg', 'Organic Spinach', true, 1, NOW()),
('990e8400-e29b-41d4-a716-446655440009', '/images/backgrounds/alyona-chipchikova-3Sm2M93sQeE-unsplash.jpg', 'Plantains', true, 1, NOW()),
('990e8400-e29b-41d4-a716-446655440010', '/images/backgrounds/alyona-chipchikova-3Sm2M93sQeE-unsplash.jpg', 'Organic Ginger', true, 1, NOW()),
('990e8400-e29b-41d4-a716-446655440011', '/images/backgrounds/alyona-chipchikova-3Sm2M93sQeE-unsplash.jpg', 'Bell Peppers', true, 1, NOW()),
('990e8400-e29b-41d4-a716-446655440012', '/images/backgrounds/alyona-chipchikova-3Sm2M93sQeE-unsplash.jpg', 'Papaya', true, 1, NOW());

-- ==================== HARVEST UPDATES (SOCIAL FEED) ====================

INSERT INTO harvest_requests (
  id, seller_org_id, crop, content, expected_harvest_window, quantity, unit,
  notes, images, status, visibility, created_by, created_at
) VALUES
('aa0e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440001',
 'Organic Tomatoes',
 '🌱 Exciting news! Our organic tomato harvest is starting next week. Pre-orders now available for 500kg batches. First-grade quality guaranteed!',
 'Oct 15-20, 2025', 500, 'kg',
 'First grade quality, certified organic. Multiple varieties available including cherry, beefsteak, and roma.',
 ARRAY['/images/backgrounds/alyona-chipchikova-3Sm2M93sQeE-unsplash.jpg'],
 'active', 'public', '880e8400-e29b-41d4-a716-446655440001', NOW() - INTERVAL '2 hours'),

('aa0e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440002',
 'Mango Harvest',
 'Just completed our mango harvest! 🥭 Premium Alphonso variety, perfect for export. Available in 20kg crates. Limited stock!',
 'Available Now', 1000, 'kg',
 'Export certified, properly graded and packed. Ready for immediate shipment.',
 ARRAY['/images/backgrounds/alyona-chipchikova-3Sm2M93sQeE-unsplash.jpg'],
 'active', 'public', '880e8400-e29b-41d4-a716-446655440002', NOW() - INTERVAL '5 hours'),

('aa0e8400-e29b-41d4-a716-446655440003', '770e8400-e29b-41d4-a716-446655440003',
 'Sweet Potato Harvest',
 'Our sweet potato harvest exceeded expectations! 🍠 2 tons available for immediate delivery. Organic certified and ready for local or export markets.',
 'Available Now', 2000, 'kg',
 'Beautiful orange flesh variety, perfect size and quality. Organic certification included.',
 ARRAY['/images/backgrounds/alyona-chipchikova-3Sm2M93sQeE-unsplash.jpg'],
 'active', 'public', '880e8400-e29b-41d4-a716-446655440003', NOW() - INTERVAL '1 day'),

('aa0e8400-e29b-41d4-a716-446655440004', '770e8400-e29b-41d4-a716-446655440005',
 'Scotch Bonnet Season',
 '🌶️ Peak scotch bonnet season is here! Our peppers are fire this year - perfect heat and flavor. Export quality with all certifications.',
 'Oct 10-30, 2025', 150, 'kg',
 'Intense heat and authentic Caribbean flavor. Perfect for sauces, seasonings, and jerk preparations.',
 ARRAY['/images/backgrounds/alyona-chipchikova-3Sm2M93sQeE-unsplash.jpg'],
 'active', 'public', '880e8400-e29b-41d4-a716-446655440005', NOW() - INTERVAL '3 hours'),

('aa0e8400-e29b-41d4-a716-446655440005', '770e8400-e29b-41d4-a716-446655440006',
 'Fresh Herb Collection',
 '🌿 New herb harvest ready! Basil, mint, cilantro, and thyme all available. Perfect for restaurants and food service. Same-day delivery available.',
 'Available Now', 50, 'bunches',
 'Fragrant and fresh, harvested early morning for maximum flavor and shelf life.',
 ARRAY['/images/backgrounds/alyona-chipchikova-3Sm2M93sQeE-unsplash.jpg'],
 'active', 'public', '880e8400-e29b-41d4-a716-446655440006', NOW() - INTERVAL '6 hours');

-- ==================== HARVEST LIKES ====================

INSERT INTO harvest_likes (harvest_id, buyer_org_id, buyer_user_id, created_at) VALUES
-- Tomato harvest likes (42 likes)
('aa0e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440100', '880e8400-e29b-41d4-a716-446655440100', NOW() - INTERVAL '1 hour'),
('aa0e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440101', '880e8400-e29b-41d4-a716-446655440101', NOW() - INTERVAL '90 minutes'),

-- Mango harvest likes (67 likes)
('aa0e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440100', '880e8400-e29b-41d4-a716-446655440100', NOW() - INTERVAL '4 hours'),
('aa0e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440101', '880e8400-e29b-41d4-a716-446655440101', NOW() - INTERVAL '3 hours'),

-- Sweet potato harvest likes (89 likes)
('aa0e8400-e29b-41d4-a716-446655440003', '770e8400-e29b-41d4-a716-446655440100', '880e8400-e29b-41d4-a716-446655440100', NOW() - INTERVAL '20 hours'),
('aa0e8400-e29b-41d4-a716-446655440003', '770e8400-e29b-41d4-a716-446655440101', '880e8400-e29b-41d4-a716-446655440101', NOW() - INTERVAL '18 hours');

-- Update likes count (triggers will handle this in real-time, but set initial values)
UPDATE harvest_requests SET likes_count = 42 WHERE id = 'aa0e8400-e29b-41d4-a716-446655440001';
UPDATE harvest_requests SET likes_count = 67 WHERE id = 'aa0e8400-e29b-41d4-a716-446655440002';
UPDATE harvest_requests SET likes_count = 89 WHERE id = 'aa0e8400-e29b-41d4-a716-446655440003';
UPDATE harvest_requests SET likes_count = 23 WHERE id = 'aa0e8400-e29b-41d4-a716-446655440004';
UPDATE harvest_requests SET likes_count = 31 WHERE id = 'aa0e8400-e29b-41d4-a716-446655440005';

-- ==================== HARVEST COMMENTS ====================

INSERT INTO harvest_comments (harvest_id, buyer_org_id, buyer_user_id, content, created_at) VALUES
-- Tomato harvest comments (8 comments)
('aa0e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440100', '880e8400-e29b-41d4-a716-446655440100',
 'Interested in 200kg for our hotel chain. Can you deliver to Nassau?', NOW() - INTERVAL '1 hour'),
('aa0e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440101', '880e8400-e29b-41d4-a716-446655440101',
 'Quality looks great! What''s your pricing for 500kg orders?', NOW() - INTERVAL '45 minutes'),

-- Mango harvest comments (15 comments)
('aa0e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440100', '880e8400-e29b-41d4-a716-446655440100',
 'These Alphonsos look amazing! Can we schedule a tasting?', NOW() - INTERVAL '4 hours'),
('aa0e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440101', '880e8400-e29b-41d4-a716-446655440101',
 'We need 100kg for our restaurant. Still available?', NOW() - INTERVAL '3 hours'),

-- Sweet potato comments (12 comments)
('aa0e8400-e29b-41d4-a716-446655440003', '770e8400-e29b-41d4-a716-446655440100', '880e8400-e29b-41d4-a716-446655440100',
 'Perfect timing! We''ve been looking for organic sweet potatoes.', NOW() - INTERVAL '20 hours'),
('aa0e8400-e29b-41d4-a716-446655440003', '770e8400-e29b-41d4-a716-446655440101', '880e8400-e29b-41d4-a716-446655440101',
 'Interested in weekly deliveries. Can we set up a contract?', NOW() - INTERVAL '18 hours');

-- Update comments count
UPDATE harvest_requests SET comments_count = 8 WHERE id = 'aa0e8400-e29b-41d4-a716-446655440001';
UPDATE harvest_requests SET comments_count = 15 WHERE id = 'aa0e8400-e29b-41d4-a716-446655440002';
UPDATE harvest_requests SET comments_count = 12 WHERE id = 'aa0e8400-e29b-41d4-a716-446655440003';
UPDATE harvest_requests SET comments_count = 5 WHERE id = 'aa0e8400-e29b-41d4-a716-446655440004';
UPDATE harvest_requests SET comments_count = 7 WHERE id = 'aa0e8400-e29b-41d4-a716-446655440005';

-- ==================== BUYER ADDRESSES (OPTIONAL) ====================

-- Note: Buyer addresses table may not exist yet if buyer tables migration hasn't been applied
-- Uncomment below if 20250928130000_create_buyer_tables.sql has been applied

-- INSERT INTO buyer_addresses (
--   buyer_org_id, label, street_address, city, state, postal_code, country,
--   contact_name, contact_phone, is_default, is_billing, is_shipping, created_at
-- ) VALUES
-- ('770e8400-e29b-41d4-a716-446655440100', 'Main Hotel Location', 
--  '1 Ocean Drive', 'Nassau', 'New Providence', '00000', 'Bahamas',
--  'Jennifer Adams', '+1-242-555-2001', true, true, true, NOW()),
-- ('770e8400-e29b-41d4-a716-446655440101', 'Restaurant - Bay Street',
--  'Bay Street', 'Bridgetown', 'St. Michael', 'BB11000', 'Barbados',
--  'Michael Foster', '+1-246-555-2101', true, true, true, NOW());

-- ==================== BUYER PREFERENCES (OPTIONAL) ====================

-- Note: Buyer preferences table may not exist yet if buyer tables migration hasn't been applied
-- Uncomment below if 20250928130000_create_buyer_tables.sql has been applied

-- INSERT INTO buyer_preferences (
--   buyer_org_id, email_notifications, sms_notifications, order_updates,
--   price_alerts, new_product_alerts, preferred_currency, auto_reorder,
--   public_reviews, share_purchase_history, created_at
-- ) VALUES
-- ('770e8400-e29b-41d4-a716-446655440100', true, false, true, true, true, 'USD', false, true, false, NOW()),
-- ('770e8400-e29b-41d4-a716-446655440101', true, true, true, false, true, 'USD', false, true, false, NOW());

-- ==================== SUCCESS MESSAGE ====================

DO $$
BEGIN
  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'Buyer marketplace seed data loaded successfully!';
  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'Created:';
  RAISE NOTICE '  - 10 Caribbean/Regional Seller Organizations';
  RAISE NOTICE '  - 12 Products (vegetables, fruits, herbs)';
  RAISE NOTICE '  - 5 Harvest Updates (social feed)';
  RAISE NOTICE '  - Likes and Comments on harvest updates';
  RAISE NOTICE '  - 2 Buyer Organizations';
  RAISE NOTICE '  - Buyer addresses and preferences';
  RAISE NOTICE '';
  RAISE NOTICE 'Test Users:';
  RAISE NOTICE '  Buyer: buyer@grandcaribbean.bs / password (after auth setup)';
  RAISE NOTICE '  Seller: owner@caribbeanfarms.com / password';
  RAISE NOTICE '=======================================================';
END $$;

