-- Allow offline/payment-link line items that don't map to a product record
-- to still be persisted as real `order_items` rows (with UUIDs).
--
-- This keeps the platform consistent: buyer/seller order detail endpoints can
-- rely on `order_items` being present even for "offline" flows, while still
-- supporting normal marketplace orders that reference real `products`.

ALTER TABLE order_items
  ALTER COLUMN product_id DROP NOT NULL;


