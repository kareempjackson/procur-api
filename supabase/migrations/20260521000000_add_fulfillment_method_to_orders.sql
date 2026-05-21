-- Adds a buyer-facing fulfillment mode to orders. Pickup orders skip shipping-address
-- requirements, skip cross-country route validation, and (enforced in app code) only allow
-- credit_card payment so the seller doesn't bear collection risk at handoff.
--
-- Pickup is restricted to single-seller carts (enforced in BuyersService.createOrder).
--
-- Safe to run multiple times.

DO $$
BEGIN
  ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS fulfillment_method TEXT NOT NULL DEFAULT 'delivery';

  -- Drop and recreate the CHECK so re-runs after value-set changes stay clean.
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_fulfillment_method_check;
  ALTER TABLE orders
    ADD CONSTRAINT orders_fulfillment_method_check
    CHECK (fulfillment_method IN ('delivery', 'pickup'));

  CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_method_pickup
    ON orders(fulfillment_method)
    WHERE fulfillment_method = 'pickup';

  COMMENT ON COLUMN orders.fulfillment_method IS
    'How the order is fulfilled. delivery = ship/courier to shipping_address (default). pickup = buyer collects from seller organizations.pickup_address; shipping_amount must be 0 and payment_method must be credit_card.';
END;
$$;
