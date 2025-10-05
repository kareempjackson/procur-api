-- Migration: Create Buyer Favorite Sellers Table
-- Description: Table for buyers to save their favorite sellers
-- Date: 2025-10-05

-- ==================== BUYER FAVORITE SELLERS TABLE ====================

CREATE TABLE IF NOT EXISTS buyer_favorite_sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  seller_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_buyer_seller_favorite UNIQUE (buyer_org_id, seller_org_id),
  CONSTRAINT no_self_favorite CHECK (buyer_org_id != seller_org_id)
);

-- Indexes for buyer_favorite_sellers
CREATE INDEX IF NOT EXISTS idx_buyer_favorite_sellers_buyer_org ON buyer_favorite_sellers(buyer_org_id);
CREATE INDEX IF NOT EXISTS idx_buyer_favorite_sellers_seller_org ON buyer_favorite_sellers(seller_org_id);
CREATE INDEX IF NOT EXISTS idx_buyer_favorite_sellers_created_at ON buyer_favorite_sellers(created_at DESC);

-- ==================== RLS POLICIES ====================

-- Enable RLS
ALTER TABLE buyer_favorite_sellers ENABLE ROW LEVEL SECURITY;

-- Buyers can view their own favorites
CREATE POLICY buyer_favorite_sellers_buyer_select ON buyer_favorite_sellers
  FOR SELECT
  USING (
    buyer_org_id IN (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
    )
  );

-- Buyers can add favorites
CREATE POLICY buyer_favorite_sellers_buyer_insert ON buyer_favorite_sellers
  FOR INSERT
  WITH CHECK (
    buyer_org_id IN (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
    )
  );

-- Buyers can remove their own favorites
CREATE POLICY buyer_favorite_sellers_buyer_delete ON buyer_favorite_sellers
  FOR DELETE
  USING (
    buyer_org_id IN (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
    )
  );

-- Sellers can view who favorited them (optional, for analytics)
CREATE POLICY buyer_favorite_sellers_seller_select ON buyer_favorite_sellers
  FOR SELECT
  USING (
    seller_org_id IN (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
    )
  );

-- ==================== COMMENTS ====================

COMMENT ON TABLE buyer_favorite_sellers IS 'Stores buyer favorite/saved sellers for quick access';
COMMENT ON COLUMN buyer_favorite_sellers.buyer_org_id IS 'The buyer organization that saved the seller';
COMMENT ON COLUMN buyer_favorite_sellers.seller_org_id IS 'The seller organization that was saved';

-- ==================== ANALYZE ====================

ANALYZE buyer_favorite_sellers;

