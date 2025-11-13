-- Migration: Create Product Requests (RFQ) Tables
-- Description: Tables for buyer product requests and seller quotes
-- Date: 2025-10-05

-- ==================== ENUMS ====================

-- Request status enum
DO $$ BEGIN
  CREATE TYPE request_status AS ENUM (
    'draft',
    'active',
    'completed',
    'cancelled',
    'expired'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Ensure 'active' exists on request_status even if the type pre-existed without it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'request_status' AND e.enumlabel = 'active'
  ) THEN
    ALTER TYPE request_status ADD VALUE 'active';
  END IF;
END $$;

-- Ensure 'completed' exists on request_status even if the type pre-existed without it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'request_status' AND e.enumlabel = 'completed'
  ) THEN
    ALTER TYPE request_status ADD VALUE 'completed';
  END IF;
END $$;

-- Ensure 'expired' exists on request_status even if the type pre-existed without it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'request_status' AND e.enumlabel = 'expired'
  ) THEN
    ALTER TYPE request_status ADD VALUE 'expired';
  END IF;
END $$;

-- Quote status enum
DO $$ BEGIN
  CREATE TYPE quote_status AS ENUM (
    'pending',
    'accepted',
    'rejected',
    'withdrawn'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ==================== PRODUCT REQUESTS TABLE ====================

CREATE TABLE IF NOT EXISTS product_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number VARCHAR(50) UNIQUE NOT NULL,
  buyer_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  buyer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Product details
  product_name VARCHAR(255) NOT NULL,
  product_type VARCHAR(100),
  category VARCHAR(100),
  description TEXT,
  
  -- Quantity
  quantity DECIMAL(10, 2) NOT NULL,
  unit_of_measurement measurement_unit NOT NULL,
  
  -- Dates
  date_needed DATE,
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Budget
  budget_min DECIMAL(10, 2),
  budget_max DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'USD',
  
  -- Targeting
  target_seller_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  
  -- Status and counts
  status request_status DEFAULT 'draft',
  response_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_quantity CHECK (quantity > 0),
  CONSTRAINT valid_budget CHECK (
    (budget_min IS NULL AND budget_max IS NULL) OR
    (budget_min IS NOT NULL AND budget_max IS NOT NULL AND budget_min <= budget_max)
  ),
  CONSTRAINT valid_expiration CHECK (expires_at IS NULL OR expires_at > created_at)
);

-- Indexes for product_requests
CREATE INDEX IF NOT EXISTS idx_product_requests_buyer_org ON product_requests(buyer_org_id);
CREATE INDEX IF NOT EXISTS idx_product_requests_buyer_user ON product_requests(buyer_user_id);
CREATE INDEX IF NOT EXISTS idx_product_requests_status ON product_requests(status);
CREATE INDEX IF NOT EXISTS idx_product_requests_created_at ON product_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_requests_target_seller ON product_requests(target_seller_id);
CREATE INDEX IF NOT EXISTS idx_product_requests_request_number ON product_requests(request_number);
CREATE INDEX IF NOT EXISTS idx_product_requests_search ON product_requests USING gin(
  to_tsvector('english', coalesce(product_name, '') || ' ' || coalesce(description, ''))
);

-- ==================== REQUEST QUOTES TABLE ====================

CREATE TABLE IF NOT EXISTS request_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES product_requests(id) ON DELETE CASCADE,
  seller_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  seller_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Pricing
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  
  -- Availability
  available_quantity DECIMAL(10, 2) NOT NULL,
  delivery_date DATE,
  
  -- Additional info
  notes TEXT,
  offered_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  
  -- Status
  status quote_status DEFAULT 'pending',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_unit_price CHECK (unit_price > 0),
  CONSTRAINT valid_total_price CHECK (total_price > 0),
  CONSTRAINT valid_quantity CHECK (available_quantity > 0),
  CONSTRAINT unique_seller_quote UNIQUE (request_id, seller_org_id)
);

-- Indexes for request_quotes
CREATE INDEX IF NOT EXISTS idx_request_quotes_request ON request_quotes(request_id);
CREATE INDEX IF NOT EXISTS idx_request_quotes_seller_org ON request_quotes(seller_org_id);
CREATE INDEX IF NOT EXISTS idx_request_quotes_status ON request_quotes(status);
CREATE INDEX IF NOT EXISTS idx_request_quotes_created_at ON request_quotes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_quotes_offered_product ON request_quotes(offered_product_id);

-- ==================== SEQUENCES ====================

