-- Create enums for seller functionality
CREATE TYPE product_status AS ENUM ('draft', 'active', 'inactive', 'out_of_stock', 'discontinued');
CREATE TYPE product_condition AS ENUM ('new', 'used', 'refurbished');
CREATE TYPE measurement_unit AS ENUM ('kg', 'g', 'lb', 'oz', 'piece', 'dozen', 'liter', 'ml', 'gallon');
CREATE TYPE post_status AS ENUM ('draft', 'scheduled', 'published', 'cancelled', 'failed');
CREATE TYPE post_type AS ENUM ('product_promotion', 'sale_announcement', 'general', 'seasonal');
CREATE TYPE order_status AS ENUM ('pending', 'accepted', 'rejected', 'processing', 'shipped', 'delivered', 'cancelled', 'disputed');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded', 'partially_refunded');
CREATE TYPE transaction_type AS ENUM ('sale', 'refund', 'fee', 'payout', 'dispute_hold', 'dispute_release');
CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed', 'cancelled', 'disputed');

-- Note: Seller-specific permissions are added in a previous migration (20250928115900_add_seller_permissions.sql)

-- Products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Basic product info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  short_description VARCHAR(500),
  sku VARCHAR(100),
  barcode VARCHAR(100),
  
  -- Categorization
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  tags TEXT[], -- Array of tags for search
  
  -- Pricing
  base_price DECIMAL(10,2) NOT NULL,
  sale_price DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'USD',
  
  -- Inventory
  stock_quantity INTEGER DEFAULT 0,
  min_stock_level INTEGER DEFAULT 0,
  max_stock_level INTEGER,
  unit_of_measurement measurement_unit NOT NULL,
  weight DECIMAL(8,2), -- in kg
  dimensions JSONB, -- {length, width, height, unit}
  
  -- Product details
  condition product_condition DEFAULT 'new',
  brand VARCHAR(100),
  model VARCHAR(100),
  color VARCHAR(50),
  size VARCHAR(50),
  
  -- Status and visibility
  status product_status DEFAULT 'draft',
  is_featured BOOLEAN DEFAULT false,
  is_organic BOOLEAN DEFAULT false,
  is_local BOOLEAN DEFAULT false,
  
  -- SEO and metadata
  meta_title VARCHAR(255),
  meta_description TEXT,
  slug VARCHAR(255) UNIQUE,
  
  -- Audit fields
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT check_positive_price CHECK (base_price > 0),
  CONSTRAINT check_sale_price CHECK (sale_price IS NULL OR sale_price >= 0),
  CONSTRAINT check_stock_quantity CHECK (stock_quantity >= 0)
);

-- Product images table
CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  alt_text VARCHAR(255),
  display_order INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scheduled posts table
CREATE TABLE scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  
  -- Post content
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  post_type post_type DEFAULT 'general',
  
  -- Media
  images TEXT[], -- Array of image URLs
  video_url TEXT,
  
  -- Scheduling
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  
  -- Targeting
  target_audience JSONB, -- {age_range, location, interests, etc}
  platforms TEXT[], -- ['facebook', 'instagram', 'twitter', etc]
  
  -- Status
  status post_status DEFAULT 'draft',
  failure_reason TEXT,
  
  -- Engagement metrics (populated after publishing)
  views_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  
  -- Audit
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  
  -- Parties
  buyer_org_id UUID NOT NULL REFERENCES organizations(id),
  seller_org_id UUID NOT NULL REFERENCES organizations(id),
  buyer_user_id UUID REFERENCES users(id),
  
  -- Order details
  status order_status DEFAULT 'pending',
  payment_status payment_status DEFAULT 'pending',
  
  -- Amounts
  subtotal DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  shipping_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  
  -- Shipping
  shipping_address JSONB NOT NULL,
  billing_address JSONB,
  estimated_delivery_date DATE,
  actual_delivery_date DATE,
  tracking_number VARCHAR(100),
  shipping_method VARCHAR(100),
  
  -- Notes and communication
  buyer_notes TEXT,
  seller_notes TEXT,
  internal_notes TEXT,
  
  -- Important dates
  accepted_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT check_positive_amounts CHECK (
    subtotal > 0 AND 
    tax_amount >= 0 AND 
    shipping_amount >= 0 AND 
    discount_amount >= 0 AND 
    total_amount > 0
  )
);

