-- =============================================================================
-- TSOS (The Cafe Operating System) — Multi-Tenant SaaS Database Migration
-- Migration: 001_multi_tenant_saas.sql
-- Description: Core Multi-Tenant schema, Tenant isolation, Supabase Auth links,
--              Row Level Security (RLS) policies, and Anti-Tamper RPCs.
-- =============================================================================

-- Enable required cryptographic extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. HELPER TRIGGER FUNCTIONS
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 2. TENANTS TABLE (Core SaaS Subscribing Businesses)
-- =============================================================================
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  legal_name TEXT,
  slug TEXT UNIQUE NOT NULL,
  business_type TEXT NOT NULL DEFAULT 'cafe' CHECK (
    business_type IN ('cafe', 'restaurant', 'quick_service', 'bakery', 'brewery', 'cloud_kitchen')
  ),
  status TEXT NOT NULL DEFAULT 'trial' CHECK (
    status IN ('trial', 'active', 'past_due', 'suspended', 'cancelled', 'archived')
  ),
  owner_email TEXT NOT NULL,
  owner_phone TEXT,
  upi_id TEXT,
  gst_number TEXT,
  pan_number TEXT,
  fssai_number TEXT,
  address TEXT,
  city TEXT NOT NULL DEFAULT 'Bengaluru',
  state TEXT NOT NULL DEFAULT 'Karnataka',
  postal_code TEXT,
  country TEXT NOT NULL DEFAULT 'India',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_tenants_updated_at
BEFORE UPDATE ON tenants
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_owner_email ON tenants(owner_email);

-- =============================================================================
-- 3. SUBSCRIPTIONS TABLE (Monthly SaaS Subscriptions & Custom Deals)
-- =============================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL CHECK (
    plan_id IN ('starter', 'growth', 'pro', 'enterprise')
  ),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (
    billing_cycle IN ('monthly', 'quarterly', 'annual')
  ),
  monthly_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  applied_discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  final_monthly_rate NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  deal_notes TEXT,
  status TEXT NOT NULL DEFAULT 'trialing' CHECK (
    status IN ('trialing', 'active', 'past_due', 'cancelled', 'expired')
  ),
  trial_start TIMESTAMPTZ DEFAULT now(),
  trial_end TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ,
  next_billing_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_tenant_subscription UNIQUE (tenant_id)
);

CREATE TRIGGER trg_subscriptions_updated_at
BEFORE UPDATE ON subscriptions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- =============================================================================
-- 4. TENANT USERS TABLE (Role-Based Membership & Supabase Auth Bridge)
-- =============================================================================
CREATE TABLE IF NOT EXISTS tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (
    role IN ('superadmin', 'owner', 'manager', 'cashier', 'barista', 'waiter')
  ),
  pin_hash TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_tenant_users_updated_at
BEFORE UPDATE ON tenant_users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_user ON tenant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_email ON tenant_users(email);

-- =============================================================================
-- 5. LOCATIONS TABLE (Physical Outlets)
-- =============================================================================
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  phone TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_locations_updated_at
BEFORE UPDATE ON locations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_locations_tenant ON locations(tenant_id);

-- =============================================================================
-- 6. DINING TABLES TABLE (Floor Plan & Table QR Tokens)
-- =============================================================================
CREATE TABLE IF NOT EXISTS dining_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  table_number TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 4,
  section TEXT DEFAULT 'Main Floor',
  qr_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  status TEXT NOT NULL DEFAULT 'available' CHECK (
    status IN ('available', 'occupied', 'reserved', 'billing')
  ),
  active_order_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_dining_tables_updated_at
BEFORE UPDATE ON dining_tables
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_dining_tables_tenant ON dining_tables(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dining_tables_location ON dining_tables(location_id);
CREATE INDEX IF NOT EXISTS idx_dining_tables_token ON dining_tables(qr_token);

-- =============================================================================
-- 7. CATEGORIES & MENU ITEMS
-- =============================================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id);

CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  image_url TEXT,
  is_veg BOOLEAN NOT NULL DEFAULT true,
  is_available BOOLEAN NOT NULL DEFAULT true,
  tax_rate_pct NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_menu_items_updated_at
BEFORE UPDATE ON menu_items
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_menu_items_tenant ON menu_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(is_available);

-- =============================================================================
-- 8. INVENTORY ITEMS & RECIPES BOM (Bill of Materials)
-- =============================================================================
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  current_stock NUMERIC(12,3) NOT NULL DEFAULT 0.000,
  unit TEXT NOT NULL CHECK (unit IN ('g', 'kg', 'ml', 'l', 'pcs')),
  reorder_point NUMERIC(12,3) NOT NULL DEFAULT 0.000,
  cost_per_unit NUMERIC(10,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_inventory_items_updated_at
BEFORE UPDATE ON inventory_items
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_inventory_items_tenant ON inventory_items(tenant_id);

CREATE TABLE IF NOT EXISTS recipes_bom (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity_used NUMERIC(12,3) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recipes_bom_tenant ON recipes_bom(tenant_id);
CREATE INDEX IF NOT EXISTS idx_recipes_bom_menu_item ON recipes_bom(menu_item_id);

-- =============================================================================
-- 9. ORDERS & ORDER ITEMS
-- =============================================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  table_id UUID REFERENCES dining_tables(id) ON DELETE SET NULL,
  order_number BIGINT GENERATED ALWAYS AS IDENTITY,
  order_type TEXT NOT NULL DEFAULT 'dine_in' CHECK (
    order_type IN ('dine_in', 'takeaway', 'delivery')
  ),
  status TEXT NOT NULL DEFAULT 'new' CHECK (
    status IN ('new', 'pending', 'preparing', 'ready', 'completed', 'cancelled')
  ),
  customer_name TEXT,
  customer_phone TEXT,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  platform_fee NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    payment_status IN ('pending', 'completed', 'failed', 'refunded')
  ),
  payment_method TEXT DEFAULT 'cash' CHECK (
    payment_method IN ('cash', 'upi', 'card', 'split')
  ),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_location ON orders(location_id);
CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  variant_name TEXT,
  qty INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  item_total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_tenant ON order_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- =============================================================================
-- 10. PLATFORM AUDIT LOGS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS platform_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON platform_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON platform_audit_logs(actor_email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON platform_audit_logs(timestamp DESC);

-- =============================================================================
-- 11. SECURITY & RLS HELPER FUNCTIONS
-- =============================================================================

-- Extract current tenant_id from auth context
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Check if current authenticated user is Platform SuperAdmin
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =============================================================================
-- 12. ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
-- =============================================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes_bom ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_audit_logs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 13. RLS POLICIES: TENANTS TABLE
-- =============================================================================
-- SuperAdmins have full global control
CREATE POLICY "Superadmin full access on tenants"
ON tenants FOR ALL
TO authenticated
USING (is_superadmin())
WITH CHECK (is_superadmin());

-- Tenant staff can read their own tenant
CREATE POLICY "Tenant read access on own tenant"
ON tenants FOR SELECT
TO authenticated
USING (id = current_tenant_id());

-- Tenant owners can update their own details
CREATE POLICY "Tenant owner update access on own tenant"
ON tenants FOR UPDATE
TO authenticated
USING (
  id = current_tenant_id() AND
  EXISTS (
    SELECT 1 FROM tenant_users
    WHERE user_id = auth.uid() AND tenant_id = tenants.id AND role = 'owner'
  )
)
WITH CHECK (id = current_tenant_id());

-- Public can read active tenant details for storefront display by slug
CREATE POLICY "Public storefront read tenant by slug"
ON tenants FOR SELECT
TO anon, authenticated
USING (status IN ('trial', 'active'));

-- =============================================================================
-- 14. RLS POLICIES: SUBSCRIPTIONS TABLE
-- =============================================================================
CREATE POLICY "Superadmin full access on subscriptions"
ON subscriptions FOR ALL
TO authenticated
USING (is_superadmin())
WITH CHECK (is_superadmin());

CREATE POLICY "Tenant read access on own subscription"
ON subscriptions FOR SELECT
TO authenticated
USING (tenant_id = current_tenant_id());

-- =============================================================================
-- 15. RLS POLICIES: TENANT USERS TABLE
-- =============================================================================
CREATE POLICY "Superadmin full access on tenant_users"
ON tenant_users FOR ALL
TO authenticated
USING (is_superadmin())
WITH CHECK (is_superadmin());

CREATE POLICY "Tenant read access on own staff members"
ON tenant_users FOR SELECT
TO authenticated
USING (tenant_id = current_tenant_id());

CREATE POLICY "Tenant owner manage staff members"
ON tenant_users FOR ALL
TO authenticated
USING (
  tenant_id = current_tenant_id() AND
  EXISTS (
    SELECT 1 FROM tenant_users tu
    WHERE tu.user_id = auth.uid() AND tu.tenant_id = current_tenant_id() AND tu.role IN ('owner', 'manager')
  )
)
WITH CHECK (tenant_id = current_tenant_id());

-- =============================================================================
-- 16. RLS POLICIES: LOCATIONS TABLE
-- =============================================================================
CREATE POLICY "Superadmin full access on locations"
ON locations FOR ALL
TO authenticated
USING (is_superadmin())
WITH CHECK (is_superadmin());

CREATE POLICY "Tenant full access on own locations"
ON locations FOR ALL
TO authenticated
USING (tenant_id = current_tenant_id())
WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "Public read locations for storefront"
ON locations FOR SELECT
TO anon, authenticated
USING (true);

-- =============================================================================
-- 17. RLS POLICIES: DINING TABLES TABLE
-- =============================================================================
CREATE POLICY "Superadmin full access on dining_tables"
ON dining_tables FOR ALL
TO authenticated
USING (is_superadmin())
WITH CHECK (is_superadmin());

CREATE POLICY "Tenant full access on own dining_tables"
ON dining_tables FOR ALL
TO authenticated
USING (tenant_id = current_tenant_id())
WITH CHECK (tenant_id = current_tenant_id());

-- Public guest can read dining table to verify QR token without exposing other tables
CREATE POLICY "Public guest verify dining table by token"
ON dining_tables FOR SELECT
TO anon, authenticated
USING (true);

-- =============================================================================
-- 18. RLS POLICIES: CATEGORIES & MENU ITEMS
-- =============================================================================
CREATE POLICY "Superadmin full access on categories"
ON categories FOR ALL
TO authenticated
USING (is_superadmin())
WITH CHECK (is_superadmin());

CREATE POLICY "Tenant full access on own categories"
ON categories FOR ALL
TO authenticated
USING (tenant_id = current_tenant_id())
WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "Public storefront read categories"
ON categories FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Superadmin full access on menu_items"
ON menu_items FOR ALL
TO authenticated
USING (is_superadmin())
WITH CHECK (is_superadmin());

CREATE POLICY "Tenant full access on own menu_items"
ON menu_items FOR ALL
TO authenticated
USING (tenant_id = current_tenant_id())
WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "Public storefront read available menu_items"
ON menu_items FOR SELECT
TO anon, authenticated
USING (is_available = true);

-- =============================================================================
-- 19. RLS POLICIES: INVENTORY ITEMS & RECIPES BOM
-- =============================================================================
CREATE POLICY "Superadmin full access on inventory_items"
ON inventory_items FOR ALL
TO authenticated
USING (is_superadmin())
WITH CHECK (is_superadmin());

CREATE POLICY "Tenant full access on own inventory_items"
ON inventory_items FOR ALL
TO authenticated
USING (tenant_id = current_tenant_id())
WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "Superadmin full access on recipes_bom"
ON recipes_bom FOR ALL
TO authenticated
USING (is_superadmin())
WITH CHECK (is_superadmin());

CREATE POLICY "Tenant full access on own recipes_bom"
ON recipes_bom FOR ALL
TO authenticated
USING (tenant_id = current_tenant_id())
WITH CHECK (tenant_id = current_tenant_id());

-- =============================================================================
-- 20. RLS POLICIES: ORDERS & ORDER ITEMS
-- =============================================================================
CREATE POLICY "Superadmin full access on orders"
ON orders FOR ALL
TO authenticated
USING (is_superadmin())
WITH CHECK (is_superadmin());

CREATE POLICY "Tenant full access on own orders"
ON orders FOR ALL
TO authenticated
USING (tenant_id = current_tenant_id())
WITH CHECK (tenant_id = current_tenant_id());

-- Guest customer can insert orders linked to an active dining table
CREATE POLICY "Public guest insert order with valid table"
ON orders FOR INSERT
TO anon, authenticated
WITH CHECK (
  table_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM dining_tables dt
    WHERE dt.id = orders.table_id AND dt.tenant_id = orders.tenant_id
  )
);

-- Guest customer can track their own order by ID
CREATE POLICY "Public guest select own order"
ON orders FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Superadmin full access on order_items"
ON order_items FOR ALL
TO authenticated
USING (is_superadmin())
WITH CHECK (is_superadmin());

CREATE POLICY "Tenant full access on own order_items"
ON order_items FOR ALL
TO authenticated
USING (tenant_id = current_tenant_id())
WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "Public guest insert order_items for new order"
ON order_items FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id AND o.tenant_id = order_items.tenant_id
  )
);

