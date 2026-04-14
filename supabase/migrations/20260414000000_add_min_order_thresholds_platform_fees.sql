-- Add admin-configurable minimum order thresholds to platform_fees_config.
-- These are enforced server-side at checkout (procur-api BuyersService.createOrder)
-- and surfaced to buyers in the cart UI so the seller delivery fee remains
-- economically viable.

ALTER TABLE platform_fees_config
ADD COLUMN IF NOT EXISTS min_order_per_seller NUMERIC(10,2) NOT NULL DEFAULT 75.0,
ADD COLUMN IF NOT EXISTS min_order_total NUMERIC(10,2) NOT NULL DEFAULT 100.0;

-- Backfill any existing row to the new defaults if somehow null.
UPDATE platform_fees_config
SET min_order_per_seller = COALESCE(min_order_per_seller, 75.0),
    min_order_total      = COALESCE(min_order_total, 100.0);
