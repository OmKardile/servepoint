-- ═══════════════════════════════════════════════════════════════════════
-- ServePoint v5.1.3 — Migration 009: Owner membership seeding + self-claim
-- ═══════════════════════════════════════════════════════════════════════
--
-- Found by the live UI E2E (test → debug → retest):
--   The wizard provisioned the tenant + subscription + auth user but NEVER
--   the owner's `tenant_users` membership row. Every member RLS policy
--   (tsos_is_tenant_member / sp_tenant_member) therefore failed for owners:
--   all reads silently rode on public storefront policies and EVERY write
--   (locations, orders, …) returned 42501/403. Owners could never sell.
--
-- Fix, in three idempotent pieces:
--   1. Trigger on tenants AFTER INSERT → seed the owner membership keyed by
--      owner_email (user_id filled when the auth user exists, else NULL).
--   2. SECURITY DEFINER RPC sp_claim_tenant_memberships() → at sign-in the
--      client stamps user_id onto email-matching NULL rows (verified-JWT
--      email only). Covers "auth user created after the tenant" ordering.
--   3. (Data) existing tenants are backfilled by a one-off SQL run from the
--      CLI — see worklog/CHANGELOG; not part of this file's schema changes.
--
-- Idempotent. Applies from the CLI:
--   SUPABASE_DB_PASSWORD='<db-password>' bun scripts/db-setup.mjs
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Seed the owner membership when a tenant is provisioned ───────────
CREATE OR REPLACE FUNCTION sp_seed_owner_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO tenant_users (tenant_id, user_id, email, role, is_active)
  SELECT NEW.id, u.id, lower(NEW.owner_email), 'owner', true
  FROM auth.users u
  WHERE lower(u.email) = lower(NEW.owner_email)
  LIMIT 1;

  IF NOT FOUND THEN
    -- Auth user may be created right after the tenant (wizard order) —
    -- insert an email-keyed row; sp_claim_tenant_memberships() stamps it.
    INSERT INTO tenant_users (tenant_id, user_id, email, role, is_active)
    VALUES (NEW.id, NULL, lower(NEW.owner_email), 'owner', true);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenants_seed_owner ON tenants;
CREATE TRIGGER trg_tenants_seed_owner
AFTER INSERT ON tenants
FOR EACH ROW EXECUTE FUNCTION sp_seed_owner_membership();

-- ── 2. Self-claim at sign-in (verified JWT email → user_id) ─────────────
CREATE OR REPLACE FUNCTION sp_claim_tenant_memberships()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_email TEXT;
BEGIN
  v_email := lower(COALESCE(auth.jwt() ->> 'email', ''));
  IF auth.uid() IS NULL OR v_email = '' THEN
    RETURN 0;
  END IF;

  UPDATE tenant_users tu
     SET user_id = auth.uid()
   WHERE lower(tu.email) = v_email
     AND tu.user_id IS NULL
     AND tu.is_active;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ── Verification ─────────────────────────────────────────────────────────
SELECT to_regprocedure('public.sp_claim_tenant_memberships()') IS NOT NULL AS claim_fn,
       to_regprocedure('public.sp_seed_owner_membership()')  IS NOT NULL AS seed_fn,
       EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tenants_seed_owner' AND NOT tgisinternal) AS seed_trg;
