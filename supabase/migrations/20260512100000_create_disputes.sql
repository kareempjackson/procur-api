-- Chargeback / dispute records for Stripe charge disputes.
--
-- A dispute is opened by Stripe when the buyer's card-issuing bank initiates a chargeback.
-- We mirror Stripe's dispute object so admins can see status/evidence-deadline inline; the
-- actual evidence-upload UX lives in the Stripe Dashboard (linked from the admin order page).
--
-- Lost disputes are NOT automatically deducted from seller balances; Procur policy is to flag
-- and reconcile manually so admins can decide per-case whether to claw back from the seller
-- or absorb the loss.
--
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  parent_order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  stripe_dispute_id TEXT NOT NULL UNIQUE,
  stripe_charge_id TEXT,
  stripe_payment_intent_id TEXT,
  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL,
  reason TEXT,                                                            -- Stripe reason string
  status TEXT NOT NULL,                                                   -- Stripe status string
  network_reason_code TEXT,
  evidence_due_by TIMESTAMPTZ,
  is_charge_refundable BOOLEAN,
  is_final BOOLEAN NOT NULL DEFAULT FALSE,                                -- true once Stripe stops sending updates
  outcome TEXT CHECK (outcome IN ('won','lost','warning_closed','charge_refunded') OR outcome IS NULL),
  payload_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,                    -- latest event.data.object
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_disputes_order_id ON disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_parent_order_id ON disputes(parent_order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status_created ON disputes(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_disputes_stripe_charge_id ON disputes(stripe_charge_id) WHERE stripe_charge_id IS NOT NULL;

-- Denormalized convenience flag for fast filtering of orders with active disputes
-- (used by admin order list and per-order detail pages). Maintained by DisputesService
-- on every webhook event.
DO $$
BEGIN
  ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS has_active_dispute BOOLEAN NOT NULL DEFAULT FALSE;

  CREATE INDEX IF NOT EXISTS idx_orders_active_dispute
    ON orders(has_active_dispute)
    WHERE has_active_dispute = TRUE;

  COMMENT ON COLUMN orders.has_active_dispute IS
    'TRUE while a non-final Stripe dispute is open against this order''s charge. Flipped back to FALSE when the dispute closes (won/lost/warning_closed). Source of truth is the disputes table.';
END;
$$;

COMMENT ON TABLE disputes IS
  'Stripe chargebacks/disputes mirrored from charge.dispute.* webhooks. Evidence upload happens in Stripe Dashboard; this table tracks status + outcome for internal reporting.';
