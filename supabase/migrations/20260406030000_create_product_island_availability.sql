-- Migration: Create product_island_availability table
-- Description: Tracks which islands a product is listed on beyond its home island
-- Date: 2026-04-06

CREATE TABLE IF NOT EXISTS product_island_availability (
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  island_code VARCHAR(4) NOT NULL REFERENCES islands(code),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (product_id, island_code)
);

CREATE INDEX IF NOT EXISTS idx_product_island_avail_island ON product_island_availability(island_code) WHERE is_active = true;

-- RLS
ALTER TABLE product_island_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_island_availability_public_read ON product_island_availability
  FOR SELECT
  USING (true);

COMMENT ON TABLE product_island_availability IS 'Cross-island product listings beyond home island';

ANALYZE product_island_availability;
