-- Create farm visit requests table for farmer verification workflow
create table if not exists farm_visit_requests (
  id uuid primary key default gen_random_uuid(),
  seller_org_id uuid not null references organizations (id) on delete cascade,
  requested_by_user_id uuid not null references users (id) on delete set null,
  preferred_date date,
  preferred_time_window text,
  notes text,
  status text not null default 'pending',
  scheduled_for timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_farm_visit_requests_seller_org_id
  on farm_visit_requests (seller_org_id);

create index if not exists idx_farm_visit_requests_status
  on farm_visit_requests (status);


