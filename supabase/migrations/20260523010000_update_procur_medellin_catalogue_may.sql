-- Procur Medellín · May 2026 catalogue refresh
--
-- Reconciles the seller's product catalogue against the May 2026 wholesale
-- price list from Medellín vendors. Existing SKUs get their base_price
-- refreshed; ~34 net-new items are inserted as fresh products. Any SKU not
-- present in the new list (e.g. Hass Avocado F-001, Tommy Mango F-002) is
-- left untouched.
--
-- Idempotent on re-run: UPDATEs are key'd by (seller_org_id, sku); INSERTs
-- use ON CONFLICT (slug) DO NOTHING. The migration carries no transaction
-- wrapper — Supabase wraps the file in one by default.
--
-- Vendor attribution (Mayor Fruver / Peztimaco) is intentionally NOT stored
-- on products per product direction (no column, no tag, no description
-- mention). Tracking sourcing belongs in a future supplier/PO table.

-- ============================================================================
-- 1. UPDATE — refresh prices on 20 existing SKUs
-- ============================================================================

UPDATE products SET base_price = 6500, updated_at = NOW() WHERE seller_org_id = '660e8400-e29b-41d4-a716-446655440050' AND sku = 'V-001'; -- Chonto Tomato
UPDATE products SET base_price = 5072, updated_at = NOW() WHERE seller_org_id = '660e8400-e29b-41d4-a716-446655440050' AND sku = 'V-002'; -- Red Onion
UPDATE products SET base_price = 5072, updated_at = NOW() WHERE seller_org_id = '660e8400-e29b-41d4-a716-446655440050' AND sku = 'V-003'; -- White Onion
UPDATE products SET base_price = 6900, updated_at = NOW() WHERE seller_org_id = '660e8400-e29b-41d4-a716-446655440050' AND sku = 'V-004'; -- Red Bell Pepper (Pimentón)
UPDATE products SET base_price = 2500, updated_at = NOW() WHERE seller_org_id = '660e8400-e29b-41d4-a716-446655440050' AND sku = 'V-005'; -- Cucumber
UPDATE products SET base_price = 4631, updated_at = NOW() WHERE seller_org_id = '660e8400-e29b-41d4-a716-446655440050' AND sku = 'V-006'; -- Beetroot
UPDATE products SET base_price = 7056, updated_at = NOW() WHERE seller_org_id = '660e8400-e29b-41d4-a716-446655440050' AND sku = 'V-007'; -- Green Beans (Habichuela)
UPDATE products SET base_price = 7166, updated_at = NOW() WHERE seller_org_id = '660e8400-e29b-41d4-a716-446655440050' AND sku = 'V-008'; -- Tamarillo
UPDATE products SET base_price = 4900, updated_at = NOW() WHERE seller_org_id = '660e8400-e29b-41d4-a716-446655440050' AND sku = 'R-002'; -- Cassava
UPDATE products SET base_price = 4741, updated_at = NOW() WHERE seller_org_id = '660e8400-e29b-41d4-a716-446655440050' AND sku = 'R-003'; -- Pumpkin
UPDATE products SET base_price = 9500, updated_at = NOW() WHERE seller_org_id = '660e8400-e29b-41d4-a716-446655440050' AND sku = 'R-004'; -- Sweet Potato (no change, declarative)
UPDATE products SET base_price = 3859, updated_at = NOW() WHERE seller_org_id = '660e8400-e29b-41d4-a716-446655440050' AND sku = 'F-003'; -- Pineapple
UPDATE products SET base_price = 5402, updated_at = NOW() WHERE seller_org_id = '660e8400-e29b-41d4-a716-446655440050' AND sku = 'F-004'; -- Papaya
UPDATE products SET base_price = 3900, updated_at = NOW() WHERE seller_org_id = '660e8400-e29b-41d4-a716-446655440050' AND sku = 'F-005'; -- Valencia Orange
UPDATE products SET base_price = 5800, updated_at = NOW() WHERE seller_org_id = '660e8400-e29b-41d4-a716-446655440050' AND sku = 'F-006'; -- Tahití Lime
UPDATE products SET base_price = 3969, updated_at = NOW() WHERE seller_org_id = '660e8400-e29b-41d4-a716-446655440050' AND sku = 'F-007'; -- Banana
UPDATE products SET base_price = 4300, updated_at = NOW() WHERE seller_org_id = '660e8400-e29b-41d4-a716-446655440050' AND sku = 'F-008'; -- Green Plantain
UPDATE products SET base_price = 60000, updated_at = NOW() WHERE seller_org_id = '660e8400-e29b-41d4-a716-446655440050' AND sku = 'S-001'; -- Rainbow Trout Fillet
UPDATE products SET base_price = 53000, updated_at = NOW() WHERE seller_org_id = '660e8400-e29b-41d4-a716-446655440050' AND sku = 'S-002'; -- National Sea Bass
UPDATE products SET base_price = 31000, updated_at = NOW() WHERE seller_org_id = '660e8400-e29b-41d4-a716-446655440050' AND sku = 'S-003'; -- Red Snapper

