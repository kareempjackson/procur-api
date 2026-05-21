-- Add stripe_customer_id to organizations.
-- Lazily populated the first time a buyer org creates a SetupIntent or PaymentIntent.
-- Partial unique index allows multiple NULLs while enforcing uniqueness across populated rows.
-- Safe to run multiple times.

DO $$
BEGIN
  ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

  CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_stripe_customer_id
    ON organizations(stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL;

  COMMENT ON COLUMN organizations.stripe_customer_id IS
    'Stripe Customer id (cus_...) for buyer organizations. Lazily created on first card setup.';
END;
$$;
