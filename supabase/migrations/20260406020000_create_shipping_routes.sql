-- Migration: Create shipping_routes table
-- Description: Seller-managed cross-island shipping rates and availability
-- Date: 2026-04-06

CREATE TABLE IF NOT EXISTS shipping_routes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  origin_island VARCHAR(4) NOT NULL REFERENCES islands(code),
  dest_island   VARCHAR(4) NOT NULL REFERENCES islands(code),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  shipping_fee  NUMERIC(10,2) NOT NULL,
  currency      VARCHAR(3) NOT NULL DEFAULT 'XCD',
  est_days_min  INT NOT NULL DEFAULT 3,
  est_days_max  INT NOT NULL DEFAULT 7,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT shipping_routes_unique_route UNIQUE (seller_org_id, origin_island, dest_island),
  CONSTRAINT shipping_routes_different_islands CHECK (origin_island <> dest_island),
  CONSTRAINT shipping_routes_positive_fee CHECK (shipping_fee >= 0),
  CONSTRAINT shipping_routes_valid_days CHECK (est_days_min > 0 AND est_days_max >= est_days_min)
);

CREATE INDEX IF NOT EXISTS idx_shipping_routes_seller ON shipping_routes(seller_org_id);
CREATE INDEX IF NOT EXISTS idx_shipping_routes_dest ON shipping_routes(dest_island);
CREATE INDEX IF NOT EXISTS idx_shipping_routes_active ON shipping_routes(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE shipping_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY shipping_routes_public_read ON shipping_routes
  FOR SELECT
  USING (true);

COMMENT ON TABLE shipping_routes IS 'Seller-defined shipping routes between islands with rates';
COMMENT ON COLUMN shipping_routes.shipping_fee IS 'Seller-set shipping fee for this route';
COMMENT ON COLUMN shipping_routes.notes IS 'Optional notes like "Ships Tuesdays and Fridays"';

ANALYZE shipping_routes;
