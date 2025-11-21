-- System-wide HTTP/API audit log
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  organization_id uuid references organizations(id) on delete set null,
  actor_email text,
  actor_role user_role,
  actor_account_type account_type,
  action text not null,
  resource text,
  resource_id uuid,
  route text,
  method text,
  status_code int,
  ip_address text,
  user_agent text,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_at_idx on audit_log (created_at desc);
create index if not exists audit_log_user_created_idx on audit_log (user_id, created_at desc);
create index if not exists audit_log_route_created_idx on audit_log (route, created_at desc);
create index if not exists audit_log_action_created_idx on audit_log (action, created_at desc);


