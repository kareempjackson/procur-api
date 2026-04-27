-- B2B wholesale fields: case pack, MOQ, order increment, wholesale tier.
-- Purely additive. Existing rows behave as before (moq=1, increment=1).
--
-- Why: agroprocessors sell into restaurants and hotels, not just DTC. The
-- difference between "I can sell a jar" and "I can sell to Spice Island
-- Hotels' purchasing manager" is enforced minimums and a tiered price.

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS case_pack          INTEGER,
    ADD COLUMN IF NOT EXISTS min_order_quantity INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS order_increment    INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS wholesale_price    DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS wholesale_min_qty  INTEGER;

ALTER TABLE products
    ADD CONSTRAINT check_case_pack
        CHECK (case_pack IS NULL OR case_pack > 0);

ALTER TABLE products
    ADD CONSTRAINT check_min_order_quantity
        CHECK (min_order_quantity > 0);

ALTER TABLE products
    ADD CONSTRAINT check_order_increment
        CHECK (order_increment > 0);

ALTER TABLE products
    ADD CONSTRAINT check_wholesale_price
        CHECK (wholesale_price IS NULL OR wholesale_price > 0);

ALTER TABLE products
    ADD CONSTRAINT check_wholesale_min_qty
        CHECK (
            wholesale_min_qty IS NULL
            OR (wholesale_min_qty > 0 AND wholesale_price IS NOT NULL)
        );

COMMENT ON COLUMN products.case_pack IS
    'Units per case. Used for display ("12 / case") and for order_increment hinting.';
COMMENT ON COLUMN products.min_order_quantity IS
    'Minimum qty a buyer can put in their cart. Defaults to 1.';
COMMENT ON COLUMN products.order_increment IS
    'Buyers must order in multiples of this value. Defaults to 1 (no constraint).';
COMMENT ON COLUMN products.wholesale_price IS
    'B2B per-unit price unlocked once cart qty ≥ wholesale_min_qty.';
COMMENT ON COLUMN products.wholesale_min_qty IS
    'Threshold at which wholesale_price kicks in. Requires wholesale_price to also be set.';
