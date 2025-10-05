-- Migration: Add performance indexes for buyer queries
-- Created: 2025-10-05
-- Description: Add indexes to optimize marketplace browsing, search, and filtering

-- ==================== ENABLE EXTENSIONS FIRST ====================

-- Enable pg_trgm for fuzzy text search (MUST be enabled before using gin_trgm_ops)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ==================== PRODUCTS TABLE INDEXES ====================

-- Primary search and filter indexes
CREATE INDEX IF NOT EXISTS idx_products_status_active ON products(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_products_seller_org ON products(seller_org_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock_quantity) WHERE status = 'active';

-- Price range filtering
CREATE INDEX IF NOT EXISTS idx_products_base_price ON products(base_price) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_products_sale_price ON products(sale_price) WHERE status = 'active' AND sale_price IS NOT NULL;

-- Boolean filters (organic, local, featured)
CREATE INDEX IF NOT EXISTS idx_products_is_organic ON products(is_organic) WHERE status = 'active' AND is_organic = true;
CREATE INDEX IF NOT EXISTS idx_products_is_local ON products(is_local) WHERE status = 'active' AND is_local = true;
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON products(is_featured) WHERE status = 'active' AND is_featured = true;

-- Full-text search on name and description
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_description_trgm ON products USING gin(description gin_trgm_ops);

-- Tags array search (GIN index for array operations)
CREATE INDEX IF NOT EXISTS idx_products_tags ON products USING gin(tags);

-- Sorting indexes
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_products_updated_at ON products(updated_at DESC) WHERE status = 'active';

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_products_category_price ON products(category, base_price DESC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_products_seller_category ON products(seller_org_id, category) WHERE status = 'active';

-- ==================== ORGANIZATIONS TABLE INDEXES ====================

-- Seller/supplier queries
CREATE INDEX IF NOT EXISTS idx_organizations_account_type ON organizations(account_type);
CREATE INDEX IF NOT EXISTS idx_organizations_country ON organizations(country);
CREATE INDEX IF NOT EXISTS idx_organizations_name_trgm ON organizations USING gin(name gin_trgm_ops);

-- ==================== BUYER_FAVORITE_PRODUCTS TABLE INDEXES ====================

-- User favorites lookup (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'buyer_favorite_products') THEN
    CREATE INDEX IF NOT EXISTS idx_buyer_favorite_products_buyer_org ON buyer_favorite_products(buyer_org_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_buyer_favorite_products_product ON buyer_favorite_products(product_id);
  END IF;
END $$;

-- ==================== BUYER_FAVORITE_SELLERS TABLE INDEXES ====================

-- User favorite sellers lookup (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'buyer_favorite_sellers') THEN
    CREATE INDEX IF NOT EXISTS idx_buyer_favorite_sellers_buyer_org ON buyer_favorite_sellers(buyer_org_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_buyer_favorite_sellers_seller_org ON buyer_favorite_sellers(seller_org_id);
  END IF;
END $$;

-- ==================== CART_ITEMS TABLE INDEXES ====================

-- Cart queries (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cart_items') THEN
    CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id, added_at DESC);
    CREATE INDEX IF NOT EXISTS idx_cart_items_product ON cart_items(product_id);
  END IF;
END $$;

-- ==================== SHOPPING_CARTS TABLE INDEXES ====================

-- Shopping cart queries (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'shopping_carts') THEN
    CREATE INDEX IF NOT EXISTS idx_shopping_carts_buyer_org ON shopping_carts(buyer_org_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_shopping_carts_buyer_user ON shopping_carts(buyer_user_id);
  END IF;
END $$;

-- ==================== ORDERS TABLE INDEXES ====================

-- Order history and tracking
CREATE INDEX IF NOT EXISTS idx_orders_buyer_org ON orders(buyer_org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_seller_org ON orders(seller_org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_status ON orders(buyer_org_id, status, created_at DESC);

-- ==================== HARVEST_REQUESTS TABLE INDEXES ====================

-- Harvest updates feed
CREATE INDEX IF NOT EXISTS idx_harvest_requests_visibility ON harvest_requests(visibility, created_at DESC) WHERE visibility = 'public';
CREATE INDEX IF NOT EXISTS idx_harvest_requests_seller ON harvest_requests(seller_org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_harvest_requests_crop ON harvest_requests(crop) WHERE visibility = 'public';

-- ==================== HARVEST_LIKES TABLE INDEXES ====================

-- Like status lookup (column is harvest_id, not harvest_request_id)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'harvest_likes') THEN
    CREATE INDEX IF NOT EXISTS idx_harvest_likes_composite ON harvest_likes(harvest_id, buyer_org_id);
    CREATE INDEX IF NOT EXISTS idx_harvest_likes_buyer ON harvest_likes(buyer_org_id, created_at DESC);
  END IF;
END $$;

-- ==================== HARVEST_COMMENTS TABLE INDEXES ====================

-- Comments feed (column is harvest_id, not harvest_request_id; and buyer_user_id, not user_id)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'harvest_comments') THEN
    CREATE INDEX IF NOT EXISTS idx_harvest_comments_harvest ON harvest_comments(harvest_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_harvest_comments_user ON harvest_comments(buyer_user_id, created_at DESC);
  END IF;
END $$;

-- ==================== PRODUCT_IMAGES TABLE INDEXES ====================

-- Image lookup
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id, display_order ASC);
CREATE INDEX IF NOT EXISTS idx_product_images_primary ON product_images(product_id) WHERE is_primary = true;

-- ==================== ANALYZE TABLES ====================

-- Update table statistics for query planner (only for existing tables)
DO $$
BEGIN
  -- Always present tables
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'products') THEN
    EXECUTE 'ANALYZE products';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'organizations') THEN
    EXECUTE 'ANALYZE organizations';
  END IF;
  
  -- Buyer tables (may not exist)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'buyer_favorite_products') THEN
    EXECUTE 'ANALYZE buyer_favorite_products';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'buyer_favorite_sellers') THEN
    EXECUTE 'ANALYZE buyer_favorite_sellers';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cart_items') THEN
    EXECUTE 'ANALYZE cart_items';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'shopping_carts') THEN
    EXECUTE 'ANALYZE shopping_carts';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'orders') THEN
    EXECUTE 'ANALYZE orders';
  END IF;
  
  -- Harvest tables
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'harvest_requests') THEN
    EXECUTE 'ANALYZE harvest_requests';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'harvest_likes') THEN
    EXECUTE 'ANALYZE harvest_likes';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'harvest_comments') THEN
    EXECUTE 'ANALYZE harvest_comments';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'product_images') THEN
    EXECUTE 'ANALYZE product_images';
  END IF;
