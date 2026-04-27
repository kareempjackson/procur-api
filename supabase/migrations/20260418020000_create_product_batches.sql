-- Batch / lot tracking for packaged goods.
-- A "batch" is a production run with a batch code, best-by date, and initial
-- quantity. As orders ship, we consume `remaining` from the batch.
--
-- Why: food-safety compliance and recall traceability. Before any real food
-- seller goes live, every jar needs a batch code and a best-by date.
--
-- Trade-off: this table becomes the source of truth for sellable stock once
-- a product has batches. We do NOT drop products.stock_quantity — it remains
-- a fallback for sellers who don't track batches. See products_with_stock
-- view for the unified read path.

CREATE TABLE IF NOT EXISTS product_batches (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    seller_org_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    batch_code      VARCHAR(100) NOT NULL,
    produced_on     DATE,
    best_by         DATE,

    quantity        INTEGER NOT NULL,   -- initial size of this batch
    remaining       INTEGER NOT NULL,   -- decremented as orders ship

    notes           TEXT,

    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE (product_id, batch_code),
    CONSTRAINT check_batch_quantity
        CHECK (quantity > 0),
    CONSTRAINT check_batch_remaining
        CHECK (remaining >= 0 AND remaining <= quantity),
    CONSTRAINT check_batch_dates
        CHECK (best_by IS NULL OR produced_on IS NULL OR best_by >= produced_on)
);

-- Fast FEFO (first-expiring-first-out) allocation. Partial index on batches
-- that actually have stock to avoid scanning depleted ones.
CREATE INDEX IF NOT EXISTS idx_batches_fefo
    ON product_batches (product_id, best_by)
    WHERE remaining > 0;

CREATE INDEX IF NOT EXISTS idx_batches_seller_org
    ON product_batches (seller_org_id);

-- Link order_items to the batch they consumed from. NULL means either the
-- order pre-dates batch tracking, or the product doesn't track batches.
ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES product_batches(id);

CREATE INDEX IF NOT EXISTS idx_order_items_batch
    ON order_items (batch_id)
    WHERE batch_id IS NOT NULL;

-- Unified read: total sellable stock across all non-depleted, non-expired
-- batches for a product. Sellers who don't use batches still see their
-- products.stock_quantity as the authoritative number.
CREATE OR REPLACE VIEW products_with_stock AS
SELECT
    p.*,
    COALESCE(
        (
            SELECT SUM(b.remaining)::INTEGER
            FROM product_batches b
            WHERE b.product_id = p.id
              AND b.remaining > 0
              AND (b.best_by IS NULL OR b.best_by >= CURRENT_DATE)
        ),
        p.stock_quantity
    ) AS sellable_stock,
    EXISTS (
        SELECT 1 FROM product_batches b
        WHERE b.product_id = p.id AND b.remaining > 0
    ) AS has_batches
FROM products p;

COMMENT ON TABLE product_batches IS
    'Production runs with batch codes, best-by dates, and decrementing remaining stock. FEFO allocator at fulfillment time.';
COMMENT ON COLUMN product_batches.remaining IS
    'Decrements when orders ship. When 0, the batch is done. When best_by passes, the batch is dead stock.';
COMMENT ON VIEW products_with_stock IS
    'Authoritative read-side for "how much can I actually sell?" Falls back to products.stock_quantity when no batches exist.';
