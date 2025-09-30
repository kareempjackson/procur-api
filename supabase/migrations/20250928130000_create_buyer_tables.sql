-- Create buyer-specific tables and enums

-- Create enums for buyer functionality
CREATE TYPE request_status AS ENUM ('draft', 'open', 'closed', 'cancelled');
CREATE TYPE quote_status AS ENUM ('pending', 'accepted', 'rejected', 'expired');

-- Shopping cart table
CREATE TABLE shopping_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  buyer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cart items table
CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES shopping_carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT check_positive_quantity CHECK (quantity > 0),
  UNIQUE(cart_id, product_id) -- Prevent duplicate products in same cart
);

-- Product requests (RFQ) table
CREATE TABLE product_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number VARCHAR(50) UNIQUE NOT NULL,
  buyer_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  buyer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Request details
  product_name VARCHAR(255) NOT NULL,
  product_type VARCHAR(100),
  category VARCHAR(100),
  description TEXT,
  quantity INTEGER NOT NULL,
  unit_of_measurement measurement_unit NOT NULL,
  date_needed DATE,
  budget_range JSONB, -- {min, max, currency}
  
  -- Targeting
  target_seller_id UUID REFERENCES organizations(id), -- specific seller or null for open market
  
  -- Status and metadata
  status request_status DEFAULT 'draft',
  expires_at TIMESTAMP WITH TIME ZONE,
  response_count INTEGER DEFAULT 0,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT check_positive_quantity CHECK (quantity > 0)
);

-- Seller responses to product requests
CREATE TABLE request_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES product_requests(id) ON DELETE CASCADE,
  seller_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  seller_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Quote details
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  available_quantity INTEGER NOT NULL,
  delivery_date DATE,
  notes TEXT,
  
  -- Product details (if offering alternative)
  offered_product_id UUID REFERENCES products(id),
  
  -- Status
  status quote_status DEFAULT 'pending',
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT check_positive_prices CHECK (unit_price > 0 AND total_price > 0),
  CONSTRAINT check_positive_quantity CHECK (available_quantity > 0),
  UNIQUE(request_id, seller_org_id) -- One quote per seller per request
);

-- Buyer addresses table
CREATE TABLE buyer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Address details
  label VARCHAR(100), -- 'Home', 'Office', 'Warehouse', etc.
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Buyer favorite products
CREATE TABLE buyer_favorite_products (
  buyer_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (buyer_org_id, product_id)
);

-- Buyer favorite sellers
CREATE TABLE buyer_favorite_sellers (
  buyer_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  seller_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (buyer_org_id, seller_org_id)
);

-- Buyer preferences table
CREATE TABLE buyer_preferences (
  buyer_org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Notification preferences
  email_notifications BOOLEAN DEFAULT true,
  sms_notifications BOOLEAN DEFAULT false,
  order_updates BOOLEAN DEFAULT true,
  price_alerts BOOLEAN DEFAULT false,
  new_product_alerts BOOLEAN DEFAULT false,
  
  -- Shopping preferences
  preferred_currency VARCHAR(3) DEFAULT 'USD',
  auto_reorder BOOLEAN DEFAULT false,
  preferred_delivery_window JSONB, -- {start_time, end_time, days}
  
  -- Privacy settings
  public_reviews BOOLEAN DEFAULT true,
  share_purchase_history BOOLEAN DEFAULT false,
  
  -- Metadata
  preferences_data JSONB, -- For additional custom preferences
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order reviews table (buyer reviews of completed orders)
CREATE TABLE order_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  buyer_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  buyer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Review details
  overall_rating INTEGER NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
  product_quality_rating INTEGER CHECK (product_quality_rating >= 1 AND product_quality_rating <= 5),
  delivery_rating INTEGER CHECK (delivery_rating >= 1 AND delivery_rating <= 5),
  service_rating INTEGER CHECK (service_rating >= 1 AND service_rating <= 5),
  
  -- Review content
  title VARCHAR(255),
  comment TEXT,
  
  -- Flags
  is_verified_purchase BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT true,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(order_id, buyer_org_id) -- One review per order per buyer
);

-- Create indexes for better performance
CREATE INDEX idx_shopping_carts_buyer ON shopping_carts(buyer_org_id, buyer_user_id);
CREATE INDEX idx_cart_items_cart ON cart_items(cart_id);
CREATE INDEX idx_cart_items_product ON cart_items(product_id);