END $$;

-- ==================== COMMENTS ====================

-- Add comments only if indexes exist
DO $$
BEGIN
  -- Product indexes (always present)
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_products_status_active') THEN
    COMMENT ON INDEX idx_products_status_active IS 'Fast lookup of active products';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_products_category') THEN
    COMMENT ON INDEX idx_products_category IS 'Category filtering for marketplace';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_products_seller_org') THEN
    COMMENT ON INDEX idx_products_seller_org IS 'Products by seller';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_products_tags') THEN
    COMMENT ON INDEX idx_products_tags IS 'Tag-based filtering (e.g., certifications)';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_products_name_trgm') THEN
    COMMENT ON INDEX idx_products_name_trgm IS 'Fuzzy text search on product names';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_products_category_price') THEN
    COMMENT ON INDEX idx_products_category_price IS 'Category browsing sorted by price';
  END IF;
  
  -- Buyer indexes (may not exist)
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_buyer_favorite_products_buyer_org') THEN
    COMMENT ON INDEX idx_buyer_favorite_products_buyer_org IS 'Buyer favorite products lookup';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_cart_items_cart') THEN
    COMMENT ON INDEX idx_cart_items_cart IS 'Cart items for a specific cart';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_shopping_carts_buyer_org') THEN
    COMMENT ON INDEX idx_shopping_carts_buyer_org IS 'Shopping carts for a buyer';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_orders_buyer_status') THEN
    COMMENT ON INDEX idx_orders_buyer_status IS 'Order history with status filter';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_harvest_requests_visibility') THEN
    COMMENT ON INDEX idx_harvest_requests_visibility IS 'Public harvest updates feed';
  END IF;
END $$;

