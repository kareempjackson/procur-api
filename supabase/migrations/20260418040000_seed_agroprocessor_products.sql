-- Seed the dev agroprocessor org (Harvest Kitchen Co.) with a packaged-goods
-- catalogue that exercises every field added across the four scopes:
--   · Labelling     — ingredients, allergens, nutrition
--   · Wholesale     — case pack, MOQ, order increment, wholesale tier
--   · Batches       — at least one product with a live production batch
--   · Variants      — at least one product with multiple SKUs
--
-- Images point to Unsplash (already whitelisted in procur-ui/next.config.ts).
--
-- Depends on:
--   20260417120000_seed_agroprocessor_dev_user.sql   (creates the org)
--   20260418000000 — 20260418030000                  (the four scope migrations)
--
-- Safe to re-run: INSERT … ON CONFLICT (id) DO NOTHING everywhere.

-- Anchor IDs for traceability in the seed (so future migrations can reference).
DO $$
DECLARE
    org_id       UUID := '660e8400-e29b-41d4-a716-446655440020';
    user_id      UUID := '550e8400-e29b-41d4-a716-446655440020';

    p_preserve   UUID := '770e8400-e29b-41d4-a716-446655440020';
    p_hotsauce   UUID := '770e8400-e29b-41d4-a716-446655440021';
    p_chutney    UUID := '770e8400-e29b-41d4-a716-446655440022';
    p_syrup      UUID := '770e8400-e29b-41d4-a716-446655440023';
    p_oil        UUID := '770e8400-e29b-41d4-a716-446655440024';
    p_bunspice   UUID := '770e8400-e29b-41d4-a716-446655440025';

    v_hs_orig    UUID := '880e8400-e29b-41d4-a716-446655440201';
    v_hs_xhot    UUID := '880e8400-e29b-41d4-a716-446655440202';
    v_hs_smoky   UUID := '880e8400-e29b-41d4-a716-446655440203';

    b_preserve   UUID := '990e8400-e29b-41d4-a716-446655440301';
    b_chutney    UUID := '990e8400-e29b-41d4-a716-446655440302';
    b_syrup      UUID := '990e8400-e29b-41d4-a716-446655440303';
BEGIN

-- ============================================================================
-- PRODUCTS
-- ============================================================================

INSERT INTO products (
    id, seller_org_id, name, description, short_description,
    sku, barcode, category, subcategory, tags,
    base_price, sale_price, currency,
    stock_quantity, min_stock_level, unit_of_measurement, weight,
    condition, brand, size, status,
    is_featured, is_organic, is_local,
    meta_title, meta_description, slug,
    created_by,
    ingredients, allergen_statement, allergens, contains_alcohol, nutrition,
    case_pack, min_order_quantity, order_increment, wholesale_price, wholesale_min_qty
) VALUES

-- ── 1. Passionfruit Preserve ────────────────────────────────────────────────
(p_preserve, org_id,
 'Passionfruit Preserve',
 'Slow-cooked preserve made from ripe Grenadian passionfruit, cane sugar, and a splash of lemon. No pectin, no shortcuts — just fruit reduced on low heat until it gels naturally.',
 'Small-batch passionfruit preserve, 250g jar.',
 'HKC-PF-250', '0123456789012', 'Condiments & Sauces', 'Jams & Preserves',
 ARRAY['small-batch','handmade','shelf-stable','local','organic'],
 8.50, NULL, 'USD',
 240, 24, 'piece', 0.30,
 'new', 'Harvest Kitchen', '250g jar', 'active',
 true, true, true,
 'Passionfruit Preserve · 250g', 'Small-batch Grenadian passionfruit preserve. No pectin.', 'passionfruit-preserve',
 user_id,
 'Passionfruit (58%), cane sugar, lemon juice.',
 'Produced in a kitchen that also handles tree nuts and sesame.',
 ARRAY['tree_nuts','sesame']::TEXT[],
 false,
 '{"serving_size":"2 tbsp (30g)","servings_per_container":8,"calories":45,"fat_g":0,"sodium_mg":5,"carbs_g":11,"sugar_g":10,"protein_g":0}'::JSONB,
 12, 1, 1, 7.25, 24),

-- ── 2. Scotch Bonnet Hot Sauce (has variants) ───────────────────────────────
(p_hotsauce, org_id,
 'Scotch Bonnet Hot Sauce',
 'Our base sauce: scotch bonnet peppers fermented for three weeks with onion, garlic, cane vinegar, and a little island salt. Three intensities available.',
 'Fermented scotch bonnet hot sauce, 150ml bottles.',
 'HKC-SB',  '0123456789029', 'Condiments & Sauces', 'Hot Sauce',
 ARRAY['small-batch','handmade','shelf-stable','local','vegan','gluten-free'],
 11.00, NULL, 'USD',
 600, 60, 'piece', 0.22,
 'new', 'Harvest Kitchen', '150ml bottle', 'active',
 true, false, true,
 'Scotch Bonnet Hot Sauce · Fermented', 'Fermented scotch bonnet hot sauce from Grenada. Vegan, gluten-free.', 'scotch-bonnet-hot-sauce',
 user_id,
 'Scotch bonnet peppers (64%), onion, garlic, cane vinegar, sea salt.',
 'Contains sulphites (naturally occurring in the vinegar).',
 ARRAY['sulphites']::TEXT[],
 false,
 '{"serving_size":"1 tsp (5ml)","servings_per_container":30,"calories":5,"sodium_mg":120,"carbs_g":1,"sugar_g":0,"protein_g":0}'::JSONB,
 24, 6, 6, 8.50, 24),

