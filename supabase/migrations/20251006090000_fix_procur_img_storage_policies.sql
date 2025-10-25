-- Fix storage RLS policies for bucket 'procur-img'
-- Prior migration compared bucket_id to storage.buckets.id (uuid). bucket_id is text (bucket name).

-- Ensure bucket exists and is public for reads
insert into storage.buckets (id, name, public)
values ('procur-img', 'procur-img', true)
on conflict (id) do update set public = true;

-- Drop existing policies if present
do $$ begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'procur_img_public_read'
  ) then
    drop policy "procur_img_public_read" on storage.objects;
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'procur_img_public_insert_products_prefix'
  ) then
    drop policy "procur_img_public_insert_products_prefix" on storage.objects;
  end if;
end $$;

-- Public READ for anon/authenticated on this bucket
create policy "procur_img_public_read"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'procur-img');

-- Public INSERT only under products/ prefix
create policy "procur_img_public_insert_products_prefix"
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'procur-img'
    and left(name, 9) = 'products/'
  );


