-- Migration: Add Dominican Republic and Anguilla
-- Date: 2026-04-07

INSERT INTO countries (code, name, country_code, currency, timezone, is_active) VALUES
  ('dom', 'Dominican Republic', 'DO', 'DOP', 'America/Santo_Domingo', false),
  ('aia', 'Anguilla',           'AI', 'XCD', 'America/Anguilla',      false)
ON CONFLICT (code) DO NOTHING;
