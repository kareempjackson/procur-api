CREATE TABLE admin_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  unit VARCHAR(50) NOT NULL,
  base_price DECIMAL(10,2) NOT NULL,
  markup_percent DECIMAL(5,2) DEFAULT 0,
  short_description VARCHAR(280),
  long_description TEXT,
  image_urls TEXT[], -- up to 5 URLs, enforced at application layer
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_admin_products_active ON admin_products(is_active);
CREATE INDEX idx_admin_products_category ON admin_products(category);