-- Order items table
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  
  -- Item details at time of order
  product_name VARCHAR(255) NOT NULL,
  product_sku VARCHAR(100),
  unit_price DECIMAL(10,2) NOT NULL,
  quantity INTEGER NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  
  -- Product snapshot (in case product changes later)
  product_snapshot JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT check_positive_quantity CHECK (quantity > 0),
  CONSTRAINT check_positive_price CHECK (unit_price > 0 AND total_price > 0)
);

-- Transactions table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_number VARCHAR(50) UNIQUE NOT NULL,
  
  -- Related entities
  order_id UUID REFERENCES orders(id),
  seller_org_id UUID NOT NULL REFERENCES organizations(id),
  buyer_org_id UUID REFERENCES organizations(id),
  
  -- Transaction details
  type transaction_type NOT NULL,
  status transaction_status DEFAULT 'pending',
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  
  -- Payment details
  payment_method VARCHAR(50), -- 'credit_card', 'bank_transfer', 'paypal', etc
  payment_reference VARCHAR(100),
  gateway_transaction_id VARCHAR(100),
  
  -- Fees
  platform_fee DECIMAL(10,2) DEFAULT 0,
  payment_processing_fee DECIMAL(10,2) DEFAULT 0,
  net_amount DECIMAL(10,2),
  
  -- Metadata
  description TEXT,
  metadata JSONB,
  
  -- Important dates
  processed_at TIMESTAMP WITH TIME ZONE,
  settled_at TIMESTAMP WITH TIME ZONE,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order timeline table
CREATE TABLE order_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Event details
  event_type VARCHAR(100) NOT NULL, -- 'created', 'accepted', 'shipped', etc
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Actor
  actor_user_id UUID REFERENCES users(id),
  actor_type VARCHAR(50), -- 'buyer', 'seller', 'system', 'admin'
  
  -- Metadata
  metadata JSONB,
  is_visible_to_buyer BOOLEAN DEFAULT true,
  is_visible_to_seller BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert new seller-specific permissions
INSERT INTO system_permissions (name, display_name, description, category) VALUES
-- Product Management
('manage_products', 'Manage Products', 'Create, edit, and manage product catalog', 'inventory'),
('view_products', 'View Products', 'View product catalog and details', 'inventory'),

-- Post Management
('manage_posts', 'Manage Posts', 'Create, schedule, and manage social media posts', 'organization'),
('view_posts', 'View Posts', 'View scheduled and published posts', 'organization'),

-- Order Management
('manage_orders', 'Manage Orders', 'Full order management including status updates', 'procurement'),
('view_orders', 'View Orders', 'View order list and details', 'procurement'),
('accept_orders', 'Accept Orders', 'Accept or reject incoming orders', 'procurement'),

-- Transaction Management
('view_transactions', 'View Transactions', 'View transaction history and details', 'finance'),
('manage_seller_analytics', 'Manage Seller Analytics', 'Access seller analytics and reports', 'reporting');

-- Update default seller role permissions
-- Grant permissions to sales_manager role for seller organizations
INSERT INTO role_system_permissions (role_id, permission_id)
SELECT r.id, sp.id 
FROM organization_roles r
JOIN organizations o ON r.organization_id = o.id
JOIN system_permissions sp ON sp.name IN (
  'manage_products', 'view_products', 'manage_posts', 'view_posts',
  'manage_orders', 'view_orders', 'accept_orders', 'view_transactions',
  'manage_seller_analytics'
)
WHERE o.account_type = 'seller' 
AND r.name = 'sales_manager'
AND sp.is_active = true;

