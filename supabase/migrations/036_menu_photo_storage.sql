-- ═══════════════════════════════════════════════════════════════════════════
-- 036_menu_photo_storage.sql — ServePoint v5.48.0 "the dishes get their faces"
--
-- menu_items.image_url has been rendered everywhere since the beginning —
-- the counter POS item modal, the guest-facing dish thumbs, Dashboard's
-- Trending Dishes — but NOTHING could ever put a photo there: no upload
-- UI, no storage bucket, no API. The dishes had frames but no faces. This
-- migration builds the bucket that closes the loop, mirroring 026's
-- tenant-logos pattern with two deliberate differences:
--
--   1. FOLDER = TENANT, not user: menu photos belong to the café, not to
--      whichever owner happened to upload them. Every object lives under
--      menu-photos/<tenant_id>/…, and the write policies scope by TENANT
--      MEMBERSHIP (003's owner/staff, is_active) on that first folder —
--      the same member gate every operational table uses. 026 scoped by
--      auth.uid because a logo is the account's face; a dish photo is the
--      house's.
--   2. NO SVG: dish photos are photographs. svg+xml is a script-injection
--      vector when served publicly and no phone photo is ever svg — the
--      mime allowlist is png/jpeg/webp/avif only. 2 MiB (photos are bigger
--      than logos, thermal receipts still stay light).
--
-- Idempotent: bucket upserted, policies dropped-then-created.
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-photos', 'menu-photos', true, 2097152,
  array['image/png','image/jpeg','image/webp','image/avif']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/png','image/jpeg','image/webp','image/avif'];

drop policy if exists "menu photos public read"     on storage.objects;
drop policy if exists "menu photos member upload"   on storage.objects;
drop policy if exists "menu photos member update"   on storage.objects;
drop policy if exists "menu photos member delete"   on storage.objects;

-- Reads: anyone may fetch a dish photo (public bucket — guest phones load
-- the menu without a session; the policy also covers authenticated listing).
create policy "menu photos public read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'menu-photos');

-- Writes: active owner/staff of the tenant that owns the FIRST folder.
-- Path contract: menu-photos/<tenant_id>/<menu_item_id>-<timestamp>.<ext>
create policy "menu photos member upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'menu-photos'
  and exists (
    select 1 from tenant_users tu
    where tu.tenant_id::text = (storage.foldername(name))[1]
      and tu.user_id = auth.uid()
      and tu.role in ('owner','staff')
      and tu.is_active
  )
);

create policy "menu photos member update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'menu-photos'
  and exists (
    select 1 from tenant_users tu
    where tu.tenant_id::text = (storage.foldername(name))[1]
      and tu.user_id = auth.uid()
      and tu.role in ('owner','staff')
      and tu.is_active
  )
);

create policy "menu photos member delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'menu-photos'
  and exists (
    select 1 from tenant_users tu
    where tu.tenant_id::text = (storage.foldername(name))[1]
      and tu.user_id = auth.uid()
      and tu.role in ('owner','staff')
      and tu.is_active
  )
);

-- ── Verification (fail loudly) ─────────────────────────────────────────────
DO $$
DECLARE
  v_pub   BOOLEAN;
  v_lim   INT;
  v_pol   INT;
BEGIN
  SELECT public, file_size_limit INTO v_pub, v_lim
    FROM storage.buckets WHERE id = 'menu-photos';
  IF v_pub IS DISTINCT FROM true OR v_lim <> 2097152 THEN
    RAISE EXCEPTION 'menu-photos bucket misconfigured (public=%, limit=%)', v_pub, v_lim;
  END IF;

  SELECT count(*) INTO v_pol
    FROM pg_policies
   WHERE schemaname = 'storage'
     AND tablename = 'objects'
     AND policyname IN ('menu photos public read','menu photos member upload',
                        'menu photos member update','menu photos member delete');
  IF v_pol <> 4 THEN
    RAISE EXCEPTION 'menu-photos policies missing (found %/4)', v_pol;
  END IF;

  RAISE NOTICE '036 verified: menu-photos public bucket (2 MiB, raster-only), 4 member-scoped policies.';
END $$;
