-- 026_tenant_logo_storage.sql — ServePoint v5.33.0
-- Supabase Storage bucket for café logos: owners upload a file in Settings
-- instead of having to host a URL somewhere. The bucket is PUBLIC-READ (the
-- logo renders on guest phones, printed receipts and staff screens without
-- any session) and write-scoped per operator: each authenticated user may
-- only touch objects inside their own `tenant-logos/<auth.uid()>/` folder.
--
-- Constraints the storage API itself enforces on upload:
--   file_size_limit 1 MiB  — logos are small; thermal receipts stay light
--   allowed_mime_types     — real image formats only, nothing sneaky
--
-- Idempotent: bucket upserted, policies dropped-then-created.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tenant-logos', 'tenant-logos', true, 1048576,
  array['image/png','image/jpeg','image/webp','image/avif','image/svg+xml']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 1048576,
      allowed_mime_types = array['image/png','image/jpeg','image/webp','image/avif','image/svg+xml'];

drop policy if exists "tenant logo public read"   on storage.objects;
drop policy if exists "tenant logo own upload"    on storage.objects;
drop policy if exists "tenant logo own update"    on storage.objects;
drop policy if exists "tenant logo own delete"    on storage.objects;

-- Reads: anyone may fetch a logo (public bucket; the policy also covers
-- authenticated downloads/list via the API).
create policy "tenant logo public read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'tenant-logos');

-- Writes: authenticated operators only, and ONLY inside their own
-- user-id folder: (storage.foldername(name))[1] must equal their JWT sub.
create policy "tenant logo own upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'tenant-logos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "tenant logo own update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'tenant-logos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "tenant logo own delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'tenant-logos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
