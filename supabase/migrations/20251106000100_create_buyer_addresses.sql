-- Create buyer_addresses table if it doesn't exist (idempotent)

CREATE TABLE IF NOT EXISTS buyer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Address details
  label VARCHAR(100),
  street_address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100) NOT NULL,

  -- Contact information
  contact_name VARCHAR(255),
  contact_phone VARCHAR(50),

  -- Address type flags
  is_default BOOLEAN DEFAULT false,
  is_billing BOOLEAN DEFAULT false,
  is_shipping BOOLEAN DEFAULT true,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_buyer_addresses_org ON buyer_addresses(buyer_org_id);
CREATE INDEX IF NOT EXISTS idx_buyer_addresses_default
  ON buyer_addresses(buyer_org_id, is_default) WHERE is_default = true;

-- Keep updated_at current on updates
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_buyer_addresses_updated_at ON buyer_addresses;
CREATE TRIGGER trigger_buyer_addresses_updated_at
BEFORE UPDATE ON buyer_addresses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Ensure only one default address per buyer_org_id
CREATE OR REPLACE FUNCTION ensure_single_default_address() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE buyer_addresses
    SET is_default = false
    WHERE buyer_org_id = NEW.buyer_org_id
      AND id <> NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ensure_single_default_address ON buyer_addresses;
CREATE TRIGGER trigger_ensure_single_default_address
BEFORE INSERT OR UPDATE ON buyer_addresses
FOR EACH ROW
EXECUTE FUNCTION ensure_single_default_address();

-- Optional: enable RLS (service role bypasses RLS). Policies can be added later if needed.
-- ALTER TABLE buyer_addresses ENABLE ROW LEVEL SECURITY;

