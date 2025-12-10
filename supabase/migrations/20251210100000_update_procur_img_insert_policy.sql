-- Update storage RLS insert policy for bucket 'procur-img'
-- Fixes "new row violates row-level security policy" when uploading
-- seller product images and profile assets from the frontend.
--
-- Context:
-- - Existing policy "procur_img_public_insert_products_prefix" only
--   allows INSERT for objects whose name starts with 'products/'.
-- - Admin + seller UIs also write under:
--     - 'seller-products/{sellerOrgId}/...'
--     - 'seller-profile/{sellerOrgId}/...'
-- - Those paths were blocked by RLS, causing the error.
--
-- This migration widens the allowed prefixes while still scoping
-- access to the single bucket 'procur-img'.

do $$ begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'procur_img_public_insert_products_prefix'
  ) then
    drop policy "procur_img_public_insert_products_prefix" on storage.objects;
  end if;
end $$;

create policy "procur_img_public_insert_products_prefix"
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'procur-img'
    and (
      left(name, 9) = 'products/'       -- seller product images (seller UI)
      or left(name, 15) = 'seller-products/' -- seller product images (admin UI)
      or left(name, 15) = 'seller-profile/'  -- seller logos / headers (admin UI)
    )
  );


