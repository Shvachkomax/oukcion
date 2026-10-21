-- Media bucket for artist and product photos.
-- Idempotent: safe to re-run.
--
-- The bucket is public because the public site renders photos for anonymous
-- visitors through getPublicUrl(). Writes are never allowed for clients:
-- the cabinet uploads through the service_role client, which bypasses RLS.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'oukcion-media',
  'oukcion-media',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read for this bucket only.
drop policy if exists "Oukcion media is publicly readable" on storage.objects;
create policy "Oukcion media is publicly readable"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'oukcion-media');

-- No insert/update/delete policy is created for anon/authenticated, so client
-- writes stay denied. The cabinet uploads with the service_role client.
drop policy if exists "Oukcion media is writable by service role" on storage.objects;
create policy "Oukcion media is writable by service role"
on storage.objects
for insert
to service_role
with check (bucket_id = 'oukcion-media');
