-- Adds a third fulfillment mode: `seller_delivery` (seller personally drops off
-- the order to a buyer within a declared zone). Mirrors the pattern used by
-- 20260521000000 to introduce `pickup`.
--
-- Per-seller toggle + declared zone live on the organizations row so existing
-- seller-settings UI patterns can be reused (cf. organizations.pickup_address
-- from 20260521000100). The zone is stored as JSONB { localities: string[] }
-- so we can broaden it later (radius, geocoded polygon) without another
-- schema change.
--
-- Safe to re-run.

DO $$
BEGIN
  -- 1. Widen the fulfillment_method CHECK to allow seller_delivery.
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_fulfillment_method_check;
  ALTER TABLE orders
    ADD CONSTRAINT orders_fulfillment_method_check
    CHECK (fulfillment_method IN ('delivery', 'pickup', 'seller_delivery'));

  CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_method_seller_delivery
    ON orders(fulfillment_method)
    WHERE fulfillment_method = 'seller_delivery';

  COMMENT ON COLUMN orders.fulfillment_method IS
    'How the order is fulfilled. delivery = ship/courier to shipping_address (default). pickup = buyer collects from seller organizations.pickup_address. seller_delivery = seller personally delivers to shipping_address; requires sellers.offers_self_delivery and that the address city falls within self_delivery_zone.localities.';

  -- 2. Per-seller self-delivery configuration on organizations.
  ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS offers_self_delivery BOOLEAN NOT NULL DEFAULT false;

  ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS self_delivery_zone JSONB;

  ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS self_delivery_notes TEXT;

  CREATE INDEX IF NOT EXISTS idx_organizations_offers_self_delivery
    ON organizations(offers_self_delivery)
    WHERE offers_self_delivery = true;

  COMMENT ON COLUMN organizations.offers_self_delivery IS
    'Seller opted in to deliver orders themselves to buyers in self_delivery_zone. Drives whether the buyer checkout shows the "seller delivers it" option.';
  COMMENT ON COLUMN organizations.self_delivery_zone IS
    'Self-delivery coverage. Shape: { "localities": string[] } where each entry is a city or parish the seller will personally deliver to.';
  COMMENT ON COLUMN organizations.self_delivery_notes IS
    'Free-text notes the buyer should see when picking seller delivery (e.g. "Wed & Sat after 3pm only").';
END;
$$;
