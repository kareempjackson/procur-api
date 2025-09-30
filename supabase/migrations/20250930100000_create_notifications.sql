-- Notifications core schema
-- Outbox for domain events that should create notifications

CREATE TABLE IF NOT EXISTS notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  actor_user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  payload JSONB NOT NULL,
  dedupe_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_events_dedupe_idx
  ON notification_events(dedupe_key) WHERE dedupe_key IS NOT NULL;

-- Fanout notifications per user
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES notification_events(id) ON DELETE CASCADE,
  recipient_user_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  category TEXT,
  priority TEXT DEFAULT 'normal',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON notifications(recipient_user_id, created_at DESC);

-- Delivery attempts audit
CREATE TABLE IF NOT EXISTS notification_delivery_attempts (
  id BIGSERIAL PRIMARY KEY,
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  attempt_number INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Device tokens for push delivery
CREATE TABLE IF NOT EXISTS user_device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  provider TEXT NOT NULL,
  token TEXT NOT NULL,
  user_agent TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, platform, provider, token)
);

-- Per-user notification settings
CREATE TABLE IF NOT EXISTS user_notification_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  channels JSONB NOT NULL DEFAULT '{"websocket": true, "email": true, "push": false}',
  categories JSONB NOT NULL DEFAULT '{}',
  quiet_hours JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


