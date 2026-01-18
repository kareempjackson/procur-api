-- Link harvest updates to existing seller uploaded products
-- Adds an optional product_id foreign key so each harvest update can reference a product.

ALTER TABLE harvest_requests
  ADD COLUMN IF NOT EXISTS product_id UUID;

DO $$
BEGIN
  -- Add FK only if it doesn't already exist
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'harvest_requests_product_id_fkey'
  ) THEN
    ALTER TABLE harvest_requests
      ADD CONSTRAINT harvest_requests_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES products(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_harvest_requests_product_id
  ON harvest_requests(product_id);


