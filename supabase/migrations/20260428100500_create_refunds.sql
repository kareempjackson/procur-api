-- First-class refund records. One order can have many refunds (partial-refund history).
-- Powers buyer-cancel auto-refunds, admin manual refunds, and webhook reconciliation.
-- Each row is paired with a transactions row (type='refund') and a credit-note PDF.
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  parent_order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  refund_number TEXT NOT NULL UNIQUE,
  credit_note_number TEXT NOT NULL UNIQUE,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL,
  reason TEXT NOT NULL,
  reason_code TEXT NOT NULL CHECK (reason_code IN (
    'requested_by_customer',
    'duplicate',
    'fraudulent',
    'order_cancelled',
    'quality_issue',
    'other'
  )),
  refund_method TEXT NOT NULL CHECK (refund_method IN ('card', 'buyer_credit')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled')),
  stripe_refund_id TEXT,
  stripe_payment_intent_id TEXT,
  initiated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  initiated_by_role TEXT NOT NULL CHECK (initiated_by_role IN ('admin', 'buyer', 'system')),
  notify_buyer BOOLEAN NOT NULL DEFAULT TRUE,
  buyer_notified_at TIMESTAMPTZ,
  credit_note_pdf_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  succeeded_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_parent_order_id ON refunds(parent_order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_stripe_refund_id
  ON refunds(stripe_refund_id)
  WHERE stripe_refund_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refunds_status_created
  ON refunds(status, created_at DESC);

COMMENT ON TABLE refunds IS
  'Refund records issued against orders. One row per refund attempt; partial refunds produce multiple rows. status moves pending -> succeeded/failed via webhook reconciliation for card refunds, or set immediately for buyer_credit.';
