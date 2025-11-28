ALTER TABLE admin_products
  ADD COLUMN IF NOT EXISTS min_seller_price DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS max_seller_price DECIMAL(10,2);

ALTER TABLE admin_products
  ADD CONSTRAINT admin_products_min_max_seller_price_chk
  CHECK (
    min_seller_price IS NULL
    OR max_seller_price IS NULL
    OR min_seller_price <= max_seller_price
  );


