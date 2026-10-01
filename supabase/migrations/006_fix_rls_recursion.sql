-- ═══════════════════════════════════════════════════════════════════════
-- ServePoint v5.0.7 — Migration 006: Fix RLS infinite recursion (42P17)
-- on "tenant_users" (broke Messages, Notifications, Settings → Team).
-- ═══════════════════════════════════════════════════════════════════════
--
-- ROOT CAUSE
--   Migration 001 created a policy on tenant_users that itself queries
--   tenant_users ("Tenant owner manage staff members" ... EXISTS
--   (SELECT 1 FROM tenant_users tu ...)). Evaluating ANY statement against
--   tenant_users therefore re-evaluates tenant_users' own policies and
--   Postgres aborts with 42P17 "infinite recursion detected in policy for
--   relation tenant_users".
--   Migration 004's policies on notifications / conversations /
--   conversation_messages do a plain EXISTS (SELECT 1 FROM tenant_users
--   ...) — that subquery runs WITH RLS as the caller, so every
--   Messages/Notifications read died on the broken policy. Menu, order and
--   bill surfaces never touch tenant_users directly (they call the
--   SECURITY DEFINER helpers), which is why only these screens broke.
--
-- FIX (idempotent — safe to re-run; touches NO data)
--   1. Add sp_tenant_member(p_tenant_id): a SECURITY DEFINER membership
--      test (definer functions bypass RLS on tenant_users, so no recursion
--      is possible), including the platform-superadmin override.
--   2. Drop 001's self-referencing tenant_users policy; 003's
--      "owner manages tenant_users" (definer-based) supersedes it.
--   3. Rewrite the three migration-004 policies to use the helper instead
--      of raw tenant_users subqueries.
--   4. Pin `SET search_path = public` on every RLS helper (definer
--      functions must never run under a mutable search_path).
--
-- HOW TO RUN: Supabase Dashboard → SQL Editor → paste → Run, then hit
-- Retry in the app. Pooler route: SUPABASE_DB_PASSWORD='<pw>' bun scripts/db-setup.mjs
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Membership helper (SECURITY DEFINER ⇒ RLS-free tenant_users read) ─
CREATE OR REPLACE FUNCTION sp_tenant_member(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_users tu
    WHERE tu.tenant_id = p_tenant_id
      AND tu.user_id = auth.uid()
      AND tu.is_active
      AND tu.role IN ('owner', 'staff')
  ) OR is_superadmin();
$$;

-- ── 2. Kill the recursion source: 001's self-referencing policy ──────────
DROP POLICY IF EXISTS "Tenant owner manage staff members" ON tenant_users;

-- Ensure the 003 replacement exists (identical to 003, + is_superadmin()
-- belt-and-braces for any JWT metadata drift).
DROP POLICY IF EXISTS "owner manages tenant_users" ON tenant_users;
CREATE POLICY "owner manages tenant_users" ON tenant_users
  FOR ALL TO authenticated
  USING (
    tsos_is_tenant_owner()
    OR is_superadmin()
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  );

-- ── 3. Rewrite migration 004's policies via the helper ───────────────────
DROP POLICY IF EXISTS "notifications_member_all" ON notifications;
CREATE POLICY "notifications_member_all" ON notifications
  FOR ALL TO authenticated
  USING (
    auth.uid() IS NOT NULL AND sp_tenant_member(notifications.tenant_id)
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND sp_tenant_member(notifications.tenant_id)
  );

DROP POLICY IF EXISTS "conversations_member_all" ON conversations;
CREATE POLICY "conversations_member_all" ON conversations
  FOR ALL TO authenticated
  USING (
    auth.uid() IS NOT NULL AND sp_tenant_member(conversations.tenant_id)
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND sp_tenant_member(conversations.tenant_id)
  );

DROP POLICY IF EXISTS "conv_messages_member_all" ON conversation_messages;
CREATE POLICY "conv_messages_member_all" ON conversation_messages
  FOR ALL TO authenticated
  USING (
    auth.uid() IS NOT NULL AND sp_tenant_member(conversation_messages.tenant_id)
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND sp_tenant_member(conversation_messages.tenant_id)
  );

-- ── 4. Pin search_path on every existing RLS helper ──────────────────────
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id TEXT;
BEGIN
  -- 1. Check JWT app_metadata claim
  v_tenant_id := auth.jwt() -> 'app_metadata' ->> 'tenant_id';
  IF v_tenant_id IS NOT NULL AND v_tenant_id <> '' THEN
    RETURN v_tenant_id::UUID;
  END IF;

  -- 2. Check JWT user_metadata claim
  v_tenant_id := auth.jwt() -> 'user_metadata' ->> 'tenant_id';
  IF v_tenant_id IS NOT NULL AND v_tenant_id <> '' THEN
    RETURN v_tenant_id::UUID;
  END IF;

  -- 3. Check tenant_users active membership for auth.uid()
  SELECT tenant_id INTO v_tenant_id
  FROM tenant_users
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;

  IF v_tenant_id IS NOT NULL THEN
    RETURN v_tenant_id::UUID;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check JWT claims
  IF (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin' THEN
    RETURN TRUE;
  END IF;
  IF (auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin' THEN
    RETURN TRUE;
  END IF;

  -- Check tenant_users table
  IF EXISTS (
    SELECT 1 FROM tenant_users
    WHERE user_id = auth.uid() AND role = 'superadmin' AND is_active = true
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION tsos_is_tenant_member() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_users tu
    WHERE tu.user_id = auth.uid()
      AND tu.tenant_id = current_tenant_id()
      AND tu.is_active = true
      AND tu.role IN ('owner', 'staff')
  );
$$;

CREATE OR REPLACE FUNCTION tsos_is_tenant_owner() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_users tu
    WHERE tu.user_id = auth.uid()
      AND tu.tenant_id = current_tenant_id()
      AND tu.is_active = true
      AND tu.role = 'owner'
  );
$$;

-- ── 5. Verification (prints the policies now in force) ───────────────────
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('tenant_users', 'notifications', 'conversations', 'conversation_messages')
ORDER BY tablename, policyname;
