-- Payment links for offline checkout (cash / cheque / bank transfer)
-- This feature lets farmers/sellers create shareable payment links that buyers
-- can use with or without an account. Payments are offline but structured and
-- auditable inside Procur.

-- Enum for high-level payment link lifecycle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'payment_link_status'
  ) THEN
    CREATE TYPE payment_link_status AS ENUM (
      'draft',
      'active',
      'awaiting_payment_confirmation',
      'paid',
      'expired',
      'cancelled'
    );
  END IF;
END$$;

-- Core payment_links table
CREATE TABLE IF NOT EXISTS payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Public code used in URLs, e.g. /p/grn-8F2K9A
  link_code TEXT NOT NULL UNIQUE,

  -- Parties and order context
  order_id UUID REFERENCES orders(id),
  seller_org_id UUID NOT NULL REFERENCES organizations(id),
  buyer_org_id UUID REFERENCES organizations(id),

  -- Optional guest / ad-hoc buyer information snapshot
  buyer_contact JSONB,

  -- High-level link status
  status payment_link_status NOT NULL DEFAULT 'active',

  -- Money amounts (stored in major currency units, consistent with orders)
  currency VARCHAR(3) NOT NULL DEFAULT 'XCD',
  subtotal_amount DECIMAL(10,2) NOT NULL,
  delivery_fee_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  platform_fee_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,

  -- Allowed offline payment methods for this link
  -- Example: ['bank_transfer','cash_on_delivery','cheque_on_delivery']
  allowed_payment_methods TEXT[] NOT NULL DEFAULT '{}',

  -- Structured fee breakdown for UI (can mirror the numeric columns above)
  fee_breakdown JSONB,

  -- Expiry and receipt metadata
  expires_at TIMESTAMPTZ,
  receipt_url TEXT,

  -- Audit
  meta JSONB,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT payment_links_positive_amounts CHECK (
    subtotal_amount > 0
    AND delivery_fee_amount >= 0
    AND platform_fee_amount >= 0
    AND tax_amount >= 0
    AND total_amount > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_payment_links_order_id
  ON payment_links(order_id);

CREATE INDEX IF NOT EXISTS idx_payment_links_seller_org_id
  ON payment_links(seller_org_id);

CREATE INDEX IF NOT EXISTS idx_payment_links_buyer_org_id
  ON payment_links(buyer_org_id);

CREATE INDEX IF NOT EXISTS idx_payment_links_status
  ON payment_links(status);

-- Per-link offline payment attempts / confirmations
-- We intentionally avoid reusing the generic "transactions" ledger here.
-- These rows represent the buyer-facing intent; final accounting can be
-- bridged into transactions/clearing flows later.
CREATE TABLE IF NOT EXISTS payment_link_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  payment_link_id UUID NOT NULL REFERENCES payment_links(id) ON DELETE CASCADE,

  -- Amount and currency at time of intent/confirmation
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'XCD',

  -- Offline payment method and high-level status
  payment_method_type TEXT NOT NULL, -- 'bank_transfer' | 'cash_on_delivery' | 'cheque_on_delivery'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'awaiting_manual_confirmation' | 'paid' | 'cancelled'

  -- Optional references / proofs for manual review
  payment_reference TEXT,
  proof_url TEXT,

  -- Extra metadata (bank snapshot, cheque details, etc.)
  meta JSONB,

  -- Timestamps
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_link_payments_link_id
  ON payment_link_payments(payment_link_id);

CREATE INDEX IF NOT EXISTS idx_payment_link_payments_status
  ON payment_link_payments(status);


