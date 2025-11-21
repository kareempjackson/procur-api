-- Notification system base tables
-- 1) Events table (source-of-truth for fanout)
create table if not exists notification_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_user_id uuid,
  organization_id uuid,
  payload jsonb not null,
  dedupe_key text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notification_events_processed_at
  on notification_events(processed_at nulls last);
create index if not exists idx_notification_events_event_type
  on notification_events(event_type);

-- 2) Per-recipient notifications
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references notification_events(id) on delete cascade,
  recipient_user_id uuid not null,
  title text not null,
  body text not null,
  data jsonb,
  category text,
  priority text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_recipient
  on notifications(recipient_user_id, created_at desc);
create index if not exists idx_notifications_read_at
  on notifications(read_at nulls last);

-- 3) Delivery attempts audit
create table if not exists notification_delivery_attempts (
  id bigserial primary key,
  notification_id uuid not null references notifications(id) on delete cascade,
  channel text not null, -- websocket | push | email | sms | whatsapp
  status text not null,  -- success | retry | failed
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_notification_delivery_attempts_notif
  on notification_delivery_attempts(notification_id, created_at desc);


