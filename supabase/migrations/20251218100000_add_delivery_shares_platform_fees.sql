-- Add explicit buyer/seller delivery share columns to platform_fees_config
-- These allow the admin UI to configure delivery splits without assuming 50/50.

ALTER TABLE platform_fees_config
ADD COLUMN IF NOT EXISTS buyer_delivery_share NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS seller_delivery_share NUMERIC(10,2);

-- Seed existing row with zeros to avoid null surprises in reads.
UPDATE platform_fees_config
SET buyer_delivery_share = COALESCE(buyer_delivery_share, 0),
    seller_delivery_share = COALESCE(seller_delivery_share, 0);













