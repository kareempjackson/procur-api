-- Ensure UUID generation function is available
-- On Supabase, prefer pgcrypto's gen_random_uuid() over uuid_generate_v4()
create extension if not exists "pgcrypto";

-- Create table for seller → buyer ratings, one per (order, seller)
create table if not exists public.buyer_reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  seller_org_id uuid not null references public.organizations(id),
  buyer_org_id uuid not null references public.organizations(id),
  rating numeric(2,1) not null check (rating >= 1 and rating <= 5),
  payment_behavior_rating numeric(2,1),
  communication_rating numeric(2,1),
  reliability_rating numeric(2,1),
  review_text text,
  created_by_user_id uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint buyer_reviews_unique_order_seller unique (order_id, seller_org_id)
);

create index if not exists idx_buyer_reviews_buyer_org_id
  on public.buyer_reviews (buyer_org_id);

create index if not exists idx_buyer_reviews_seller_org_id
  on public.buyer_reviews (seller_org_id);

create index if not exists idx_buyer_reviews_order_id
  on public.buyer_reviews (order_id);

comment on table public.buyer_reviews is
  'Per-order ratings that sellers give to buyers after a transaction is completed.';