-- ── 3. Spiced Mango Chutney ─────────────────────────────────────────────────
(p_chutney, org_id,
 'Spiced Mango Chutney',
 'Julie mango, ginger, onion, brown sugar, and warming spices. Cooked slow until it thickens and the flavours bloom. Pairs with curry, cheese, or anything roasted.',
 'Mango chutney with ginger and warming spices, 300g jar.',
 'HKC-CH-300', '0123456789036', 'Condiments & Sauces', 'Chutneys',
 ARRAY['small-batch','shelf-stable','local','vegan'],
 9.75, 8.25, 'USD',
 180, 18, 'piece', 0.36,
 'new', 'Harvest Kitchen', '300g jar', 'active',
 false, false, true,
 'Spiced Mango Chutney · 300g', 'Grenadian mango chutney with ginger and warming spices.', 'spiced-mango-chutney',
 user_id,
 'Mango (52%), onion, cane sugar, apple cider vinegar, ginger, mustard seed, allspice, chili, salt.',
 'Contains mustard. Produced in a kitchen that handles tree nuts and sesame.',
 ARRAY['mustard','tree_nuts','sesame']::TEXT[],
 false,
 '{"serving_size":"1 tbsp (20g)","servings_per_container":15,"calories":35,"fat_g":0,"sodium_mg":90,"carbs_g":9,"sugar_g":8,"protein_g":0}'::JSONB,
 12, 6, 6, 7.00, 24),

-- ── 4. Grenadian Nutmeg Syrup ──────────────────────────────────────────────
(p_syrup, org_id,
 'Grenadian Nutmeg Syrup',
 'A bartender''s secret: pure nutmeg-infused simple syrup made from freshly grated Grenadian nutmeg. Adds warmth to cocktails, coffee, and baked goods.',
 'Nutmeg-infused simple syrup, 250ml bottle.',
 'HKC-NS-250', '0123456789043', 'Beverages', 'Cocktail Mixers',
 ARRAY['small-batch','handmade','shelf-stable','local'],
 14.00, NULL, 'USD',
 120, 12, 'piece', 0.32,
 'new', 'Harvest Kitchen', '250ml bottle', 'active',
 true, false, true,
 'Grenadian Nutmeg Syrup · 250ml', 'Nutmeg-infused simple syrup from Grenada. Handmade in small batches.', 'grenadian-nutmeg-syrup',
 user_id,
 'Cane sugar, water, whole Grenadian nutmeg, natural vanilla extract.',
 NULL,
 ARRAY[]::TEXT[],
 false,
 '{"serving_size":"1 tbsp (15ml)","servings_per_container":16,"calories":50,"carbs_g":13,"sugar_g":13}'::JSONB,
 12, 1, 1, 11.00, 12),

-- ── 5. Bay Rum Infused Cooking Oil ─────────────────────────────────────────
(p_oil, org_id,
 'Bay Leaf Infused Cooking Oil',
 'Cold-pressed island coconut oil steeped with fresh bay leaves from the hills of St. David''s. A finishing oil for roasted vegetables, fish, and grains.',
 'Bay-leaf-infused coconut oil, 500ml bottle.',
 'HKC-BO-500', '0123456789050', 'Oils & Fats', 'Infused Oils',
 ARRAY['small-batch','handmade','shelf-stable','local','vegan','gluten-free','dairy-free'],
 22.00, NULL, 'USD',
 75, 8, 'piece', 0.52,
 'new', 'Harvest Kitchen', '500ml bottle', 'active',
 false, false, true,
 'Bay Leaf Cooking Oil · 500ml', 'Cold-pressed coconut oil infused with bay leaves.', 'bay-leaf-cooking-oil',
 user_id,
 'Virgin coconut oil, fresh bay leaves.',
 NULL,
 ARRAY[]::TEXT[],
 false,
 '{"serving_size":"1 tbsp (14g)","servings_per_container":35,"calories":120,"fat_g":14,"sat_fat_g":12,"sodium_mg":0,"carbs_g":0,"sugar_g":0,"protein_g":0}'::JSONB,
 6, 1, 1, NULL, NULL),

