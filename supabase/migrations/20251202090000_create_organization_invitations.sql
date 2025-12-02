-- Create table for organization team invitations
create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role_id uuid not null references public.organization_roles(id) on delete restrict,
  inviter_user_id uuid not null references public.users(id) on delete restrict,
  token text not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists organization_invitations_org_idx
  on public.organization_invitations (organization_id);

create index if not exists organization_invitations_token_idx
  on public.organization_invitations (token);


