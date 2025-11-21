-- Create table to track processed Stripe webhook events (idempotency)
create table if not exists stripe_events_processed (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now(),
  payload jsonb
);

-- Helpful index on type for analytics/debugging
create index if not exists idx_stripe_events_processed_type
  on stripe_events_processed(type);


