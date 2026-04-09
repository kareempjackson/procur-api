-- Migration: Add island_code to organizations, products, farm_profiles, users
-- Description: Links existing entities to islands for multi-island support
-- Date: 2026-04-06

-- Organizations: primary island tenant field
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS island_code VARCHAR(4) REFERENCES islands(code);

-- Products: denormalized from seller org for fast marketplace queries
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS island_code VARCHAR(4) REFERENCES islands(code);

-- Farm profiles: replace reliance on country field
ALTER TABLE farm_profiles
  ADD COLUMN IF NOT EXISTS island_code VARCHAR(4) REFERENCES islands(code);

-- Users: preferred island (for mobile app / geo-redirect)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS default_island_code VARCHAR(4) REFERENCES islands(code);

-- Backfill all existing data to Grenada
UPDATE organizations SET island_code = 'gda' WHERE island_code IS NULL;
UPDATE products SET island_code = 'gda' WHERE island_code IS NULL;
UPDATE farm_profiles SET island_code = 'gda' WHERE island_code IS NULL;
UPDATE users SET default_island_code = 'gda' WHERE default_island_code IS NULL;

-- Indexes for marketplace filtering
CREATE INDEX IF NOT EXISTS idx_organizations_island ON organizations(island_code);
CREATE INDEX IF NOT EXISTS idx_products_island_status ON products(island_code, status);
CREATE INDEX IF NOT EXISTS idx_farm_profiles_island ON farm_profiles(island_code);
CREATE INDEX IF NOT EXISTS idx_users_default_island ON users(default_island_code);

-- Comments
COMMENT ON COLUMN organizations.island_code IS 'Home island for this organization';
COMMENT ON COLUMN products.island_code IS 'Denormalized from seller org for fast marketplace queries';
COMMENT ON COLUMN farm_profiles.island_code IS 'Island where this farm is located';
COMMENT ON COLUMN users.default_island_code IS 'User preferred island for marketplace browsing';
