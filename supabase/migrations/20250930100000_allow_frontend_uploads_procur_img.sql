-- Ensure the bucket is public (required for getPublicUrl-based access)
update storage.buckets
set public = true
where name = 'procur-img';

-- Allow public READ access to objects in the procur-img bucket
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'procur_img_public_read'
  ) then
    create policy "procur_img_public_read"
      on storage.objects
      for select
      to anon, authenticated
      using (
        bucket_id = (
          select id from storage.buckets where name = 'procur-img'
        )
      );
  end if;
end $$;

-- Allow public INSERT to objects in the procur-img bucket, only under products/ prefix
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'procur_img_public_insert_products_prefix'
  ) then
    create policy "procur_img_public_insert_products_prefix"
      on storage.objects
      for insert
      to anon, authenticated
      with check (
        bucket_id = (
          select id from storage.buckets where name = 'procur-img'
        )
        and left(name, 9) = 'products/'
      );
  end if;
end $$;

-- (Optional) You can further restrict UPDATE/DELETE; we do not grant them here

