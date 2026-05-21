-- Sellers who offer pickup populate this JSONB with their pickup point.
-- Separate from organizations.address (legal/billing). A non-null value is the signal
-- that the seller offers pickup at all; buyers see "Pickup" as a checkout option only
-- when the seller's pickup_address is set.
--
-- Shape: { street_address, address_line2?, city, state?, postal_code?, country,
--          contact_name?, contact_phone?, instructions?, hours? }
--
-- Safe to run multiple times.

DO $$
BEGIN
  ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS pickup_address JSONB;

  -- Partial index lets us cheaply ask "which sellers offer pickup?".
  CREATE INDEX IF NOT EXISTS idx_organizations_offers_pickup
    ON organizations((pickup_address IS NOT NULL))
    WHERE pickup_address IS NOT NULL;

  COMMENT ON COLUMN organizations.pickup_address IS
    'Optional pickup location for sellers. NULL = does not offer pickup. JSONB shape: { street_address, address_line2?, city, state?, postal_code?, country, contact_name?, contact_phone?, instructions?, hours? }';
END;
$$;
