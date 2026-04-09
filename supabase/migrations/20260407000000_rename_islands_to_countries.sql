-- Migration: Rename islands table to countries
-- Description: Rename the islands table and update all foreign key references
-- Date: 2026-04-07

-- Rename the table
ALTER TABLE islands RENAME TO countries;

-- Rename RLS policy
ALTER POLICY islands_public_read ON countries RENAME TO countries_public_read;

-- Update comments
COMMENT ON TABLE countries IS 'Countries supported by Procur marketplace';
COMMENT ON COLUMN countries.code IS 'Short code used in URL paths (e.g. gda, tnt, svg)';
COMMENT ON COLUMN countries.country_code IS 'ISO 3166-1 alpha-2 country code';
COMMENT ON COLUMN countries.config IS 'Country-specific branding overrides and feature flags';
