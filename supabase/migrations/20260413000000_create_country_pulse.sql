-- Migration: Country Pulse
-- Description: Per-country demand/supply signals (auto-computed snapshots + admin overrides)
-- Date: 2026-04-13

-- ==================== ENUM ====================

DO $$ BEGIN
  CREATE TYPE country_pulse_signal AS ENUM (
    'in_demand',
    'scarce',
    'trending',
    'surplus'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ==================== SNAPSHOTS TABLE ====================
-- Auto-computed by the aggregator. Truncated and rewritten per country per recompute.

CREATE TABLE IF NOT EXISTS country_pulse_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id    VARCHAR(4) NOT NULL REFERENCES countries(code) ON DELETE CASCADE,
  signal_type   country_pulse_signal NOT NULL,
  product_id    UUID REFERENCES products(id) ON DELETE SET NULL,
  category      TEXT,
  label         TEXT NOT NULL,
  rank          INTEGER NOT NULL,
  score         NUMERIC(12, 4) NOT NULL DEFAULT 0,
  metrics       JSONB NOT NULL DEFAULT '{}',
  computed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT country_pulse_snapshot_unique UNIQUE (country_id, signal_type, rank)
);

CREATE INDEX IF NOT EXISTS idx_country_pulse_snapshots_country_signal
  ON country_pulse_snapshots(country_id, signal_type, rank);
CREATE INDEX IF NOT EXISTS idx_country_pulse_snapshots_product
  ON country_pulse_snapshots(product_id);

-- ==================== OVERRIDES TABLE ====================
-- Admin-authored. Merges on top of snapshots (pinned = always shown, hidden = suppresses a snapshot entry).

CREATE TABLE IF NOT EXISTS country_pulse_overrides (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id    VARCHAR(4) NOT NULL REFERENCES countries(code) ON DELETE CASCADE,
  signal_type   country_pulse_signal NOT NULL,
  product_id    UUID REFERENCES products(id) ON DELETE SET NULL,
  category      TEXT,
  label         TEXT NOT NULL,
  note          TEXT,
  rank          INTEGER NOT NULL DEFAULT 0,
  is_pinned     BOOLEAN NOT NULL DEFAULT false,
  is_hidden     BOOLEAN NOT NULL DEFAULT false,
  valid_from    TIMESTAMPTZ,
  valid_until   TIMESTAMPTZ,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT country_pulse_override_validity CHECK (
    valid_until IS NULL OR valid_from IS NULL OR valid_until > valid_from
  )
);

CREATE INDEX IF NOT EXISTS idx_country_pulse_overrides_country_signal
  ON country_pulse_overrides(country_id, signal_type);
CREATE INDEX IF NOT EXISTS idx_country_pulse_overrides_product
  ON country_pulse_overrides(product_id);

DROP TRIGGER IF EXISTS trigger_country_pulse_overrides_updated_at ON country_pulse_overrides;
CREATE TRIGGER trigger_country_pulse_overrides_updated_at
  BEFORE UPDATE ON country_pulse_overrides
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==================== RLS ====================

ALTER TABLE country_pulse_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE country_pulse_overrides ENABLE ROW LEVEL SECURITY;

-- Public read — pulse is a marketing surface visible to unauthenticated users
CREATE POLICY country_pulse_snapshots_public_read ON country_pulse_snapshots
  FOR SELECT USING (true);

CREATE POLICY country_pulse_overrides_public_read ON country_pulse_overrides
  FOR SELECT USING (true);

-- Comments
COMMENT ON TABLE country_pulse_snapshots IS 'Auto-computed per-country supply/demand signals rendered on the marketplace landing page';
COMMENT ON TABLE country_pulse_overrides IS 'Admin-authored overrides merged on top of country_pulse_snapshots';
COMMENT ON COLUMN country_pulse_overrides.is_pinned IS 'When true, always appears in the rail regardless of snapshot';
COMMENT ON COLUMN country_pulse_overrides.is_hidden IS 'When true, suppresses matching snapshot entries';

ANALYZE country_pulse_snapshots;
ANALYZE country_pulse_overrides;
