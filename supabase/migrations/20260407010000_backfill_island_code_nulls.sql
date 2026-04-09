-- Migration: Backfill any NULL island_code values to 'gda'
-- Description: Ensures all existing products, organizations, farm_profiles, and users have island_code set
-- Date: 2026-04-07

UPDATE products SET island_code = 'gda' WHERE island_code IS NULL;
UPDATE organizations SET island_code = 'gda' WHERE island_code IS NULL;
UPDATE farm_profiles SET island_code = 'gda' WHERE island_code IS NULL;
UPDATE users SET default_island_code = 'gda' WHERE default_island_code IS NULL;
