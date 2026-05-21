-- Add Stripe-specific columns to orders for credit-card payments.
-- paid_at already exists from 20251106120000_payments_and_payouts.sql.
-- refunded_amount_cents tracks cumulative partial refunds against the parent's PaymentIntent.
-- Safe to run multiple times.

DO $$
BEGIN
  ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
    ADD COLUMN IF NOT EXISTS stripe_charge_id TEXT,
    ADD COLUMN IF NOT EXISTS refunded_amount_cents BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_refunded_at TIMESTAMPTZ;

  CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_stripe_payment_intent_id
    ON orders(stripe_payment_intent_id)
    WHERE stripe_payment_intent_id IS NOT NULL;

  CREATE INDEX IF NOT EXISTS idx_orders_stripe_charge_id
    ON orders(stripe_charge_id)
    WHERE stripe_charge_id IS NOT NULL;

  COMMENT ON COLUMN orders.stripe_payment_intent_id IS
    'Stripe PaymentIntent id (pi_...) for credit-card orders. Stored on the parent order in multi-seller carts; children copy it for visibility.';
  COMMENT ON COLUMN orders.stripe_charge_id IS
    'Stripe Charge id (ch_...) backing the PaymentIntent. Set after successful capture.';
  COMMENT ON COLUMN orders.refunded_amount_cents IS
    'Cumulative refund total in cents against this order. Updated by RefundsService and the charge.refunded webhook.';
END;
$$;
