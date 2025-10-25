-- Create the procur-img storage bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('procur-img', 'procur-img', true)
on conflict (id) do update
set public = true;
