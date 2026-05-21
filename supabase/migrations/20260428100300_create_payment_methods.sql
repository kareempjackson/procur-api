-- Saved-card storage for buyer organizations.
-- Mirrors Stripe PaymentMethod state we surface to the buyer; PAN is never stored - Stripe holds it.
-- detached_at is a soft-delete so historical transactions can still reference the card.
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  stripe_payment_method_id TEXT NOT NULL,
  brand TEXT,
  last4 TEXT,
  exp_month SMALLINT,
  exp_year SMALLINT,
  cardholder_name TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  detached_at TIMESTAMPTZ,
  CONSTRAINT uniq_org_stripe_payment_method UNIQUE (organization_id, stripe_payment_method_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_org_active
  ON payment_methods(organization_id)
  WHERE detached_at IS NULL;

-- At most one default per org (active rows only).
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_methods_one_default_per_org
  ON payment_methods(organization_id)
  WHERE is_default = TRUE AND detached_at IS NULL;

COMMENT ON TABLE payment_methods IS
  'Saved Stripe PaymentMethods per buyer organization. detached_at soft-deletes a card while preserving transaction audit trails.';