-- Sequence for request numbers
CREATE SEQUENCE IF NOT EXISTS product_request_number_seq START 1000;

-- ==================== FUNCTIONS ====================

-- Function to generate request number
CREATE OR REPLACE FUNCTION generate_request_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  next_num INTEGER;
BEGIN
  next_num := nextval('product_request_number_seq');
  RETURN 'RFQ-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to auto-generate request number on insert
CREATE OR REPLACE FUNCTION set_request_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.request_number IS NULL OR NEW.request_number = '' THEN
    NEW.request_number := generate_request_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update response_count
CREATE OR REPLACE FUNCTION update_request_response_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE product_requests
    SET response_count = response_count + 1
    WHERE id = NEW.request_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE product_requests
    SET response_count = GREATEST(0, response_count - 1)
    WHERE id = OLD.request_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==================== TRIGGERS ====================

-- Trigger to set request number
DROP TRIGGER IF EXISTS trigger_set_request_number ON product_requests;
CREATE TRIGGER trigger_set_request_number
  BEFORE INSERT ON product_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_request_number();

-- Trigger to update response_count
DROP TRIGGER IF EXISTS trigger_update_response_count_insert ON request_quotes;
CREATE TRIGGER trigger_update_response_count_insert
  AFTER INSERT ON request_quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_request_response_count();

DROP TRIGGER IF EXISTS trigger_update_response_count_delete ON request_quotes;
CREATE TRIGGER trigger_update_response_count_delete
  AFTER DELETE ON request_quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_request_response_count();

-- Trigger to update updated_at on product_requests
DROP TRIGGER IF EXISTS trigger_product_requests_updated_at ON product_requests;
CREATE TRIGGER trigger_product_requests_updated_at
  BEFORE UPDATE ON product_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at on request_quotes
DROP TRIGGER IF EXISTS trigger_request_quotes_updated_at ON request_quotes;
CREATE TRIGGER trigger_request_quotes_updated_at
  BEFORE UPDATE ON request_quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==================== RLS POLICIES ====================

-- Enable RLS
ALTER TABLE product_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_quotes ENABLE ROW LEVEL SECURITY;

-- Buyers can view their own requests
CREATE POLICY product_requests_buyer_select ON product_requests
  FOR SELECT
  USING (
    buyer_org_id IN (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
    )
  );

-- Buyers can insert their own requests
CREATE POLICY product_requests_buyer_insert ON product_requests
  FOR INSERT
  WITH CHECK (
    buyer_org_id IN (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
    )
    AND buyer_user_id = auth.uid()
  );

-- Buyers can update their own requests
CREATE POLICY product_requests_buyer_update ON product_requests
  FOR UPDATE
  USING (
    buyer_org_id IN (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
    )
  );

-- Sellers can view active requests (either public or targeted to them)
CREATE POLICY product_requests_seller_select ON product_requests
  FOR SELECT
  USING (
    status::text IN ('active', 'open')
    AND (
      target_seller_id IS NULL
      OR target_seller_id IN (
        SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
      )
    )
  );

-- Buyers can view quotes for their requests
CREATE POLICY request_quotes_buyer_select ON request_quotes
  FOR SELECT
  USING (
    request_id IN (
      SELECT id FROM product_requests
      WHERE buyer_org_id IN (
        SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
      )
    )
  );

-- Sellers can view their own quotes
CREATE POLICY request_quotes_seller_select ON request_quotes
  FOR SELECT
  USING (
    seller_org_id IN (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
    )
  );

-- Sellers can insert quotes
CREATE POLICY request_quotes_seller_insert ON request_quotes
  FOR INSERT
  WITH CHECK (
    seller_org_id IN (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
    )
    AND seller_user_id = auth.uid()
  );

-- Sellers can update their own quotes
CREATE POLICY request_quotes_seller_update ON request_quotes
  FOR UPDATE
  USING (
    seller_org_id IN (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
    )
  );

-- ==================== COMMENTS ====================

COMMENT ON TABLE product_requests IS 'Product requests (RFQ) from buyers';
COMMENT ON TABLE request_quotes IS 'Seller quotes responding to product requests';
COMMENT ON COLUMN product_requests.request_number IS 'Human-readable request number (e.g., RFQ-202510-0001)';
COMMENT ON COLUMN product_requests.response_count IS 'Number of quotes received for this request';
COMMENT ON COLUMN request_quotes.offered_product_id IS 'Alternative product offered by seller (if different from request)';

-- ==================== ANALYZE ====================

ANALYZE product_requests;
ANALYZE request_quotes;

