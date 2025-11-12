-- Payments and manual payouts schema additions

-- Orders: stripe/payment audit fields
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Organizations: optional payout info snapshots (for CSV exports)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_last4 TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_holder TEXT,
  ADD COLUMN IF NOT EXISTS bank_routing_last4 TEXT,
  ADD COLUMN IF NOT EXISTS payout_notes TEXT;

-- Aggregate seller balances
CREATE TABLE IF NOT EXISTS seller_balances (
  seller_org_id UUID PRIMARY KEY REFERENCES organizations(id),
  available_amount_cents BIGINT NOT NULL DEFAULT 0,
  pending_amount_cents BIGINT NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payout batches (manual bank transfers)
CREATE TABLE IF NOT EXISTS payout_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference VARCHAR(64) UNIQUE NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft', -- draft|exported|paid|failed
  total_items INT NOT NULL DEFAULT 0,
  total_amount_cents BIGINT NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS payout_batch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES payout_batches(id) ON DELETE CASCADE,
  seller_org_id UUID NOT NULL REFERENCES organizations(id),
  amount_cents BIGINT NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status VARCHAR(32) NOT NULL DEFAULT 'pending', -- pending|paid|failed
  transactions JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of transaction IDs or objects
  bank_snapshot JSONB,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helper function to increment seller balance
CREATE OR REPLACE FUNCTION increment_seller_balance(p_seller_org_id UUID, p_delta_cents BIGINT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO seller_balances (seller_org_id, available_amount_cents)
  VALUES (p_seller_org_id, p_delta_cents)
  ON CONFLICT (seller_org_id)
  DO UPDATE SET
    available_amount_cents = seller_balances.available_amount_cents + EXCLUDED.available_amount_cents,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;


