-- Create a single-row table to store global platform fees configuration
-- This allows updating platform fee % and delivery fee from the admin panel

CREATE TABLE IF NOT EXISTS platform_fees_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_fee_percent NUMERIC(6,3) NOT NULL DEFAULT 5.0, -- e.g. 5% platform fee
  delivery_flat_fee NUMERIC(10,2) NOT NULL DEFAULT 20.0,  -- e.g. 20.00 delivery fee
  currency TEXT NOT NULL DEFAULT 'XCD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure we always have exactly one logical row; seed if empty
INSERT INTO platform_fees_config (platform_fee_percent, delivery_flat_fee, currency)
SELECT 5.0, 20.0, 'XCD'
WHERE NOT EXISTS (SELECT 1 FROM platform_fees_config);

-- Simple trigger to keep updated_at in sync
CREATE OR REPLACE FUNCTION set_platform_fees_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_platform_fees_config_updated_at
ON platform_fees_config;

CREATE TRIGGER trg_platform_fees_config_updated_at
BEFORE UPDATE ON platform_fees_config
FOR EACH ROW
EXECUTE FUNCTION set_platform_fees_config_updated_at();


