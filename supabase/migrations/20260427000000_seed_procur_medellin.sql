-- Procur Medellín · April 2026 catalogue
--
-- Wipes any existing Colombian product data, then seeds the Procur Medellín
-- seller org with 22 SKUs (vegetables, roots & tubers, fruit, seafood) per
-- the April 2026 product catalogue PDF. Prices in COP, country_id 'col'.
--
-- Wipe semantics: order_items.product_id is nullable (per
-- 20260106130000_allow_null_product_id_on_order_items.sql) but has no ON
-- DELETE behavior. We null it out before the DELETE so historical orders
-- survive without their FK target. cart_items / product_images / cross-
-- country availability all CASCADE.

-- ============================================================================
-- 0. WIPE — remove any existing Colombian product data
-- ============================================================================

UPDATE order_items
SET product_id = NULL
WHERE product_id IN (SELECT id FROM products WHERE country_id = 'col');

DELETE FROM products WHERE country_id = 'col';

-- ============================================================================
-- 1. USER + ORG
-- ============================================================================

INSERT INTO users (
    id, email, password, fullname, phone_number, profile_img,
    personal_address, country, role, individual_account_type,
    email_verified, is_active
) VALUES (
    '550e8400-e29b-41d4-a716-446655440050',
    'medellin@procur.co',
    '$2b$10$hash50',
    'Procur Medellín Operations',
    '+57-4-555-1100',
    NULL,
    'Carrera 43A #1-50, El Poblado, Medellín',
    'Colombia',
    'user',
    NULL,
    true,
    true
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO organizations (
    id, name, business_name, account_type, business_type,
    address, country, country_id, phone_number,
    business_registration_number, tax_id,
    status
) VALUES (
    '660e8400-e29b-41d4-a716-446655440050',
    'Procur Medellín',
    'Procur Colombia SAS',
    'seller',
    'farmers',
    'Carrera 43A #1-50, El Poblado, Medellín, Antioquia',
    'Colombia',
    'col',
    '+57-4-555-1100',
    'BUS-PCM-001',
    'TAX-PCM-001',
    'active'
)
ON CONFLICT (id) DO NOTHING;

-- Default roles are auto-created by the trigger on organizations insert.
-- Link the owner user to the admin role.
INSERT INTO organization_users (organization_id, user_id, role_id, is_active, joined_at)
SELECT
    '660e8400-e29b-41d4-a716-446655440050',
    '550e8400-e29b-41d4-a716-446655440050',
    r.id,
    true,
    NOW() - INTERVAL '7 days'
FROM organization_roles r
WHERE r.organization_id = '660e8400-e29b-41d4-a716-446655440050'
  AND r.name = 'admin'
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- ============================================================================
-- 2. PRODUCTS — 22 SKUs (V-001…V-008, R-001…R-004, F-001…F-008, S-001…S-003)
-- ============================================================================

INSERT INTO products (
    id, seller_org_id, name, description, short_description,
    sku, category, subcategory, tags,
    base_price, currency, stock_quantity, unit_of_measurement, weight,
    size, condition, brand,
    status, is_featured, is_organic, is_local,
    slug, country_id, created_by
) VALUES

-- ── FRESH VEGETABLES ──────────────────────────────────────────────────────
('770e8400-e29b-41d4-a716-446655440050', '660e8400-e29b-41d4-a716-446655440050',
 'Chonto Tomato',
 'Tomate Chonto. Fresh, ripe Colombian tomatoes — ideal for salads, salsas, cooking, and slow-simmered sauces. Sourced same-day from growers in Antioquia.',
 'Fresh, ripe tomatoes — ideal for salads, salsas, and cooking.',
 'V-001', 'Vegetables', 'Fresh Vegetables', ARRAY['local','medellin'],
 9500, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', true, false, true,
 'medellin-chonto-tomato', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440051', '660e8400-e29b-41d4-a716-446655440050',
 'Red Onion',
 'Cebolla Roja. Versatile red onions for cooking, pickling, or raw in salads. A staple of the Colombian kitchen.',
 'Versatile red onions for cooking, pickling, or raw in salads.',
 'V-002', 'Vegetables', 'Fresh Vegetables', ARRAY['local','medellin'],
 8500, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-red-onion', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440052', '660e8400-e29b-41d4-a716-446655440050',
 'White Onion',
 'Cebolla Blanca. Classic white onions — a kitchen essential for every dish, from sofritos to soups.',
 'Classic white onions — a kitchen essential for every dish.',
 'V-003', 'Vegetables', 'Fresh Vegetables', ARRAY['local','medellin'],
 7500, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-white-onion', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440053', '660e8400-e29b-41d4-a716-446655440050',
 'Red Bell Pepper',
 'Pimentón Rojo. Crisp, sweet red peppers. Great roasted, stuffed, or raw in salads. 500 g pack.',
 'Crisp, sweet red peppers. Great roasted, stuffed, or raw.',
 'V-004', 'Vegetables', 'Fresh Vegetables', ARRAY['local','medellin'],
 5500, 'COP', 100, 'piece', 0.50,
 '500 g', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-red-bell-pepper', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440054', '660e8400-e29b-41d4-a716-446655440050',
 'Cucumber',
 'Pepino Cohombro. Cool, crunchy cucumbers — perfect for salads, juicing, or snacking. Sold each, ~400 g.',
 'Cool, crunchy cucumbers — perfect for salads, juicing, or snacking.',
 'V-005', 'Vegetables', 'Fresh Vegetables', ARRAY['local','medellin'],
 3500, 'COP', 100, 'piece', 0.40,
 'each (~400 g)', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-cucumber', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440055', '660e8400-e29b-41d4-a716-446655440050',
 'Beetroot',
 'Remolacha. Earthy, nutritious beetroot. Great roasted, juiced, or shaved into salads.',
 'Earthy, nutritious beetroot. Great roasted, juiced, or in salads.',
 'V-006', 'Vegetables', 'Fresh Vegetables', ARRAY['local','medellin'],
 5900, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-beetroot', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440056', '660e8400-e29b-41d4-a716-446655440050',
 'Green Beans',
 'Habichuela. Tender green beans — steamed, sautéed, or added to stews. 500 g pack.',
 'Tender green beans — steamed, sautéed, or added to stews.',
 'V-007', 'Vegetables', 'Fresh Vegetables', ARRAY['local','medellin'],
 5200, 'COP', 100, 'piece', 0.50,
 '500 g', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-green-beans', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440057', '660e8400-e29b-41d4-a716-446655440050',
 'Tamarillo',
 'Tomate de Árbol. A uniquely Colombian fruit-vegetable. Sweet-tart, great in juices, sauces, and traditional Colombian aji. 500 g pack.',
 'A uniquely Colombian fruit-vegetable. Sweet-tart and great in sauces.',
 'V-008', 'Vegetables', 'Fresh Vegetables', ARRAY['local','medellin'],
 5500, 'COP', 100, 'piece', 0.50,
 '500 g', 'new', 'Procur Medellín',
 'active', true, false, true,
 'medellin-tamarillo', 'col', '550e8400-e29b-41d4-a716-446655440050'),

-- ── ROOTS & TUBERS ────────────────────────────────────────────────────────
('770e8400-e29b-41d4-a716-446655440058', '660e8400-e29b-41d4-a716-446655440050',
 'Criolla Potato',
 'Papa Criolla. Colombia''s beloved small yellow potato — creamy when fried, perfect when boiled in caldo. 500 g pack.',
 'Colombia''s beloved small yellow potato — creamy fried or boiled.',
 'R-001', 'Vegetables', 'Roots & Tubers', ARRAY['local','medellin'],
 5500, 'COP', 100, 'piece', 0.50,
 '500 g', 'new', 'Procur Medellín',
 'active', true, false, true,
 'medellin-criolla-potato', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440059', '660e8400-e29b-41d4-a716-446655440050',
 'Cassava',
 'Yuca. Starchy cassava root — a staple for frying, boiling, or thickening soups. Comes peeled and ready to cook.',
 'Starchy cassava root — a staple for frying, boiling, or soups.',
 'R-002', 'Vegetables', 'Roots & Tubers', ARRAY['local','medellin'],
 6500, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-cassava', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440060', '660e8400-e29b-41d4-a716-446655440050',
 'Pumpkin',
 'Ahuyama. Pre-portioned pumpkin — ready to roast, steam, or blend into soup. 500 g portion.',
 'Pre-portioned pumpkin — ready to roast, steam, or blend into soup.',
 'R-003', 'Vegetables', 'Roots & Tubers', ARRAY['local','medellin'],
 3900, 'COP', 100, 'piece', 0.50,
 '500 g portion', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-pumpkin', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440061', '660e8400-e29b-41d4-a716-446655440050',
 'Sweet Potato',
 'Camote / Batata. Naturally sweet and nutritious. Roasted, mashed, or baked — also excellent for purées and traditional desserts.',
 'Naturally sweet and nutritious. Roasted, mashed, or baked.',
 'R-004', 'Vegetables', 'Roots & Tubers', ARRAY['local','medellin'],
 9500, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-sweet-potato', 'col', '550e8400-e29b-41d4-a716-446655440050'),

-- ── FRESH FRUIT ───────────────────────────────────────────────────────────
('770e8400-e29b-41d4-a716-446655440062', '660e8400-e29b-41d4-a716-446655440050',
 'Hass Avocado',
 'Aguacate Hass. Premium Hass avocados — rich, creamy, and perfectly ripened. Ready for guacamole, toast, or salads. Sold in 4-packs.',
 'Premium Hass avocados — rich and creamy. Ready for guac or toast.',
 'F-001', 'Fruits', 'Fresh Fruit', ARRAY['local','medellin'],
 8500, 'COP', 100, 'piece', 0.60,
 '4-pack', 'new', 'Procur Medellín',
 'active', true, false, true,
 'medellin-hass-avocado', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440063', '660e8400-e29b-41d4-a716-446655440050',
 'Tommy Mango',
 'Mango Tommy. Sweet, juicy Colombian Tommy Atkins mangoes at peak season. Firm flesh, low fibre, perfect for slicing or juicing.',
 'Sweet, juicy Colombian Tommy mangoes at peak season.',
 'F-002', 'Fruits', 'Fresh Fruit', ARRAY['local','medellin'],
 9000, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', true, false, true,
 'medellin-tommy-mango', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440064', '660e8400-e29b-41d4-a716-446655440050',
 'Pineapple',
 'Piña. Fresh whole pineapple — tropical sweetness for snacking, juicing, or grilling. Sold each.',
 'Fresh whole pineapple — tropical sweetness for snacking or juicing.',
 'F-003', 'Fruits', 'Fresh Fruit', ARRAY['local','medellin'],
 5500, 'COP', 100, 'piece', 1.50,
 'each', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-pineapple', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440065', '660e8400-e29b-41d4-a716-446655440050',
 'Papaya',
 'Papaya. Ripe, fragrant Colombian papaya — a breakfast favourite. Sweet, custardy flesh ready to eat or blend.',
 'Ripe, fragrant Colombian papaya — a breakfast favourite.',
 'F-004', 'Fruits', 'Fresh Fruit', ARRAY['local','medellin'],
 7500, 'COP', 100, 'piece', 1.00,
 'each (~1 kg)', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-papaya', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440066', '660e8400-e29b-41d4-a716-446655440050',
 'Valencia Orange',
 'Naranja Valencia. Juicy Valencia oranges — perfect for fresh-squeezed juice, marmalade, or eating fresh.',
 'Juicy Valencia oranges — perfect for fresh-squeezed juice.',
 'F-005', 'Fruits', 'Fresh Fruit', ARRAY['local','medellin'],
 5500, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-valencia-orange', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440067', '660e8400-e29b-41d4-a716-446655440050',
 'Tahití Lime',
 'Limón Tahití. Essential limes for cocktails, ceviche, and everyday cooking. Thin-skinned, juicy, intensely aromatic.',
 'Essential limes for cocktails, ceviche, and everyday cooking.',
 'F-006', 'Fruits', 'Fresh Fruit', ARRAY['local','medellin'],
 10500, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', true, false, true,
 'medellin-tahiti-lime', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440068', '660e8400-e29b-41d4-a716-446655440050',
 'Banana',
 'Banano. Sweet yellow bananas — snack, smoothie, or bake. Selected ripe-but-firm for the trip home.',
 'Sweet yellow bananas — snack, smoothie, or bake.',
 'F-007', 'Fruits', 'Fresh Fruit', ARRAY['local','medellin'],
 5000, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-banana', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440069', '660e8400-e29b-41d4-a716-446655440050',
 'Green Plantain',
 'Plátano Verde. A Colombian kitchen staple. Fried for patacones, boiled for sancocho, or baked. Sold each, ~450 g.',
 'A Colombian kitchen staple. Fried, boiled, or baked.',
 'F-008', 'Fruits', 'Fresh Fruit', ARRAY['local','medellin'],
 2500, 'COP', 100, 'piece', 0.45,
 'each (~450 g)', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-green-plantain', 'col', '550e8400-e29b-41d4-a716-446655440050'),

-- ── FRESH SEAFOOD ─────────────────────────────────────────────────────────
('770e8400-e29b-41d4-a716-446655440070', '660e8400-e29b-41d4-a716-446655440050',
 'Rainbow Trout Fillet',
 'Filete de Trucha. Fresh Colombian trout fillet from our seafood partner. Order cutoff 11am for same-day delivery. Priced per kilogram.',
 'Fresh Colombian trout fillet. Order cutoff 11am for same-day.',
 'S-001', 'Seafood', 'Fresh Seafood', ARRAY['local','medellin','seafood'],
 85000, 'COP', 30, 'kg', 1.00,
 'per kg', 'new', 'Procur Medellín',
 'active', true, false, true,
 'medellin-rainbow-trout-fillet', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440071', '660e8400-e29b-41d4-a716-446655440050',
 'National Sea Bass',
 'Filete de Robalo. Premium Colombian sea bass — firm, fresh, versatile. Order cutoff 11am for same-day delivery. Priced per kilogram.',
 'Premium white fish. Firm, fresh, and versatile.',
 'S-002', 'Seafood', 'Fresh Seafood', ARRAY['local','medellin','seafood'],
 75000, 'COP', 30, 'kg', 1.00,
 'per kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-national-sea-bass', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440072', '660e8400-e29b-41d4-a716-446655440050',
 'Red Snapper',
 'Pargo Rojo. Whole fresh red snapper — great grilled or baked whole. Market weight varies (~2 kg). Order cutoff 11am for same-day.',
 'Whole fresh red snapper. Great grilled or baked. Market weight varies.',
 'S-003', 'Seafood', 'Fresh Seafood', ARRAY['local','medellin','seafood'],
 45000, 'COP', 30, 'piece', 2.00,
 'whole fish', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-red-snapper', 'col', '550e8400-e29b-41d4-a716-446655440050')

ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. PRODUCT IMAGES — one Unsplash photo per SKU
-- ============================================================================
-- Each URL was HEAD-checked against the production Unsplash CDN before commit.
-- Unsplash is allowlisted in procur-ui/next.config.ts.

INSERT INTO product_images (product_id, image_url, alt_text, display_order, is_primary) VALUES
('770e8400-e29b-41d4-a716-446655440050', 'https://images.unsplash.com/photo-1582284540020-8acbe03f4924?auto=format&fit=crop&w=1200&q=80', 'Ripe Chonto tomatoes',                0, true),
('770e8400-e29b-41d4-a716-446655440051', 'https://images.unsplash.com/photo-1620574387735-3624d75b2dbc?auto=format&fit=crop&w=1200&q=80', 'Fresh red onions',                    0, true),
('770e8400-e29b-41d4-a716-446655440052', 'https://images.unsplash.com/photo-1518977956812-cd3dbadaaf31?auto=format&fit=crop&w=1200&q=80', 'White onions',                        0, true),
('770e8400-e29b-41d4-a716-446655440053', 'https://images.unsplash.com/photo-1525607551316-4a8e16d1f9ba?auto=format&fit=crop&w=1200&q=80', 'Red bell peppers',                    0, true),
('770e8400-e29b-41d4-a716-446655440054', 'https://images.unsplash.com/photo-1604977042946-1eecc30f269e?auto=format&fit=crop&w=1200&q=80', 'Fresh cucumber',                      0, true),
('770e8400-e29b-41d4-a716-446655440055', 'https://images.unsplash.com/photo-1593105544559-ecb03bf76f82?auto=format&fit=crop&w=1200&q=80', 'Whole beetroot',                      0, true),
('770e8400-e29b-41d4-a716-446655440056', 'https://images.unsplash.com/photo-1567375698348-5d9d5ae99de0?auto=format&fit=crop&w=1200&q=80', 'Tender green beans',                  0, true),
('770e8400-e29b-41d4-a716-446655440057', 'https://images.unsplash.com/photo-1568569350062-ebfa3cb195df?auto=format&fit=crop&w=1200&q=80', 'Tamarillo (tomate de árbol)',         0, true),
('770e8400-e29b-41d4-a716-446655440058', 'https://images.unsplash.com/photo-1518977822534-7049a61ee0c2?auto=format&fit=crop&w=1200&q=80', 'Yellow criolla potatoes',             0, true),
('770e8400-e29b-41d4-a716-446655440059', 'https://images.unsplash.com/photo-1615485500704-8e990f9900f7?auto=format&fit=crop&w=1200&q=80', 'Yuca / cassava root',                 0, true),
('770e8400-e29b-41d4-a716-446655440060', 'https://images.unsplash.com/photo-1570586437263-ab629fccc818?auto=format&fit=crop&w=1200&q=80', 'Pumpkin portion',                     0, true),
('770e8400-e29b-41d4-a716-446655440061', 'https://images.unsplash.com/photo-1502741126161-b048400d085d?auto=format&fit=crop&w=1200&q=80', 'Sweet potato',                        0, true),
('770e8400-e29b-41d4-a716-446655440062', 'https://images.unsplash.com/photo-1601039641847-7857b994d704?auto=format&fit=crop&w=1200&q=80', 'Hass avocados',                       0, true),
('770e8400-e29b-41d4-a716-446655440063', 'https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=1200&q=80',   'Tommy Atkins mangoes',                0, true),
('770e8400-e29b-41d4-a716-446655440064', 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?auto=format&fit=crop&w=1200&q=80',   'Whole pineapple',                     0, true),
('770e8400-e29b-41d4-a716-446655440065', 'https://images.unsplash.com/photo-1617112848923-cc2234396a8d?auto=format&fit=crop&w=1200&q=80', 'Whole papaya',                        0, true),
('770e8400-e29b-41d4-a716-446655440066', 'https://images.unsplash.com/photo-1547514701-42782101795e?auto=format&fit=crop&w=1200&q=80',   'Valencia oranges',                    0, true),
('770e8400-e29b-41d4-a716-446655440067', 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?auto=format&fit=crop&w=1200&q=80', 'Tahití limes',                        0, true),
('770e8400-e29b-41d4-a716-446655440068', 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=1200&q=80', 'Bunch of bananas',                    0, true),
('770e8400-e29b-41d4-a716-446655440069', 'https://images.unsplash.com/photo-1528825871115-3581a5387919?auto=format&fit=crop&w=1200&q=80', 'Green plantains',                     0, true),
('770e8400-e29b-41d4-a716-446655440070', 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?auto=format&fit=crop&w=1200&q=80', 'Rainbow trout fillet',                0, true),
('770e8400-e29b-41d4-a716-446655440071', 'https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?auto=format&fit=crop&w=1200&q=80', 'Sea bass fillet',                     0, true),
('770e8400-e29b-41d4-a716-446655440072', 'https://images.unsplash.com/photo-1535392432937-a27c36ec07b5?auto=format&fit=crop&w=1200&q=80', 'Whole red snapper',                   0, true)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE products IS
    'Products table. Procur Medellín seller (660e8400-...440050) seeded with 22 SKUs in 20260427000000_seed_procur_medellin.sql.';
