-- Migration: Create trade_restrictions table
-- Description: Import/export compliance rules between islands by product category
-- Date: 2026-04-06

CREATE TABLE IF NOT EXISTS trade_restrictions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_category TEXT NOT NULL,
  origin_island    VARCHAR(4) REFERENCES islands(code),
  dest_island      VARCHAR(4) NOT NULL REFERENCES islands(code),
  restriction      VARCHAR(20) NOT NULL,
  cert_type        TEXT,
  description      TEXT,
  authority        TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT trade_restrictions_valid_restriction
    CHECK (restriction IN ('blocked', 'requires_cert', 'warning'))
);

CREATE INDEX IF NOT EXISTS idx_trade_restrictions_dest_cat
  ON trade_restrictions(dest_island, product_category) WHERE is_active = true;

-- RLS
ALTER TABLE trade_restrictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY trade_restrictions_public_read ON trade_restrictions
  FOR SELECT
  USING (true);

COMMENT ON TABLE trade_restrictions IS 'Agricultural import/export rules between islands';
COMMENT ON COLUMN trade_restrictions.restriction IS 'blocked | requires_cert | warning';
COMMENT ON COLUMN trade_restrictions.cert_type IS 'Required certificate type (e.g. phytosanitary, import_permit)';
COMMENT ON COLUMN trade_restrictions.authority IS 'Regulatory body (e.g. Trinidad Ministry of Agriculture)';
COMMENT ON COLUMN trade_restrictions.origin_island IS 'NULL means restriction applies from any origin';

ANALYZE trade_restrictions;
