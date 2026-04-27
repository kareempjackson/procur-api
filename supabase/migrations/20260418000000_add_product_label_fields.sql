-- Labelling fields for packaged goods: ingredients, allergens, nutrition.
-- Purely additive — existing rows default to NULL / empty array / false.
--
-- Why: agroprocessors sell finished goods (jars, bottles, pouches). Buyers
-- expect ingredient lists, allergen disclosure, and Nutrition Facts before
-- they'll trust a shelf-stable product. These are regulatory table-stakes
-- for any food-and-beverage marketplace.

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS ingredients        TEXT,
    ADD COLUMN IF NOT EXISTS allergen_statement TEXT,
    ADD COLUMN IF NOT EXISTS allergens          TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN IF NOT EXISTS contains_alcohol   BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS nutrition          JSONB;

-- Index for allergen-exclusion queries ("show me products WITHOUT peanuts").
-- GIN over text arrays is the right access pattern for ANY/ALL membership.
CREATE INDEX IF NOT EXISTS idx_products_allergens
    ON products USING GIN (allergens);

COMMENT ON COLUMN products.ingredients IS
    'Free-text ingredient list as it should appear on the label.';
COMMENT ON COLUMN products.allergen_statement IS
    'Free-text "Contains:" statement. Supplements the structured allergens array.';
COMMENT ON COLUMN products.allergens IS
    'Structured allergen codes drawn from a fixed vocabulary (peanuts, tree_nuts, milk, eggs, wheat, soy, fish, shellfish, sesame, mustard, celery, sulphites).';
COMMENT ON COLUMN products.nutrition IS
    'Nutrition Facts panel as JSON — { serving_size, calories, fat_g, sat_fat_g, sodium_mg, carbs_g, sugar_g, fiber_g, protein_g }. All fields optional.';
