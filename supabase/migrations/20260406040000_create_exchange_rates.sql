-- Migration: Create exchange_rates table
-- Description: Currency exchange rates for cross-island trade (admin-managed)
-- Date: 2026-04-06

CREATE TABLE IF NOT EXISTS exchange_rates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency VARCHAR(3) NOT NULL,
  to_currency   VARCHAR(3) NOT NULL,
  rate          NUMERIC(12,6) NOT NULL,
  source        TEXT NOT NULL DEFAULT 'manual',
  effective_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT exchange_rates_unique_pair UNIQUE (from_currency, to_currency),
  CONSTRAINT exchange_rates_positive_rate CHECK (rate > 0),
  CONSTRAINT exchange_rates_different_currencies CHECK (from_currency <> to_currency)
);

-- Seed with Caribbean exchange rates (approximate, admin-adjustable)
INSERT INTO exchange_rates (from_currency, to_currency, rate) VALUES
  ('XCD', 'TTD', 2.51),
  ('TTD', 'XCD', 0.40),
  ('XCD', 'BBD', 0.74),
  ('BBD', 'XCD', 1.35),
  ('XCD', 'JMD', 57.78),
  ('JMD', 'XCD', 0.017),
  ('USD', 'XCD', 2.70),
  ('XCD', 'USD', 0.37)
ON CONFLICT (from_currency, to_currency) DO NOTHING;

-- RLS
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY exchange_rates_public_read ON exchange_rates
  FOR SELECT
  USING (true);

COMMENT ON TABLE exchange_rates IS 'Currency exchange rates for cross-island price display';
COMMENT ON COLUMN exchange_rates.rate IS '1 unit of from_currency = rate units of to_currency';
COMMENT ON COLUMN exchange_rates.source IS 'manual or api (future automated rate fetching)';

ANALYZE exchange_rates;
