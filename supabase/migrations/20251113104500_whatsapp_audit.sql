-- WhatsApp audit trail table
create table if not exists whatsapp_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  from_e164 text,
  event text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_audit_user_created_idx on whatsapp_audit (user_id, created_at);
create index if not exists whatsapp_audit_event_created_idx on whatsapp_audit (event, created_at);