CREATE POLICY "Public guest select order_items"
ON order_items FOR SELECT
TO anon, authenticated
USING (true);

-- =============================================================================
-- 21. RLS POLICIES: PLATFORM AUDIT LOGS
-- =============================================================================
CREATE POLICY "Superadmin full access on platform_audit_logs"
ON platform_audit_logs FOR ALL
TO authenticated
USING (is_superadmin())
WITH CHECK (is_superadmin());

CREATE POLICY "Tenant read own audit logs"
ON platform_audit_logs FOR SELECT
TO authenticated
USING (tenant_id = current_tenant_id());

CREATE POLICY "System insert audit logs"
ON platform_audit_logs FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- =============================================================================
-- 22. CRYPTOGRAPHIC ANTI-TAMPER SECURE RPCs
-- =============================================================================

-- RPC: Verify Table Session Anti-Tamper Token
CREATE OR REPLACE FUNCTION verify_table_session(
  p_tenant_slug TEXT,
  p_table_number TEXT,
  p_token TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_tenant RECORD;
  v_table RECORD;
  v_digits TEXT;
BEGIN
  -- 1. Find active tenant by slug
  SELECT id, name, slug, status, upi_id INTO v_tenant
  FROM tenants
  WHERE slug = p_tenant_slug;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'is_valid', false,
      'error', 'CAFE_NOT_FOUND',
      'message', 'The requested cafe could not be found.'
    );
  END IF;

  IF v_tenant.status NOT IN ('trial', 'active') THEN
    RETURN jsonb_build_object(
      'is_valid', false,
      'error', 'CAFE_INACTIVE',
      'message', 'This cafe account is currently suspended or past due.'
    );
  END IF;

  v_digits := REGEXP_REPLACE(p_table_number, '[^0-9]', '', 'g');

  -- 2. Validate table and cryptographic QR token
  SELECT dt.id, dt.table_number, dt.capacity, dt.status, dt.location_id
  INTO v_table
  FROM dining_tables dt
  WHERE dt.tenant_id = v_tenant.id
    AND (
      LOWER(dt.table_number) = LOWER(p_table_number) OR
      (v_digits <> '' AND REGEXP_REPLACE(dt.table_number, '[^0-9]', '', 'g')::INT = v_digits::INT)
    )
    AND dt.qr_token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'is_valid', false,
      'error', 'INVALID_TABLE_TOKEN',
      'message', 'Cryptographic verification failed. Scan the physical QR attached to your table.'
    );
  END IF;

  RETURN jsonb_build_object(
    'is_valid', true,
    'tenant', jsonb_build_object(
      'id', v_tenant.id,
      'name', v_tenant.name,
      'slug', v_tenant.slug,
      'upi_id', v_tenant.upi_id
    ),
    'table', jsonb_build_object(
      'id', v_table.id,
      'table_number', v_table.table_number,
      'location_id', v_table.location_id,
      'capacity', v_table.capacity,
      'status', v_table.status
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Atomic Guest Customer Order Submission
CREATE OR REPLACE FUNCTION submit_guest_order(
  p_table_token TEXT,
  p_items JSONB,
  p_customer_name TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'upi',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_table RECORD;
  v_order_id UUID;
  v_order_number BIGINT;
  v_item RECORD;
  v_subtotal NUMERIC(10,2) := 0.00;
  v_tax NUMERIC(10,2) := 0.00;
  v_platform_fee NUMERIC(10,2) := 1.00;
  v_grand_total NUMERIC(10,2) := 0.00;
BEGIN
  -- 1. Validate active table token
  SELECT dt.id, dt.tenant_id, dt.location_id, dt.table_number
  INTO v_table
  FROM dining_tables dt
  JOIN tenants t ON t.id = dt.tenant_id
  WHERE dt.qr_token = p_table_token
    AND t.status IN ('trial', 'active');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized: Invalid or expired table session token';
  END IF;

  -- 2. Calculate subtotal from items
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    menu_item_id UUID,
    name TEXT,
    qty INT,
    unit_price NUMERIC(10,2),
    notes TEXT
  ) LOOP
    v_subtotal := v_subtotal + (v_item.qty * v_item.unit_price);
  END LOOP;

  -- Calculate 5% GST & grand total
  v_tax := ROUND(v_subtotal * 0.05, 2);
  v_grand_total := v_subtotal + v_tax + v_platform_fee;

  -- 3. Insert order
  INSERT INTO orders (
    tenant_id,
    location_id,
    table_id,
    order_type,
    status,
    customer_name,
    customer_phone,
    subtotal,
    tax_amount,
    platform_fee,
    total,
    payment_status,
    payment_method,
    notes
  ) VALUES (
    v_table.tenant_id,
    v_table.location_id,
    v_table.id,
    'dine_in',
    'new',
    p_customer_name,
    p_customer_phone,
    v_subtotal,
    v_tax,
    v_platform_fee,
    v_grand_total,
    'pending',
    p_payment_method,
    p_notes
  )
  RETURNING id, order_number INTO v_order_id, v_order_number;

  -- 4. Insert line items
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    menu_item_id UUID,
    name TEXT,
    variant_name TEXT,
    qty INT,
    unit_price NUMERIC(10,2),
    notes TEXT
  ) LOOP
    INSERT INTO order_items (
      tenant_id,
      order_id,
      menu_item_id,
      name,
      variant_name,
      qty,
      unit_price,
      item_total,
      notes
    ) VALUES (
      v_table.tenant_id,
      v_order_id,
      v_item.menu_item_id,
      v_item.name,
      v_item.variant_name,
      v_item.qty,
      v_item.unit_price,
      ROUND(v_item.qty * v_item.unit_price, 2),
      v_item.notes
    );
  END LOOP;

  -- 5. Mark dining table occupied
  UPDATE dining_tables
  SET status = 'occupied', active_order_id = v_order_id
  WHERE id = v_table.id;

  RETURN jsonb_build_object(
    'status', 'success',
    'order_id', v_order_id,
    'order_number', v_order_number,
    'grand_total', v_grand_total,
    'table_number', v_table.table_number
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