-- Create indexes for performance
-- Product indexes
CREATE INDEX idx_products_seller_org_id ON products(seller_org_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_created_at ON products(created_at);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_name_search ON products USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Product images indexes
CREATE INDEX idx_product_images_product_id ON product_images(product_id);
CREATE INDEX idx_product_images_is_primary ON product_images(is_primary);

-- Scheduled posts indexes
CREATE INDEX idx_scheduled_posts_seller_org_id ON scheduled_posts(seller_org_id);
CREATE INDEX idx_scheduled_posts_status ON scheduled_posts(status);
CREATE INDEX idx_scheduled_posts_scheduled_for ON scheduled_posts(scheduled_for);
CREATE INDEX idx_scheduled_posts_product_id ON scheduled_posts(product_id);

-- Order indexes
CREATE INDEX idx_orders_seller_org_id ON orders(seller_org_id);
CREATE INDEX idx_orders_buyer_org_id ON orders(buyer_org_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_order_number ON orders(order_number);

-- Order items indexes
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- Transaction indexes
CREATE INDEX idx_transactions_seller_org_id ON transactions(seller_org_id);
CREATE INDEX idx_transactions_order_id ON transactions(order_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_transaction_number ON transactions(transaction_number);

-- Order timeline indexes
CREATE INDEX idx_order_timeline_order_id ON order_timeline(order_id);
CREATE INDEX idx_order_timeline_created_at ON order_timeline(created_at);

-- Triggers for updated_at columns
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_posts_updated_at BEFORE UPDATE ON scheduled_posts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate unique order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
    order_num TEXT;
    counter INTEGER := 1;
BEGIN
    LOOP
        order_num := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');
        
        -- Check if this order number already exists
        IF NOT EXISTS (SELECT 1 FROM orders WHERE order_number = order_num) THEN
            RETURN order_num;
        END IF;
        
        counter := counter + 1;
        
        -- Safety check to prevent infinite loop
        IF counter > 9999 THEN
            order_num := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS') || '-' || LPAD((EXTRACT(EPOCH FROM NOW())::INTEGER % 10000)::TEXT, 4, '0');
            RETURN order_num;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to generate unique transaction numbers
CREATE OR REPLACE FUNCTION generate_transaction_number()
RETURNS TEXT AS $$
DECLARE
    txn_num TEXT;
    counter INTEGER := 1;
BEGIN
    LOOP
        txn_num := 'TXN-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 6, '0');
        
        -- Check if this transaction number already exists
        IF NOT EXISTS (SELECT 1 FROM transactions WHERE transaction_number = txn_num) THEN
            RETURN txn_num;
        END IF;
        
        counter := counter + 1;
        
        -- Safety check to prevent infinite loop
        IF counter > 999999 THEN
            txn_num := 'TXN-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS') || '-' || LPAD((EXTRACT(EPOCH FROM NOW())::INTEGER % 100000)::TEXT, 5, '0');
            RETURN txn_num;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically create order timeline entry
CREATE OR REPLACE FUNCTION create_order_timeline_entry()
RETURNS TRIGGER AS $$
BEGIN
    -- Create timeline entry for new orders
    IF TG_OP = 'INSERT' THEN
        INSERT INTO order_timeline (
            order_id, 
            event_type, 
            title, 
            description,
            actor_type
        ) VALUES (
            NEW.id,
            'created',
            'Order Created',
            'Order ' || NEW.order_number || ' has been created',
            'buyer'
        );
        RETURN NEW;
    END IF;
    
    -- Create timeline entry for status changes
    IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        INSERT INTO order_timeline (
            order_id,
            event_type,
            title,
            description,
            actor_type
        ) VALUES (
            NEW.id,
            'status_changed',
            'Order Status Updated',
            'Order status changed from ' || OLD.status || ' to ' || NEW.status,
            CASE 
                WHEN NEW.status IN ('accepted', 'rejected', 'processing', 'shipped') THEN 'seller'
                WHEN NEW.status IN ('delivered', 'cancelled') THEN 'buyer'
                ELSE 'system'
            END
        );
        RETURN NEW;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for order timeline
CREATE TRIGGER order_timeline_trigger
    AFTER INSERT OR UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION create_order_timeline_entry();

-- Function to generate product slug
CREATE OR REPLACE FUNCTION generate_product_slug(product_name TEXT, product_id UUID DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 1;
BEGIN
    -- Create base slug from product name
    base_slug := LOWER(TRIM(REGEXP_REPLACE(product_name, '[^a-zA-Z0-9\s]', '', 'g')));
    base_slug := REGEXP_REPLACE(base_slug, '\s+', '-', 'g');
    base_slug := TRIM(base_slug, '-');
    
    -- Limit length
    IF LENGTH(base_slug) > 50 THEN
        base_slug := LEFT(base_slug, 50);
        base_slug := TRIM(base_slug, '-');
    END IF;
    
    final_slug := base_slug;
    
    -- Check for uniqueness
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM products 
            WHERE slug = final_slug 
            AND (product_id IS NULL OR id != product_id)
        ) THEN
            RETURN final_slug;
        END IF;
        
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
        
        -- Safety check
        IF counter > 1000 THEN
            final_slug := base_slug || '-' || EXTRACT(EPOCH FROM NOW())::INTEGER;
            RETURN final_slug;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
