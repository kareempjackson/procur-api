-- Add business type enums for buyers and sellers
-- This migration adds specific business types while keeping the main account_type for authorization

-- Create buyer business type enum
CREATE TYPE buyer_business_type AS ENUM (
  'general',
  'hotels',
  'restaurants',
  'supermarkets',
  'exporters'
);

-- Create seller business type enum  
CREATE TYPE seller_business_type AS ENUM (
  'general',
  'farmers',
  'manufacturers',
  'fishermen'
);

-- Create a function to validate business type based on account type
CREATE OR REPLACE FUNCTION validate_business_type()
RETURNS TRIGGER AS $$
BEGIN
  -- Only validate if business_type is provided
  IF NEW.business_type IS NOT NULL THEN
    -- For buyer organizations, validate against buyer business types
    IF NEW.account_type = 'buyer' THEN
      IF NEW.business_type NOT IN ('general', 'hotels', 'restaurants', 'supermarkets', 'exporters') THEN
        RAISE EXCEPTION 'Invalid business_type "%" for buyer account. Valid types: general, hotels, restaurants, supermarkets, exporters', NEW.business_type;
      END IF;
    -- For seller organizations, validate against seller business types  
    ELSIF NEW.account_type = 'seller' THEN
      IF NEW.business_type NOT IN ('general', 'farmers', 'manufacturers', 'fishermen') THEN
        RAISE EXCEPTION 'Invalid business_type "%" for seller account. Valid types: general, farmers, manufacturers, fishermen', NEW.business_type;
      END IF;
    -- For other account types, business_type should be null or general
    ELSIF NEW.account_type IN ('government', 'driver', 'qa') THEN
      IF NEW.business_type IS NOT NULL AND NEW.business_type != 'general' THEN
        RAISE EXCEPTION 'business_type should be null or "general" for account_type "%"', NEW.account_type;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to validate business type on organizations table
CREATE TRIGGER validate_organization_business_type
  BEFORE INSERT OR UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION validate_business_type();

-- Update existing organizations to have 'general' business type if null
UPDATE organizations 
SET business_type = 'general' 
WHERE business_type IS NULL AND account_type IN ('buyer', 'seller');

-- Add index for better performance on business type queries
CREATE INDEX idx_organizations_account_business_type ON organizations(account_type, business_type);

-- Add comments for documentation
COMMENT ON TYPE buyer_business_type IS 'Business types available for buyer organizations';
COMMENT ON TYPE seller_business_type IS 'Business types available for seller organizations';
COMMENT ON FUNCTION validate_business_type() IS 'Validates that business_type matches the account_type constraints';
