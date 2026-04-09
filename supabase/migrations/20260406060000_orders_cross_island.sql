-- Migration: Add cross-island fields to orders
-- Description: Track origin/destination islands and shipping route on orders
-- Date: 2026-04-06

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS origin_island_code VARCHAR(4) REFERENCES islands(code),
  ADD COLUMN IF NOT EXISTS dest_island_code VARCHAR(4) REFERENCES islands(code),
  ADD COLUMN IF NOT EXISTS is_cross_island BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shipping_route_id UUID REFERENCES shipping_routes(id);

CREATE INDEX IF NOT EXISTS idx_orders_cross_island ON orders(is_cross_island) WHERE is_cross_island = true;
CREATE INDEX IF NOT EXISTS idx_orders_origin_island ON orders(origin_island_code);
CREATE INDEX IF NOT EXISTS idx_orders_dest_island ON orders(dest_island_code);

COMMENT ON COLUMN orders.origin_island_code IS 'Seller organization island';
COMMENT ON COLUMN orders.dest_island_code IS 'Buyer destination island';
COMMENT ON COLUMN orders.is_cross_island IS 'True if seller and buyer are on different islands';
COMMENT ON COLUMN orders.shipping_route_id IS 'Shipping route used for cross-island delivery pricing';
