-- ============================================================================
-- TSOS Migration 003 — v4.0.0 Role Model Merge (owner-mandated)
-- Manager + Cashier (+ barista/waiter/kitchen variants) merge into ONE 'staff'
-- role that operates the whole cafe POS app. Account-creation stays owner-only.
-- SuperAdmin remains the TSOS developer/platform-only role.
--
-- HOW TO RUN: Supabase Dashboard → SQL Editor → paste → Run.
-- (The sandbox has no Postgres connection string; the owner runs migrations.)
-- ============================================================================

-- 1. Widen the role CHECK to the new model, then fold legacy roles into 'staff'.
--    (Old roles are kept valid by the update below before tightening the CHECK.)

UPDATE tenant_users
SET role = 'staff'
WHERE role IN ('manager', 'cashier', 'barista', 'waiter', 'kitchen', 'chef', 'server', 'cleaner');

ALTER TABLE tenant_users DROP CONSTRAINT IF EXISTS tenant_users_role_check;
ALTER TABLE tenant_users ADD CONSTRAINT tenant_users_role_check
  CHECK (role IN ('superadmin', 'owner', 'staff'));

-- 2. RLS helper policies referencing legacy roles → 'staff'.

-- Drop the legacy-role member policies (names from migration 001; IF EXISTS keeps this idempotent)
DROP POLICY IF EXISTS "tenant member read" ON tenants;
DROP POLICY IF EXISTS "Tenant members can view their tenant" ON tenants;
DROP POLICY IF EXISTS "Tenant owner full access" ON tenants;
DROP POLICY IF EXISTS "Tenant member select" ON locations;
DROP POLICY IF EXISTS "Tenant owner manage locations" ON locations;
DROP POLICY IF EXISTS "Tenant member manage dining_tables" ON dining_tables;
DROP POLICY IF EXISTS "Tenant member manage categories" ON categories;
DROP POLICY IF EXISTS "Tenant member manage menu_items" ON menu_items;
DROP POLICY IF EXISTS "Tenant member manage inventory_items" ON inventory_items;
DROP POLICY IF EXISTS "Tenant member manage orders" ON orders;
DROP POLICY IF EXISTS "Tenant member manage order_items" ON order_items;

-- 3. Re-create the generic member/owner policies on the new role set.
--    Pattern matches migration 001's helpers; uses tenant_users membership.

CREATE OR REPLACE FUNCTION tsos_is_tenant_member() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_users tu
    WHERE tu.user_id = auth.uid()
      AND tu.tenant_id = current_tenant_id()
      AND tu.is_active = true
      AND tu.role IN ('owner', 'staff')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION tsos_is_tenant_owner() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_users tu
    WHERE tu.user_id = auth.uid()
      AND tu.tenant_id = current_tenant_id()
      AND tu.is_active = true
      AND tu.role = 'owner'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Member read + owner/staff write on the core operational tables.
-- If migration 001 already created equivalent policies for these tables, the
-- DROP IF EXISTS above removed the legacy-role variants; these replace them.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['locations', 'dining_tables', 'categories', 'menu_items',
                           'inventory_items', 'orders', 'order_items']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "member select %1$s" ON %1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "member write %1$s" ON %1$I', t);
    EXECUTE format($f$
      CREATE POLICY "member select %1$s" ON %1$I
        FOR SELECT TO authenticated
        USING (tsos_is_tenant_member());
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "member write %1$s" ON %1$I
        FOR ALL TO authenticated
        USING (tsos_is_tenant_member())
        WITH CHECK (tsos_is_tenant_member());
    $f$, t);
  END LOOP;
END $$;

-- 4. Platform superadmin keeps full access via the existing JWT-role helper
--    (migration 001 §is_platform_admin). Owner-only abilities (staff account
--    creation, tenant_user management) are enforced in-app via RBAC and by the
--    tenant_users policies below.

DROP POLICY IF EXISTS "owner manages tenant_users" ON tenant_users;
CREATE POLICY "owner manages tenant_users" ON tenant_users
  FOR ALL TO authenticated
  USING (
    tsos_is_tenant_owner()
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  )
  WITH CHECK (
    tsos_is_tenant_owner()
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  );

-- ============================================================================
-- Done. New role set: superadmin | owner | staff
-- App mapping (src/lib/rbac.ts): manager/cashier/kitchen/barista/chef/server → staff
-- ============================================================================
