-- Add address column to farm_profiles for seller's physical address.
-- This field is only visible to the seller and administrators (not public marketplace).

ALTER TABLE farm_profiles ADD COLUMN IF NOT EXISTS address TEXT;

COMMENT ON COLUMN farm_profiles.address IS 'Seller physical address. Visible only to seller and admins, not shown on public marketplace pages.';
