-- Add a flag to hide sellers from all marketplace/buyer-facing UIs
-- Sellers remain ACTIVE and can operate; this only affects discoverability in marketplace browsing.

alter table public.organizations
add column if not exists is_marketplace_hidden boolean not null default false;

comment on column public.organizations.is_marketplace_hidden is
  'If true, this seller is hidden from public marketplace and buyer marketplace browsing; seller remains active.';