-- ── 6. Cinnamon & Clove Bun Spice Mix ──────────────────────────────────────
(p_bunspice, org_id,
 'Cinnamon & Clove Bun Spice',
 'The exact blend we use for our Easter buns — cinnamon, clove, nutmeg, and allspice, ground fresh and packed in resealable pouches. Enough for four batches of buns.',
 'Warming spice blend for sweet breads, 120g pouch.',
 'HKC-BS-120', '0123456789067', 'Herbs & Spices', 'Spice Blends',
 ARRAY['handmade','shelf-stable','local','vegan','gluten-free'],
 7.50, NULL, 'USD',
 320, 32, 'bag', 0.14,
 'new', 'Harvest Kitchen', '120g pouch', 'active',
 false, false, true,
 'Cinnamon & Clove Bun Spice · 120g', 'Small-batch bun spice blend from Grenada.', 'cinnamon-clove-bun-spice',
 user_id,
 'Cinnamon, clove, nutmeg, allspice, ginger.',
 NULL,
 ARRAY[]::TEXT[],
 false,
 '{"serving_size":"1 tsp (2g)","servings_per_container":60,"calories":6,"carbs_g":1,"fiber_g":1,"protein_g":0}'::JSONB,
 24, 1, 1, 5.75, 24)

ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- PRODUCT IMAGES (Unsplash CDN)
-- ============================================================================

INSERT INTO product_images (product_id, image_url, alt_text, display_order, is_primary) VALUES
(p_preserve, 'https://images.unsplash.com/photo-1597528662465-55ece5734101?auto=format&fit=crop&w=1200&q=80', 'Passionfruit preserve jar', 0, true),
(p_preserve, 'https://images.unsplash.com/photo-1599848137006-8fed0b1f1a4c?auto=format&fit=crop&w=1200&q=80', 'Spreading preserve on toast', 1, false),

(p_hotsauce, 'https://images.unsplash.com/photo-1599050751795-6cdaafbc2319?auto=format&fit=crop&w=1200&q=80', 'Hot sauce bottles lined up', 0, true),
(p_hotsauce, 'https://images.unsplash.com/photo-1528750717929-32abb73d3bd3?auto=format&fit=crop&w=1200&q=80', 'Fresh scotch bonnet peppers', 1, false),

(p_chutney, 'https://images.unsplash.com/photo-1564277287253-c248b86bd98f?auto=format&fit=crop&w=1200&q=80', 'Spiced mango chutney jar', 0, true),

(p_syrup, 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=1200&q=80', 'Nutmeg syrup bottle', 0, true),

(p_oil, 'https://images.unsplash.com/photo-1597318236308-b04b4cb4a3b8?auto=format&fit=crop&w=1200&q=80', 'Bay leaf infused cooking oil', 0, true),

(p_bunspice, 'https://images.unsplash.com/photo-1599909533742-d0ba5b7bcbd2?auto=format&fit=crop&w=1200&q=80', 'Bun spice blend pouch', 0, true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VARIANTS — Scotch Bonnet Hot Sauce has three heat levels
-- ============================================================================

-- Declare option-type axes
INSERT INTO product_option_types (product_id, name, position) VALUES
(p_hotsauce, 'Heat', 0)
ON CONFLICT DO NOTHING;

-- Three variants at $1-2 above the base price for higher heat
INSERT INTO product_variants (
    id, product_id, sku, barcode, option_values,
    base_price, wholesale_price, weight,
    stock_quantity, position, is_default, is_active
) VALUES
(v_hs_orig, p_hotsauce, 'HKC-SB-150-OG', '0123456789104',
 '{"Heat":"Original"}'::JSONB,
 11.00, 8.50, 0.22,
 240, 0, true, true),
(v_hs_xhot, p_hotsauce, 'HKC-SB-150-XH', '0123456789111',
 '{"Heat":"Extra Hot"}'::JSONB,
 12.50, 9.75, 0.22,
 180, 1, false, true),
(v_hs_smoky, p_hotsauce, 'HKC-SB-150-SM', '0123456789128',
 '{"Heat":"Smoked"}'::JSONB,
 13.50, 10.75, 0.22,
 120, 2, false, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- BATCHES — three products with live production runs
-- ============================================================================

INSERT INTO product_batches (
    id, product_id, seller_org_id,
    batch_code, produced_on, best_by,
    quantity, remaining, notes, created_by
) VALUES
(b_preserve, p_preserve, org_id,
 'HKC-PF-20260401-01', '2026-04-01', '2027-10-01',
 240, 216,
 'First pressing of the April passionfruit harvest. Reduction ran 95 minutes.',
 user_id),
(b_chutney, p_chutney, org_id,
 'HKC-CH-20260320-02', '2026-03-20', '2027-03-20',
 180, 156,
 'Julie mango — picked at peak sweetness. Added extra ginger per last year''s feedback.',
 user_id),
(b_syrup, p_syrup, org_id,
 'HKC-NS-20260410-01', '2026-04-10', '2027-04-10',
 120, 98,
 'Single-origin nutmeg from Gouyave. Steeped 7 days.',
 user_id)
ON CONFLICT (id) DO NOTHING;

END $$;

-- Sanity check: the dev agroprocessor now has a real catalogue.
COMMENT ON TABLE products IS
    'Products table. Dev agroprocessor org 660e8400-...440020 (Harvest Kitchen Co.) seeds 6 packaged goods, 3 variants, 3 batches in 20260418040000_seed_agroprocessor_products.sql.';