-- ============================================================================
-- 2. INSERT — 34 net-new SKUs
--    V-009..V-024  Fresh Vegetables
--    R-005..R-007  Roots & Tubers
--    F-009..F-017  Fresh Fruit
--    S-004..S-009  Seafood (one row in "Prepared" subcategory)
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
('770e8400-e29b-41d4-a716-446655440073', '660e8400-e29b-41d4-a716-446655440050',
 'Purple Cabbage',
 'Repollo Morado. Crunchy purple cabbage — vibrant in slaws, stir-fries, and pickles. Adds colour and bite to any plate.',
 'Crunchy purple cabbage — vibrant in slaws and stir-fries.',
 'V-009', 'Vegetables', 'Fresh Vegetables', ARRAY['local','medellin'],
 3600, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-purple-cabbage', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440074', '660e8400-e29b-41d4-a716-446655440050',
 'Eggplant',
 'Berenjena. Glossy purple eggplants — grill, roast, or stew. The backbone of moussaka, baba ganoush, and slow-cooked vegetable dishes.',
 'Glossy purple eggplants — grill, roast, or stew.',
 'V-010', 'Vegetables', 'Fresh Vegetables', ARRAY['local','medellin'],
 3800, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-eggplant', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440075', '660e8400-e29b-41d4-a716-446655440050',
 'Spring Onion',
 'Cebolla Huevo. Mild spring onions with a crisp bulb and bright green tops. Slice into salads, garnish soups, or sauté whole.',
 'Mild spring onions with crisp bulbs and bright tops.',
 'V-011', 'Vegetables', 'Fresh Vegetables', ARRAY['local','medellin'],
 4000, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-spring-onion', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440076', '660e8400-e29b-41d4-a716-446655440050',
 'Carrot',
 'Zanahoria. Sweet, crunchy orange carrots — eat raw, roast, juice, or shred into stews. A daily kitchen workhorse.',
 'Sweet, crunchy carrots for every kitchen.',
 'V-012', 'Vegetables', 'Fresh Vegetables', ARRAY['local','medellin'],
 4900, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-carrot', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440077', '660e8400-e29b-41d4-a716-446655440050',
 'String Beans',
 'Frijol Vaina. Long, tender string beans in the pod — snap, steam, sauté, or add to stews. Crisp and bright.',
 'Long, tender string beans — snap, steam, or stew.',
 'V-013', 'Vegetables', 'Fresh Vegetables', ARRAY['local','medellin'],
 7500, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-string-beans', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440078', '660e8400-e29b-41d4-a716-446655440050',
 'Garlic Head',
 'Ajo Cabeza. Whole garlic heads — fresh, pungent, and full of flavour. The essential aromatic for every cuisine.',
 'Whole garlic heads — fresh, pungent, full of flavour.',
 'V-014', 'Vegetables', 'Fresh Vegetables', ARRAY['local','medellin'],
 700, 'COP', 100, 'piece', 0.05,
 'whole head', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-garlic-head', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440079', '660e8400-e29b-41d4-a716-446655440050',
 'Sweet Corn',
 'Maíz Dulce. Sweet, tender corn on the cob — boil, grill, or strip kernels for chowder and salads.',
 'Sweet, tender corn — boil, grill, or strip for chowder.',
 'V-015', 'Vegetables', 'Fresh Vegetables', ARRAY['local','medellin'],
 5292, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-sweet-corn', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440080', '660e8400-e29b-41d4-a716-446655440050',
 'Radish',
 'Rábano. Crisp red radishes with a peppery bite — slice raw into salads, or pickle for a punch of colour.',
 'Crisp red radishes with a peppery bite.',
 'V-016', 'Vegetables', 'Fresh Vegetables', ARRAY['local','medellin'],
 6615, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-radish', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440081', '660e8400-e29b-41d4-a716-446655440050',
 'Yellow Bell Pepper',
 'Pimentón Amarillo. Sweet, golden yellow peppers — roast, stuff, or eat raw. Milder and fruitier than the red.',
 'Sweet, golden yellow peppers — roast, stuff, or raw.',
 'V-017', 'Vegetables', 'Fresh Vegetables', ARRAY['local','medellin'],
 8269, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-yellow-bell-pepper', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440082', '660e8400-e29b-41d4-a716-446655440050',
 'Snow Peas',
 'Arveja Vaina. Crisp snow pea pods — stir-fry whole, blanch for salads, or eat raw. Quick to cook, sweet on the bite.',
 'Crisp snow pea pods — quick to cook, sweet on the bite.',
 'V-018', 'Vegetables', 'Fresh Vegetables', ARRAY['local','medellin'],
 8710, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-snow-peas', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440083', '660e8400-e29b-41d4-a716-446655440050',
 'Hot Pepper',
 'Ají Pique. Fiery Colombian hot peppers — mince into salsas, infuse vinegars, or simmer one in a pot for slow heat.',
 'Fiery Colombian hot peppers — for salsas and slow heat.',
 'V-019', 'Vegetables', 'Fresh Vegetables', ARRAY['local','medellin'],
 10805, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-hot-pepper', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440084', '660e8400-e29b-41d4-a716-446655440050',
 'Sweet Pepper',
 'Ají Dulce. Sweet, fragrant Colombian peppers with no heat — the secret to authentic sofrito, stews, and rice dishes.',
 'Sweet, fragrant peppers — sofrito essentials, no heat.',
 'V-020', 'Vegetables', 'Fresh Vegetables', ARRAY['local','medellin'],
 10805, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-sweet-pepper', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440085', '660e8400-e29b-41d4-a716-446655440050',
 'European Cucumber',
 'Pepino Europeo. Long, thin-skinned cucumbers — seedless, no peeling required. Slice for salads, sandwiches, or tzatziki.',
 'Long, thin-skinned cucumbers — seedless, no peeling.',
 'V-021', 'Vegetables', 'Fresh Vegetables', ARRAY['local','medellin'],
 13120, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-european-cucumber', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440086', '660e8400-e29b-41d4-a716-446655440050',
 'Shelled Beans',
 'Frijol Desgranado. Already-shelled fresh beans — straight into the pot, no soaking needed. Ready for sancocho, frijoles, and stews.',
 'Already-shelled fresh beans — straight into the pot.',
 'V-022', 'Vegetables', 'Fresh Vegetables', ARRAY['local','medellin'],
 13616, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-shelled-beans', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440087', '660e8400-e29b-41d4-a716-446655440050',
 'Shelled Peas',
 'Arveja Desgranada. Fresh peas shelled and ready to use — sweet, tender, and quick to cook. Toss into risottos, soups, or pasta.',
 'Fresh peas shelled and ready — sweet, tender, quick.',
 'V-023', 'Vegetables', 'Fresh Vegetables', ARRAY['local','medellin'],
 27563, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-shelled-peas', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440088', '660e8400-e29b-41d4-a716-446655440050',
 'Mushroom',
 'Champiñón. White button mushrooms — sauté, roast, or stir into pasta. A versatile umami boost for any dish.',
 'White button mushrooms — sauté, roast, or stir into pasta.',
 'V-024', 'Vegetables', 'Fresh Vegetables', ARRAY['local','medellin'],
 39690, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-mushroom', 'col', '550e8400-e29b-41d4-a716-446655440050'),

-- ── ROOTS & TUBERS ────────────────────────────────────────────────────────
('770e8400-e29b-41d4-a716-446655440089', '660e8400-e29b-41d4-a716-446655440050',
 'Arracacha',
 'Arracacha. A traditional Andean root — somewhere between a parsnip and a celery root. Roast, mash, or simmer into sancocho.',
 'A traditional Andean root — roast, mash, or stew.',
 'R-005', 'Vegetables', 'Roots & Tubers', ARRAY['local','medellin'],
 6500, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-arracacha', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440090', '660e8400-e29b-41d4-a716-446655440050',
 'Capira Potato',
 'Papa Capira. A creamy white-fleshed Colombian potato — ideal for boiling, mashing, and stewing. Soft texture, mild flavour.',
 'A creamy white Colombian potato — boil, mash, stew.',
 'R-006', 'Vegetables', 'Roots & Tubers', ARRAY['local','medellin'],
 3900, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-capira-potato', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440091', '660e8400-e29b-41d4-a716-446655440050',
 'Nevada Potato',
 'Papa Nevada. A fluffy, dry-fleshed white potato — perfect for fries, roasting, and gnocchi. Holds its shape well.',
 'A fluffy, dry-fleshed potato — fries, roast, gnocchi.',
 'R-007', 'Vegetables', 'Roots & Tubers', ARRAY['local','medellin'],
 9592, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-nevada-potato', 'col', '550e8400-e29b-41d4-a716-446655440050'),

-- ── FRESH FRUIT ───────────────────────────────────────────────────────────
('770e8400-e29b-41d4-a716-446655440092', '660e8400-e29b-41d4-a716-446655440050',
 'Plantain',
 'Plátano Harto. Ripe plantains — slice and fry into sweet maduros, or bake into postres. Golden flesh, larger than regular bananas.',
 'Ripe plantains — slice and fry into sweet maduros.',
 'F-009', 'Fruits', 'Fresh Fruit', ARRAY['local','medellin'],
 3900, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-plantain', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440093', '660e8400-e29b-41d4-a716-446655440050',
 'Sugar Mango',
 'Mango de Azúcar. Small, intensely sweet Colombian mangoes — fragrant and fibre-free. Eat whole, blend into batidos, or freeze for sorbet.',
 'Small, intensely sweet Colombian mangoes.',
 'F-010', 'Fruits', 'Fresh Fruit', ARRAY['local','medellin'],
 6800, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', true, false, true,
 'medellin-sugar-mango', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440094', '660e8400-e29b-41d4-a716-446655440050',
 'Mandarin',
 'Mandarina. Easy-peel mandarin oranges — juicy, sweet, and snackable. Toss into salads or eat by the handful.',
 'Easy-peel mandarins — juicy, sweet, snackable.',
 'F-011', 'Fruits', 'Fresh Fruit', ARRAY['local','medellin'],
 9900, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-mandarin', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440095', '660e8400-e29b-41d4-a716-446655440050',
 'Finger Banana',
 'Guineo. Small, sweet finger bananas — soft, fragrant, ideal for snacks, baby food, or smoothies. Eat ripe straight from the bunch.',
 'Small, sweet finger bananas — snack and smoothie ready.',
 'F-012', 'Fruits', 'Fresh Fruit', ARRAY['local','medellin'],
 2867, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-finger-banana', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440096', '660e8400-e29b-41d4-a716-446655440050',
 'Tangelo',
 'Naranja Tangelo. A bell-shaped citrus hybrid — tangerine sweetness with grapefruit zing. Peels easy, juices clean.',
 'A bell-shaped citrus hybrid — tangerine sweet, grapefruit zing.',
 'F-013', 'Fruits', 'Fresh Fruit', ARRAY['local','medellin'],
 8710, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-tangelo', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440097', '660e8400-e29b-41d4-a716-446655440050',
 'Soursop',
 'Guanábana. A creamy, custard-like tropical fruit — scoop the flesh straight, or blend into juices, ice creams, and batidos.',
 'A creamy, custard-like tropical fruit — scoop or blend.',
 'F-014', 'Fruits', 'Fresh Fruit', ARRAY['local','medellin'],
 9371, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', true, false, true,
 'medellin-soursop', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440098', '660e8400-e29b-41d4-a716-446655440050',
 'Criollo Lime',
 'Limón Criollo. The traditional Colombian lime — smaller and tarter than the Tahití, with intense aromatic oils. Essential for ceviche.',
 'The traditional Colombian lime — tart, aromatic, ceviche-ready.',
 'F-015', 'Fruits', 'Fresh Fruit', ARRAY['local','medellin'],
 9371, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-criollo-lime', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440099', '660e8400-e29b-41d4-a716-446655440050',
 'Star Fruit',
 'Carambola. Crisp, juicy star fruit — slice across the ridges for picture-perfect stars in salads, drinks, or as a garnish.',
 'Crisp, juicy star fruit — slice for picture-perfect stars.',
 'F-016', 'Fruits', 'Fresh Fruit', ARRAY['local','medellin'],
 11356, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-star-fruit', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440100', '660e8400-e29b-41d4-a716-446655440050',
 'Granadilla',
 'Granadilla. The sweeter, milder cousin of passion fruit — crack the shell and scoop the gelatinous seeds. No sugar needed.',
 'Sweet, mild passion fruit cousin — crack and scoop.',
 'F-017', 'Fruits', 'Fresh Fruit', ARRAY['local','medellin'],
 15215, 'COP', 100, 'kg', 1.00,
 '1 kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-granadilla', 'col', '550e8400-e29b-41d4-a716-446655440050'),

-- ── FRESH SEAFOOD ─────────────────────────────────────────────────────────
('770e8400-e29b-41d4-a716-446655440101', '660e8400-e29b-41d4-a716-446655440050',
 'Salmon Fillet',
 'Filete de Salmón. Premium salmon fillet — vacuum-sealed, skin-on. Order cutoff 11am for same-day delivery. Priced per kilogram.',
 'Premium salmon fillet — skin-on, vacuum-sealed.',
 'S-004', 'Seafood', 'Fresh Seafood', ARRAY['local','medellin','seafood'],
 54500, 'COP', 30, 'kg', 1.00,
 'per kg', 'new', 'Procur Medellín',
 'active', true, false, true,
 'medellin-salmon-fillet', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440102', '660e8400-e29b-41d4-a716-446655440050',
 'Tiger Shrimp',
 'Camarón Tigre. Frozen tiger shrimp — shell-on, deveined. Sold by the ~1 kg lot. Order cutoff 11am for same-day delivery.',
 'Tiger shrimp — shell-on, deveined. ~1 kg lot.',
 'S-005', 'Seafood', 'Fresh Seafood', ARRAY['local','medellin','seafood'],
 23562, 'COP', 30, 'piece', 1.00,
 '~1 kg lot', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-tiger-shrimp', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440103', '660e8400-e29b-41d4-a716-446655440050',
 'Prepared Shrimp Ceviche',
 'Ceviche de Camarones. Ready-to-eat shrimp ceviche — citrus-marinated, with onion and cilantro. Single-serve portion, refrigerated.',
 'Ready-to-eat shrimp ceviche — single-serve, citrus-marinated.',
 'S-006', 'Seafood', 'Prepared', ARRAY['local','medellin','seafood','prepared'],
 9000, 'COP', 30, 'piece', 0.30,
 'single serve', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-shrimp-ceviche', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440104', '660e8400-e29b-41d4-a716-446655440050',
 'Striped Catfish',
 'Bagre Rayado. Whole striped catfish — firm white flesh, mild flavour. Great grilled, baked, or in coconut stews. 11am cutoff for same-day.',
 'Whole striped catfish — firm white flesh, mild flavour.',
 'S-007', 'Seafood', 'Fresh Seafood', ARRAY['local','medellin','seafood'],
 74000, 'COP', 30, 'kg', 1.00,
 'per kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-striped-catfish', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440105', '660e8400-e29b-41d4-a716-446655440050',
 'Pirarucu Fillet',
 'Filete de Pirarucú. Premium Amazonian river fish — boneless white fillets, mild and firm. A sustainable luxury catch.',
 'Premium Amazonian river fish — boneless, mild, firm.',
 'S-008', 'Seafood', 'Fresh Seafood', ARRAY['local','medellin','seafood'],
 98462, 'COP', 30, 'kg', 1.00,
 'per kg', 'new', 'Procur Medellín',
 'active', false, false, true,
 'medellin-pirarucu-fillet', 'col', '550e8400-e29b-41d4-a716-446655440050'),

('770e8400-e29b-41d4-a716-446655440106', '660e8400-e29b-41d4-a716-446655440050',
 'Corvina Fillet',
 'Filete de Corvina. Top-grade corvina fillet — delicate, sweet, and prized for ceviche and sashimi. Same-day fresh, 11am cutoff.',
 'Top-grade corvina fillet — delicate, sweet, sashimi-grade.',
 'S-009', 'Seafood', 'Fresh Seafood', ARRAY['local','medellin','seafood'],
 150000, 'COP', 30, 'kg', 1.00,
 'per kg', 'new', 'Procur Medellín',
 'active', true, false, true,
 'medellin-corvina-fillet', 'col', '550e8400-e29b-41d4-a716-446655440050')

ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 3. PRODUCT IMAGES — one Unsplash photo per new SKU
-- ============================================================================
-- URLs use canonical Unsplash photo IDs in the format CDN already accepts via
-- procur-ui/next.config.ts. Best-effort selection — swap any 404s post-deploy.

INSERT INTO product_images (product_id, image_url, alt_text, display_order, is_primary) VALUES
('770e8400-e29b-41d4-a716-446655440073', 'https://images.unsplash.com/photo-1551884170-09fb70a3a2ed?auto=format&fit=crop&w=1200&q=80', 'Purple cabbage',           0, true),
('770e8400-e29b-41d4-a716-446655440074', 'https://images.unsplash.com/photo-1601493700631-2b16ec4b4716?auto=format&fit=crop&w=1200&q=80', 'Glossy purple eggplants',  0, true),
('770e8400-e29b-41d4-a716-446655440075', 'https://images.unsplash.com/photo-1599810913055-29c3ba317a26?auto=format&fit=crop&w=1200&q=80', 'Spring onions',            0, true),
('770e8400-e29b-41d4-a716-446655440076', 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?auto=format&fit=crop&w=1200&q=80', 'Fresh carrots',            0, true),
('770e8400-e29b-41d4-a716-446655440077', 'https://images.unsplash.com/photo-1610367384238-d24c1bc8e98a?auto=format&fit=crop&w=1200&q=80', 'String beans in pods',     0, true),
('770e8400-e29b-41d4-a716-446655440078', 'https://images.unsplash.com/photo-1615477550927-6ec8444fc9be?auto=format&fit=crop&w=1200&q=80', 'Whole garlic heads',       0, true),
('770e8400-e29b-41d4-a716-446655440079', 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=1200&q=80', 'Sweet corn on the cob',    0, true),
('770e8400-e29b-41d4-a716-446655440080', 'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?auto=format&fit=crop&w=1200&q=80', 'Red radishes',             0, true),
('770e8400-e29b-41d4-a716-446655440081', 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?auto=format&fit=crop&w=1200&q=80', 'Yellow bell peppers',      0, true),
('770e8400-e29b-41d4-a716-446655440082', 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=1200&q=80', 'Snow pea pods',            0, true),
('770e8400-e29b-41d4-a716-446655440083', 'https://images.unsplash.com/photo-1583119912267-cc97c911e416?auto=format&fit=crop&w=1200&q=80', 'Fiery hot peppers',        0, true),
('770e8400-e29b-41d4-a716-446655440084', 'https://images.unsplash.com/photo-1573414045809-9c8a85c79734?auto=format&fit=crop&w=1200&q=80', 'Sweet aromatic peppers',   0, true),
('770e8400-e29b-41d4-a716-446655440085', 'https://images.unsplash.com/photo-1568584711271-946d6a791e1f?auto=format&fit=crop&w=1200&q=80', 'European cucumbers',       0, true),
('770e8400-e29b-41d4-a716-446655440086', 'https://images.unsplash.com/photo-1610725664285-7c57e6eeac3f?auto=format&fit=crop&w=1200&q=80', 'Shelled fresh beans',      0, true),
('770e8400-e29b-41d4-a716-446655440087', 'https://images.unsplash.com/photo-1587735243615-c03f25aaff15?auto=format&fit=crop&w=1200&q=80', 'Shelled fresh peas',       0, true),
('770e8400-e29b-41d4-a716-446655440088', 'https://images.unsplash.com/photo-1518257105069-7a8e0fcc8c97?auto=format&fit=crop&w=1200&q=80', 'White button mushrooms',   0, true),
('770e8400-e29b-41d4-a716-446655440089', 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=1200&q=80', 'Andean arracacha root',    0, true),
('770e8400-e29b-41d4-a716-446655440090', 'https://images.unsplash.com/photo-1567393528677-d6adae7d4a0a?auto=format&fit=crop&w=1200&q=80', 'Capira potatoes',          0, true),
('770e8400-e29b-41d4-a716-446655440091', 'https://images.unsplash.com/photo-1591767969793-c98b71fae0fd?auto=format&fit=crop&w=1200&q=80', 'Nevada white potatoes',    0, true),
('770e8400-e29b-41d4-a716-446655440092', 'https://images.unsplash.com/photo-1601396966036-91066d34e7b8?auto=format&fit=crop&w=1200&q=80', 'Ripe yellow plantains',    0, true),
('770e8400-e29b-41d4-a716-446655440093', 'https://images.unsplash.com/photo-1605027990121-cbae9e6db6f6?auto=format&fit=crop&w=1200&q=80', 'Sweet sugar mangoes',      0, true),
('770e8400-e29b-41d4-a716-446655440094', 'https://images.unsplash.com/photo-1582979512210-99b6a53386f9?auto=format&fit=crop&w=1200&q=80', 'Easy-peel mandarins',      0, true),
('770e8400-e29b-41d4-a716-446655440095', 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?auto=format&fit=crop&w=1200&q=80', 'Small finger bananas',     0, true),
('770e8400-e29b-41d4-a716-446655440096', 'https://images.unsplash.com/photo-1581345628965-9adb04bc6a35?auto=format&fit=crop&w=1200&q=80', 'Tangelo citrus',           0, true),
('770e8400-e29b-41d4-a716-446655440097', 'https://images.unsplash.com/photo-1638725666738-cbf26c898ee1?auto=format&fit=crop&w=1200&q=80', 'Soursop / guanábana',      0, true),
('770e8400-e29b-41d4-a716-446655440098', 'https://images.unsplash.com/photo-1622957461168-202696b41121?auto=format&fit=crop&w=1200&q=80', 'Criollo limes',            0, true),
('770e8400-e29b-41d4-a716-446655440099', 'https://images.unsplash.com/photo-1606043517305-2caa1c1b97a8?auto=format&fit=crop&w=1200&q=80', 'Fresh star fruit',         0, true),
('770e8400-e29b-41d4-a716-446655440100', 'https://images.unsplash.com/photo-1604578762246-41134e37f9cc?auto=format&fit=crop&w=1200&q=80', 'Granadilla fruit',         0, true),
('770e8400-e29b-41d4-a716-446655440101', 'https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?auto=format&fit=crop&w=1200&q=80', 'Salmon fillet',            0, true),
('770e8400-e29b-41d4-a716-446655440102', 'https://images.unsplash.com/photo-1565280654386-466e3f1b1f1d?auto=format&fit=crop&w=1200&q=80', 'Tiger shrimp',             0, true),
('770e8400-e29b-41d4-a716-446655440103', 'https://images.unsplash.com/photo-1535860117833-5d4b13c25c39?auto=format&fit=crop&w=1200&q=80', 'Shrimp ceviche',           0, true),
('770e8400-e29b-41d4-a716-446655440104', 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1200&q=80', 'Whole striped catfish',    0, true),
('770e8400-e29b-41d4-a716-446655440105', 'https://images.unsplash.com/photo-1606851091230-c4d2bb33b1a3?auto=format&fit=crop&w=1200&q=80', 'Pirarucú fillet',          0, true),
('770e8400-e29b-41d4-a716-446655440106', 'https://images.unsplash.com/photo-1517181923826-67c5e75e6c10?auto=format&fit=crop&w=1200&q=80', 'Corvina fillet',           0, true)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE products IS
    'Products table. Procur Medellín seller (660e8400-...440050) now lists 57 SKUs after May 2026 catalogue refresh in 20260523000000_update_procur_medellin_catalogue_may.sql.';