CREATE INDEX idx_product_requests_buyer ON product_requests(buyer_org_id, buyer_user_id);
CREATE INDEX idx_product_requests_status ON product_requests(status);
CREATE INDEX idx_product_requests_category ON product_requests(category);
CREATE INDEX idx_product_requests_date_needed ON product_requests(date_needed);

CREATE INDEX idx_request_quotes_request ON request_quotes(request_id);
CREATE INDEX idx_request_quotes_seller ON request_quotes(seller_org_id);
CREATE INDEX idx_request_quotes_status ON request_quotes(status);

CREATE INDEX idx_buyer_addresses_org ON buyer_addresses(buyer_org_id);
CREATE INDEX idx_buyer_addresses_default ON buyer_addresses(buyer_org_id, is_default) WHERE is_default = true;

CREATE INDEX idx_favorite_products_buyer ON buyer_favorite_products(buyer_org_id);
CREATE INDEX idx_favorite_sellers_buyer ON buyer_favorite_sellers(buyer_org_id);

CREATE INDEX idx_order_reviews_order ON order_reviews(order_id);
CREATE INDEX idx_order_reviews_seller ON order_reviews(seller_org_id);
CREATE INDEX idx_order_reviews_public ON order_reviews(seller_org_id, is_public) WHERE is_public = true;

-- Create functions for automatic cart management
CREATE OR REPLACE FUNCTION get_or_create_cart(p_buyer_org_id UUID, p_buyer_user_id UUID)
RETURNS UUID AS $$
DECLARE
    cart_id UUID;
BEGIN
    -- Try to find existing cart
    SELECT id INTO cart_id
    FROM shopping_carts
    WHERE buyer_org_id = p_buyer_org_id AND buyer_user_id = p_buyer_user_id;
    
    -- Create cart if it doesn't exist
    IF cart_id IS NULL THEN
        INSERT INTO shopping_carts (buyer_org_id, buyer_user_id)
        VALUES (p_buyer_org_id, p_buyer_user_id)
        RETURNING id INTO cart_id;
    END IF;
    
    RETURN cart_id;
END;
$$ LANGUAGE plpgsql;

-- Function to generate request numbers
CREATE OR REPLACE FUNCTION generate_request_number()
RETURNS VARCHAR(50) AS $$
DECLARE
    new_number VARCHAR(50);
    counter INTEGER;
BEGIN
    -- Get current date in YYYYMMDD format
    SELECT 'REQ-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
           LPAD((COALESCE(MAX(CAST(SUBSTRING(request_number FROM 13) AS INTEGER)), 0) + 1)::TEXT, 4, '0')
    INTO new_number
    FROM product_requests
    WHERE request_number LIKE 'REQ-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-%';
    
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate request numbers
CREATE OR REPLACE FUNCTION set_request_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.request_number IS NULL OR NEW.request_number = '' THEN
        NEW.request_number := generate_request_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_request_number
    BEFORE INSERT ON product_requests
    FOR EACH ROW
    EXECUTE FUNCTION set_request_number();

-- Trigger to update response count on quotes
CREATE OR REPLACE FUNCTION update_request_response_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE product_requests 
        SET response_count = response_count + 1,
            updated_at = NOW()
        WHERE id = NEW.request_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE product_requests 
        SET response_count = response_count - 1,
            updated_at = NOW()
        WHERE id = OLD.request_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_request_response_count
    AFTER INSERT OR DELETE ON request_quotes
    FOR EACH ROW
    EXECUTE FUNCTION update_request_response_count();

-- Trigger to ensure only one default address per buyer
CREATE OR REPLACE FUNCTION ensure_single_default_address()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = true THEN
        UPDATE buyer_addresses 
        SET is_default = false 
        WHERE buyer_org_id = NEW.buyer_org_id 
        AND id != NEW.id 
        AND is_default = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_default_address
    BEFORE INSERT OR UPDATE ON buyer_addresses
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_default_address();

-- Add updated_at triggers for tables that need them
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_shopping_carts_updated_at
    BEFORE UPDATE ON shopping_carts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_product_requests_updated_at
    BEFORE UPDATE ON product_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_request_quotes_updated_at
    BEFORE UPDATE ON request_quotes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_buyer_addresses_updated_at
    BEFORE UPDATE ON buyer_addresses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_buyer_preferences_updated_at
    BEFORE UPDATE ON buyer_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_order_reviews_updated_at
    BEFORE UPDATE ON order_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
