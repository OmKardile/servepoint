-- ============================================================================
-- TSOS Migration 005 — Production Baseline Hardening (v5.0.0.1, ADR-0015)
--
-- Purpose (all statements idempotent — safe to re-run on any environment):
--   1. platform_audit_logs.created_at — generated alias of the canonical
--      "timestamp" column, so PostgREST clients ordering by created_at
--      resolve instead of returning PGRST204 (HTTP 400).
--   2. Guarded policy ensures for the three Platform surfaces (tenants,
--      subscriptions, platform_audit_logs) using migration 001's exact
--      policy names — repairs environments where 001 ran partially.
--   3. Bootstrap platform operator (admin@tsos.dev): a REAL Supabase Auth
--      user (role=superadmin in raw_user_meta_data) + an active
--      tenant_users row, so is_superadmin() passes and RLS authorizes the
--      Platform console. This is the ONLY seeded account and it is
--      documented in docs/CREDENTIALS.md.
--
-- HOW TO RUN: Supabase Dashboard → SQL Editor → paste → Run.
-- ============================================================================

-- ── 1. pgcrypto availability (needed for the bcrypt password below) ────────
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ── 2. platform_audit_logs.created_at compatibility column ─────────────────
--    Canonical write column stays "timestamp" (DEFAULT now()); created_at is
--    a STORED generated alias so both names read identically.
ALTER TABLE platform_audit_logs
  ADD COLUMN IF NOT EXISTS created_at timestamptz
  GENERATED ALWAYS AS ("timestamp") STORED;

-- ── 3. Guarded policy ensures (Platform surfaces) ───────────────────────────
DO $guard$
BEGIN
  -- tenants -----------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'tenants' AND policyname = 'Superadmin full access on tenants') THEN
    CREATE POLICY "Superadmin full access on tenants"
      ON tenants FOR ALL TO authenticated
      USING (is_superadmin()) WITH CHECK (is_superadmin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'tenants' AND policyname = 'Tenant read access on own tenant') THEN
    CREATE POLICY "Tenant read access on own tenant"
      ON tenants FOR SELECT TO authenticated
      USING (id = current_tenant_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'tenants' AND policyname = 'Public storefront read tenant by slug') THEN
    CREATE POLICY "Public storefront read tenant by slug"
      ON tenants FOR SELECT TO anon, authenticated
      USING (status IN ('trial', 'active'));
  END IF;

  -- subscriptions -----------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'subscriptions' AND policyname = 'Superadmin full access on subscriptions') THEN
    CREATE POLICY "Superadmin full access on subscriptions"
      ON subscriptions FOR ALL TO authenticated
      USING (is_superadmin()) WITH CHECK (is_superadmin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'subscriptions' AND policyname = 'Tenant read access on own subscription') THEN
    CREATE POLICY "Tenant read access on own subscription"
      ON subscriptions FOR SELECT TO authenticated
      USING (tenant_id = current_tenant_id());
  END IF;

  -- platform_audit_logs -----------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'platform_audit_logs' AND policyname = 'Superadmin full access on platform_audit_logs') THEN
    CREATE POLICY "Superadmin full access on platform_audit_logs"
      ON platform_audit_logs FOR ALL TO authenticated
      USING (is_superadmin()) WITH CHECK (is_superadmin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'platform_audit_logs' AND policyname = 'Tenant read own audit logs') THEN
    CREATE POLICY "Tenant read own audit logs"
      ON platform_audit_logs FOR SELECT TO authenticated
      USING (tenant_id = current_tenant_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'platform_audit_logs' AND policyname = 'System insert audit logs') THEN
    CREATE POLICY "System insert audit logs"
      ON platform_audit_logs FOR INSERT TO anon, authenticated
      WITH CHECK (true);
  END IF;
END
$guard$;

-- ── 4. Bootstrap platform operator ──────────────────────────────────────────
DO $bootstrap$
DECLARE
  v_id     uuid;
  v_email  text := 'admin@tsos.dev';
  v_pass   text := 'admin123456';          -- docs/CREDENTIALS.md
  v_hash   text;
  v_schema text;
BEGIN
  -- Locate the schema pgcrypto actually lives in (Supabase default: extensions)
  SELECT extnamespace::regnamespace::text INTO v_schema
  FROM pg_extension WHERE extname = 'pgcrypto';

  EXECUTE format('SELECT %I.crypt(%L, %I.gen_salt(''bf'', 10))', v_schema, v_pass, v_schema)
  INTO v_hash;

  SELECT id INTO v_id FROM auth.users WHERE email = v_email;

  IF v_id IS NULL THEN
    v_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change, email_change_token_new,
      phone, phone_change, phone_change_token,
      is_sso_user, is_anonymous
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      v_email, v_hash,
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"role":"superadmin","name":"TSOS Developer","full_name":"TSOS Developer"}'::jsonb,
      '', '', '', '',
      '', '', '',
      false, false
    );

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_id::text, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
      'email', now(), now(), now()
    );
  ELSE
    -- Repair path: user exists but metadata/confirmation incomplete
    UPDATE auth.users
       SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role":"superadmin"}'::jsonb,
           email_confirmed_at = COALESCE(email_confirmed_at, now()),
           encrypted_password = COALESCE(encrypted_password, v_hash)
     WHERE id = v_id;

    IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE provider = 'email' AND provider_id = v_id::text) THEN
      INSERT INTO auth.identities (
        provider_id, user_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) VALUES (
        v_id::text, v_id,
        jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
        'email', now(), now(), now()
      );
    END IF;
  END IF;

  -- Belt & braces: active superadmin membership row (tenant-independent) so
  -- is_superadmin() passes even if JWT metadata is stale.
  IF NOT EXISTS (SELECT 1 FROM tenant_users WHERE email = v_email AND role = 'superadmin') THEN
    INSERT INTO tenant_users (tenant_id, user_id, email, role, is_active)
    VALUES (NULL, v_id, v_email, 'superadmin', true);
  END IF;
END
$bootstrap$;

-- ── 5. Verification hints (run manually if desired) ─────────────────────────
--   SELECT count(*) FROM public.tenants;                       -- expect 0 rows, no error
--   SELECT policy_name FROM pg_policies WHERE tablename='tenants';
--   SELECT email, raw_user_meta_data->>'role' FROM auth.users; -- admin@tsos.dev / superadmin
