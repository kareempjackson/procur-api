-- Product variants: one product → many sellable SKUs.
-- Example: "Passionfruit Preserve" with variants (250g Jar, 500g Jar, 1kg Jar).
--
-- Design notes:
--
--   1. option_types define the axes ("Size", "Flavor"). Each product has 0..N.
--   2. product_variants are the cartesian products of option values, each with
--      its own SKU, price, stock, and image. A product with no variants continues
--      to work via the existing products.* columns — the backfill creates a
--      synthetic "default" variant ONLY for products whose sellers opt in.
--   3. cart_items and order_items gain a nullable variant_id. NULL means the
--      buyer ordered the product directly (no variant selection). Price and
--      stock resolution prefer variant when set.
--
-- Why last in the rollout: every cart, order, fulfillment, and search path
-- currently assumes (product_id, qty). Opting into variants is a seller-level
-- decision; we do not force-migrate existing products.

CREATE TABLE IF NOT EXISTS product_option_types (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name       VARCHAR(50) NOT NULL,
    position   INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (product_id, name)
);

CREATE INDEX IF NOT EXISTS idx_option_types_product
    ON product_option_types (product_id, position);

CREATE TABLE IF NOT EXISTS product_variants (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    sku              VARCHAR(100),
    barcode          VARCHAR(100),

    -- e.g. { "Size": "250g", "Flavor": "Original" }
    option_values    JSONB NOT NULL DEFAULT '{}'::JSONB,

    -- NULL price fields inherit from the parent product's columns.
    base_price       DECIMAL(10,2),
    sale_price       DECIMAL(10,2),
    wholesale_price  DECIMAL(10,2),

    weight           DECIMAL(8,2),
    stock_quantity   INTEGER NOT NULL DEFAULT 0,
    min_stock_level  INTEGER,

    image_url        TEXT,
    position         INTEGER NOT NULL DEFAULT 0,

    is_default       BOOLEAN NOT NULL DEFAULT false,
    is_active        BOOLEAN NOT NULL DEFAULT true,

    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT check_variant_stock
        CHECK (stock_quantity >= 0),
    CONSTRAINT check_variant_prices
        CHECK (
            (base_price IS NULL OR base_price > 0)
            AND (sale_price IS NULL OR sale_price >= 0)
            AND (wholesale_price IS NULL OR wholesale_price > 0)
        )
);

-- SKU uniqueness within a product. Cross-product SKU collisions are fine.
CREATE UNIQUE INDEX IF NOT EXISTS ux_variants_product_sku
    ON product_variants (product_id, sku)
    WHERE sku IS NOT NULL;

-- At most one default variant per product. Used when a buyer hits "Add to cart"
-- on a variant product without picking options explicitly.
CREATE UNIQUE INDEX IF NOT EXISTS ux_variants_product_default
    ON product_variants (product_id)
    WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_variants_product_active
    ON product_variants (product_id, position)
    WHERE is_active = true;

-- Line items optionally reference a variant. NULL = product-level order
-- (either the product doesn't have variants, or the buyer ordered the default).
ALTER TABLE cart_items
    ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id);

ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id);

CREATE INDEX IF NOT EXISTS idx_cart_items_variant
    ON cart_items (variant_id)
    WHERE variant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_variant
    ON order_items (variant_id)
    WHERE variant_id IS NOT NULL;

COMMENT ON TABLE product_option_types IS
    'Axes of variation for a product — "Size", "Flavor", "Color". Position controls display order.';
COMMENT ON TABLE product_variants IS
    'A single sellable SKU. option_values is the combination of option-type values that define it.';
COMMENT ON COLUMN product_variants.base_price IS
    'Variant-level price override. NULL falls back to products.base_price.';
COMMENT ON COLUMN product_variants.is_default IS
    'The variant chosen when a buyer taps "Add to cart" without picking options explicitly.';
