-- Events Pipeline: Central event store for all domain events
-- Enables analytics, audit trail, real-time reactions, webhooks, and data pipelines

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  
  -- Event identification
  event_type text not null,              -- e.g. 'order.created', 'user.registered'
  event_version int not null default 1,  -- Schema version for this event type
  
  -- Aggregate context (what entity is this event about)
  aggregate_type text,                   -- e.g. 'order', 'user', 'product'
  aggregate_id uuid,                     -- ID of the primary entity
  
  -- Actor context (who/what triggered this event)
  actor_id uuid,                         -- User who triggered (null for system)
  actor_type text default 'user',        -- 'user' | 'system' | 'webhook' | 'cron'
  organization_id uuid,                  -- Org context if applicable
  
  -- Event data
  payload jsonb not null default '{}',   -- Event-specific data
  metadata jsonb default '{}',           -- Request context, trace IDs, etc.
  
  -- Idempotency & processing
  idempotency_key text unique,           -- Prevent duplicate events
  processed_at timestamptz,              -- When async handlers finished
  
  -- Timestamps
  created_at timestamptz not null default now()
);

-- Indexes for common query patterns
create index if not exists idx_events_type_created 
  on events(event_type, created_at desc);

create index if not exists idx_events_aggregate 
  on events(aggregate_type, aggregate_id, created_at desc);

create index if not exists idx_events_org_created 
  on events(organization_id, created_at desc);

create index if not exists idx_events_actor 
  on events(actor_id, created_at desc);

create index if not exists idx_events_processed 
  on events(processed_at nulls first);

create index if not exists idx_events_created_at 
  on events(created_at desc);

-- GIN index for payload queries (JSONB)
create index if not exists idx_events_payload 
  on events using gin(payload jsonb_path_ops);

-- Comments for documentation
comment on table events is 'Central event store for all domain events - analytics, audit, real-time, webhooks';
comment on column events.event_type is 'Dot-namespaced event type, e.g. order.created, user.registered';
comment on column events.aggregate_type is 'The domain entity type this event is about';
comment on column events.aggregate_id is 'The ID of the entity this event is about';
comment on column events.actor_type is 'What triggered this event: user, system, webhook, or cron';
comment on column events.idempotency_key is 'Optional key to prevent duplicate events from retries';
comment on column events.processed_at is 'Timestamp when async handlers finished processing';

