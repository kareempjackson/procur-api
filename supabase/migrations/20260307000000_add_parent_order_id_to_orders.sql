-- Migration: Add parent_order_id to support aggregate parent/child order hierarchy.
--
-- Model:
--   parent_order_id IS NULL  → top-level order (legacy or new single/multi-seller parent)
--   parent_order_id IS SET   → child/fulfillment order (one per seller inside a multi-seller checkout)
--
-- For new multi-seller checkouts:
--   1 parent row: seller_org_id = NULL, holds aggregate totals + buyer/payment info
--   N child rows: seller_org_id = each seller, parent_order_id = parent.id, items linked here
--
-- Existing rows are untouched (parent_order_id = NULL by default = legacy behavior preserved).

-- 1. Make seller_org_id nullable — parent orders span all sellers, so no single seller applies.
ALTER TABLE orders
  ALTER COLUMN seller_org_id DROP NOT NULL;

-- 2. Add the parent FK column.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS parent_order_id UUID REFERENCES orders(id) ON DELETE CASCADE;

COMMENT ON COLUMN orders.parent_order_id IS
  'NULL for top-level (parent or legacy) orders. Set on child/fulfillment orders to reference their aggregate parent.';

-- 3. Index for efficient lookup of all children belonging to a parent.
CREATE INDEX IF NOT EXISTS idx_orders_parent_order_id
  ON orders(parent_order_id)
  WHERE parent_order_id IS NOT NULL;

-- 4. Relax the full UNIQUE constraint on order_number.
--    Child rows intentionally share the same order_number as their parent so that
--    buyer and seller always see the same ORD-... reference number.
--    Uniqueness is enforced only on parent/legacy rows (parent_order_id IS NULL).
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_number_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number_parent_only
  ON orders(order_number)
  WHERE parent_order_id IS NULL;

-- 5. Keep the non-unique index on order_number for fast lookups (seller queries by order_number).
--    The existing idx_orders_order_number index stays; if it doesn't exist yet, create it.
CREATE INDEX IF NOT EXISTS idx_orders_order_number
  ON orders(order_number);
