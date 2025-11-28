ALTER TABLE products
  ADD COLUMN IF NOT EXISTS admin_product_id UUID REFERENCES admin_products(id);


