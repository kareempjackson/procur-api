-- Migration: Create islands reference table
-- Description: Canonical registry of Caribbean islands supported by Procur
-- Date: 2026-04-06

CREATE TABLE IF NOT EXISTS islands (
  code         VARCHAR(4) PRIMARY KEY,
  name         TEXT NOT NULL,
  country_code VARCHAR(2) NOT NULL,
  currency     VARCHAR(3) NOT NULL DEFAULT 'XCD',
  timezone     TEXT NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT false,
  config       JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed Caribbean islands
INSERT INTO islands (code, name, country_code, currency, timezone, is_active) VALUES
  ('gda', 'Grenada',                      'GD', 'XCD', 'America/Grenada',         true),
  ('tnt', 'Trinidad & Tobago',            'TT', 'TTD', 'America/Port_of_Spain',   false),
  ('svg', 'St. Vincent & the Grenadines', 'VC', 'XCD', 'America/St_Vincent',      false),
  ('dma', 'Dominica',                     'DM', 'XCD', 'America/Dominica',        false),
  ('lca', 'St. Lucia',                    'LC', 'XCD', 'America/St_Lucia',        false),
  ('brb', 'Barbados',                     'BB', 'BBD', 'America/Barbados',        false),
  ('atg', 'Antigua & Barbuda',            'AG', 'XCD', 'America/Antigua',         false),
  ('jam', 'Jamaica',                      'JM', 'JMD', 'America/Jamaica',         false),
  ('kna', 'St. Kitts & Nevis',            'KN', 'XCD', 'America/St_Kitts',       false)
ON CONFLICT (code) DO NOTHING;

-- RLS
ALTER TABLE islands ENABLE ROW LEVEL SECURITY;

-- Public read access (islands list is public)
CREATE POLICY islands_public_read ON islands
  FOR SELECT
  USING (true);

-- Comments
COMMENT ON TABLE islands IS 'Caribbean islands supported by Procur marketplace';
COMMENT ON COLUMN islands.code IS 'Short code used in URL paths (e.g. gda, tnt, svg)';
COMMENT ON COLUMN islands.country_code IS 'ISO 3166-1 alpha-2 country code';
COMMENT ON COLUMN islands.config IS 'Island-specific branding overrides and feature flags';

ANALYZE islands;
