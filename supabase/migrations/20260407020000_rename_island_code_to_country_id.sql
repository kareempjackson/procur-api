-- Migration: Rename island_code → country_id across all tables
-- Description: Consolidate naming after islands→countries rename
-- Date: 2026-04-07

-- Organizations
ALTER TABLE organizations RENAME COLUMN island_code TO country_id;

-- Products
ALTER TABLE products RENAME COLUMN island_code TO country_id;

-- Farm profiles
ALTER TABLE farm_profiles RENAME COLUMN island_code TO country_id;

-- Users
ALTER TABLE users RENAME COLUMN default_island_code TO default_country_id;

-- Orders
ALTER TABLE orders RENAME COLUMN origin_island_code TO origin_country_id;
ALTER TABLE orders RENAME COLUMN dest_island_code TO dest_country_id;
ALTER TABLE orders RENAME COLUMN is_cross_island TO is_cross_country;

-- Shipping routes
ALTER TABLE shipping_routes RENAME COLUMN origin_island TO origin_country;
ALTER TABLE shipping_routes RENAME COLUMN dest_island TO dest_country;

-- Product availability (rename table + column)
ALTER TABLE product_island_availability RENAME TO product_country_availability;
ALTER TABLE product_country_availability RENAME COLUMN island_code TO country_id;

-- Trade restrictions
ALTER TABLE trade_restrictions RENAME COLUMN origin_island TO origin_country;
ALTER TABLE trade_restrictions RENAME COLUMN dest_island TO dest_country;

-- Recreate indexes with new names
DROP INDEX IF EXISTS idx_organizations_island;
CREATE INDEX idx_organizations_country_id ON organizations(country_id);

DROP INDEX IF EXISTS idx_products_island_status;
CREATE INDEX idx_products_country_id_status ON products(country_id, status);

DROP INDEX IF EXISTS idx_farm_profiles_island;
CREATE INDEX idx_farm_profiles_country_id ON farm_profiles(country_id);

DROP INDEX IF EXISTS idx_users_default_island;
CREATE INDEX idx_users_default_country_id ON users(default_country_id);

DROP INDEX IF EXISTS idx_shipping_routes_dest;
CREATE INDEX idx_shipping_routes_dest_country ON shipping_routes(dest_country);

DROP INDEX IF EXISTS idx_product_island_avail_island;
CREATE INDEX idx_product_country_avail ON product_country_availability(country_id) WHERE is_active = true;

DROP INDEX IF EXISTS idx_trade_restrictions_dest;
CREATE INDEX idx_trade_restrictions_dest_country ON trade_restrictions(dest_country, product_category) WHERE is_active = true;

DROP INDEX IF EXISTS idx_orders_cross_island;
CREATE INDEX idx_orders_cross_country ON orders(is_cross_country) WHERE is_cross_country = true;

DROP INDEX IF EXISTS idx_orders_origin_island;
CREATE INDEX idx_orders_origin_country ON orders(origin_country_id);

DROP INDEX IF EXISTS idx_orders_dest_island;
CREATE INDEX idx_orders_dest_country ON orders(dest_country_id);
