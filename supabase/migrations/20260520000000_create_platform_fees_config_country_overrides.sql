-- Per-country overrides for platform_fees_config.
-- Any column left NULL on a country row falls back to the global default
-- row in platform_fees_config. This is additive: existing global behavior
-- is unchanged when no override row exists.

CREATE TABLE IF NOT EXISTS platform_fees_config_country_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- country_id matches the convention used elsewhere in the schema:
  -- references the country code (e.g. 'gda', 'tnt'), not a UUID.
  country_id VARCHAR(4) NOT NULL REFERENCES countries(code) ON DELETE CASCADE,
  platform_fee_percent NUMERIC(6,3) NULL,
  delivery_flat_fee NUMERIC(10,2) NULL,
  buyer_delivery_share NUMERIC(10,2) NULL,
  seller_delivery_share NUMERIC(10,2) NULL,
  min_order_per_seller NUMERIC(10,2) NULL,
  min_order_total NUMERIC(10,2) NULL,
  currency TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country_id)
);

CREATE INDEX IF NOT EXISTS idx_platform_fees_overrides_country
  ON platform_fees_config_country_overrides (country_id);

-- Reuse the updated_at trigger function defined in
-- 20251211120000_create_platform_fees_config.sql
DROP TRIGGER IF EXISTS trg_platform_fees_overrides_updated_at
  ON platform_fees_config_country_overrides;

CREATE TRIGGER trg_platform_fees_overrides_updated_at
BEFORE UPDATE ON platform_fees_config_country_overrides
FOR EACH ROW
EXECUTE FUNCTION set_platform_fees_config_updated_at();
