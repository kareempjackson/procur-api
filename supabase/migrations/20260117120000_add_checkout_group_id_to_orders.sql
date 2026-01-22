-- Add a persistent checkout group identifier to link split seller orders from a single checkout.
-- This enables rendering a full multi-supplier order confirmation receipt.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS checkout_group_id UUID;

CREATE INDEX IF NOT EXISTS idx_orders_checkout_group_id
  ON orders(checkout_group_id);






