-- Stripe webhook event log for idempotent replay protection.
-- INSERT ... ON CONFLICT (id) DO NOTHING is the idempotency primitive; if no row is returned,
-- the event was already processed and the handler returns 200 immediately.
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processing_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type_received
  ON stripe_webhook_events(type, received_at DESC);

COMMENT ON TABLE stripe_webhook_events IS
  'Append-only log of Stripe webhook events keyed by Stripe event id (evt_...). Used for idempotency and replay debugging.';
