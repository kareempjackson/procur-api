-- Migration: Backfill any remaining NULL country_id values to 'gda'
-- Description: Products/orgs created between migrations may have NULL country_id
-- Date: 2026-04-08

UPDATE products SET country_id = 'gda' WHERE country_id IS NULL;
UPDATE organizations SET country_id = 'gda' WHERE country_id IS NULL;
UPDATE farm_profiles SET country_id = 'gda' WHERE country_id IS NULL;
UPDATE users SET default_country_id = 'gda' WHERE default_country_id IS NULL;

-- Prevent future NULLs by setting defaults
ALTER TABLE products ALTER COLUMN country_id SET DEFAULT 'gda';
ALTER TABLE organizations ALTER COLUMN country_id SET DEFAULT 'gda';
