-- =============================================================================
-- ServePoint (TSOS) — MIGRATION 012: MENU VARIANTS & ADD-ONS + GUEST QR ORDERING
-- =============================================================================
-- The main flow completes here. Three jobs:
--
--   A. Menu depth (owner request: "create menu item with variants or addons"):
--      menu_variants (per-item price deltas), addons (tenant-level library),
--      menu_item_addons (which add-ons an item offers),
--      order_item_addons (name+price snapshots on tickets so bills/KDS never
--      depend on live menu rows).
--
--   B. Guest capability columns: orders.client_operation_id + a per-tenant
--      partial unique index → replaying a checkout intent can never
--      double-order (the server replays the first result instead).
--
--   C. Guest QR path — SECURITY DEFINER RPCs only; the anon key can read
--      nothing directly (same discipline as the rest of the schema):
--        sp_resolve_table_qr(token)        → QR gate: tenant + table identity
--        sp_get_public_menu(slug)          → live menu bundle (available only)
--        sp_create_public_order(...)       → server-recomputed, idempotent order
--        sp_get_public_order(order_id)     → guest tracking pager projection
--      Table sessions keep using 002's issue_ephemeral_table_session /
--      verify_and_consume_table_session (the permanent qr_token + the
--      ephemeral session token are separate capabilities by design).
-- =============================================================================

-- ── A1. menu_variants — per-item options with a price delta ────────────────
CREATE TABLE IF NOT EXISTS menu_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_delta NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_menu_variants_item ON menu_variants(menu_item_id);

-- ── A2. addons — tenant-level library of extras ────────────────────────────
CREATE TABLE IF NOT EXISTS addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_addons_tenant ON addons(tenant_id);

-- ── A3. menu_item_addons — which extras an item offers ─────────────────────
CREATE TABLE IF NOT EXISTS menu_item_addons (
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  addon_id UUID NOT NULL REFERENCES addons(id) ON DELETE CASCADE,
  PRIMARY KEY (menu_item_id, addon_id)
);
CREATE INDEX IF NOT EXISTS idx_menu_item_addons_item ON menu_item_addons(menu_item_id);

-- ── A4. order_item_addons — ticket snapshots (name + price frozen at order) ─
CREATE TABLE IF NOT EXISTS order_item_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  addon_id UUID REFERENCES addons(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_item_addons_item ON order_item_addons(order_item_id);

-- ── A5. RLS — same two-policy shape as dining_tables (001) ─────────────────
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['menu_variants', 'addons', 'order_item_addons'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($f$
      CREATE POLICY "Superadmin full access on %I"
      ON %I FOR ALL TO authenticated
      USING (is_superadmin())
      WITH CHECK (is_superadmin())
    $f$, t, t);
    EXECUTE format($f$
      CREATE POLICY "Tenant full access on own %I"
      ON %I FOR ALL TO authenticated
      USING (tenant_id = current_tenant_id())
      WITH CHECK (tenant_id = current_tenant_id())
    $f$, t, t);
  END LOOP;
END $$;

ALTER TABLE menu_item_addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmin full access on menu_item_addons"
ON menu_item_addons FOR ALL TO authenticated
USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY "Tenant manage own menu_item_addons"
ON menu_item_addons FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM menu_items mi
          WHERE mi.id = menu_item_addons.menu_item_id
            AND mi.tenant_id = current_tenant_id())
  AND EXISTS (SELECT 1 FROM addons a
          WHERE a.id = menu_item_addons.addon_id
            AND a.tenant_id = current_tenant_id())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM menu_items mi
          WHERE mi.id = menu_item_addons.menu_item_id
            AND mi.tenant_id = current_tenant_id())
  AND EXISTS (SELECT 1 FROM addons a
          WHERE a.id = menu_item_addons.addon_id
            AND a.tenant_id = current_tenant_id())
);

-- Guests never read menu tables directly — they use sp_get_public_menu below.

-- ── B. Guest checkout idempotency ──────────────────────────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_operation_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_client_operation
ON orders(tenant_id, client_operation_id)
WHERE client_operation_id IS NOT NULL;

-- ── C1. QR gate — resolve the permanent table token to tenant + table ──────
CREATE OR REPLACE FUNCTION sp_resolve_table_qr(p_qr_token TEXT)
RETURNS JSONB AS $$
DECLARE
  v_row RECORD;
BEGIN
  IF p_qr_token IS NULL OR length(trim(p_qr_token)) < 8 THEN
    RETURN jsonb_build_object('is_valid', false, 'error', 'INVALID_TOKEN',
      'message', 'This table code is not valid. Scan the QR sticker on your table.');
  END IF;

  SELECT dt.id AS table_id, dt.table_number, dt.capacity, dt.section, dt.status,
         t.id AS tenant_id, t.name AS tenant_name, t.slug
  INTO v_row
  FROM dining_tables dt
  JOIN tenants t ON t.id = dt.tenant_id
  WHERE dt.qr_token = trim(p_qr_token);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('is_valid', false, 'error', 'INVALID_TOKEN',
      'message', 'This table code is not valid. Scan the QR sticker on your table.');
  END IF;

  IF v_row.section IS NULL OR v_row.status NOT IN ('available','occupied','reserved','billing') THEN
    RETURN jsonb_build_object('is_valid', false, 'error', 'TABLE_INACTIVE',
      'message', 'This table is not taking orders right now. Please ask our staff.');
  END IF;

  RETURN jsonb_build_object(
    'is_valid', true,
    'tenant', jsonb_build_object('id', v_row.tenant_id, 'name', v_row.tenant_name, 'slug', v_row.slug),
    'table',  jsonb_build_object('id', v_row.table_id, 'table_number', v_row.table_number,
                                 'capacity', v_row.capacity, 'section', v_row.section)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── C2. Public menu bundle — the ONLY door guests get to the menu ──────────
CREATE OR REPLACE FUNCTION sp_get_public_menu(p_slug TEXT)
RETURNS JSONB AS $$
DECLARE
  v_tenant RECORD;
  v_menu JSONB;
BEGIN
  SELECT id, name, slug, status INTO v_tenant
  FROM tenants WHERE slug = lower(trim(p_slug));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('is_valid', false, 'error', 'CAFE_NOT_FOUND',
      'message', 'We could not find this cafe.');
  END IF;

  IF v_tenant.status NOT IN ('trial', 'active') THEN
    RETURN jsonb_build_object('is_valid', false, 'error', 'CAFE_INACTIVE',
      'message', 'This cafe is not taking orders right now.');
  END IF;

  SELECT jsonb_agg(
           jsonb_build_object(
             'id', c.id, 'name', c.name, 'sort_order', c.sort_order,
             'items', COALESCE((
               SELECT jsonb_agg(
                        jsonb_build_object(
                          'id', mi.id, 'name', mi.name, 'description', mi.description,
                          'price', mi.price, 'image_url', mi.image_url, 'is_veg', mi.is_veg,
                          'variants', COALESCE((
                            SELECT jsonb_agg(jsonb_build_object(
                              'id', mv.id, 'name', mv.name, 'price_delta', mv.price_delta)
                              ORDER BY mv.sort_order, mv.created_at)
                            FROM menu_variants mv WHERE mv.menu_item_id = mi.id), '[]'::jsonb),
                          'addons', COALESCE((
                            SELECT jsonb_agg(jsonb_build_object(
                              'id', a.id, 'name', a.name, 'price', a.price)
                              ORDER BY a.name)
                            FROM menu_item_addons mia
                            JOIN addons a ON a.id = mia.addon_id
                            WHERE mia.menu_item_id = mi.id), '[]'::jsonb)
                        ) ORDER BY mi.created_at)
               FROM menu_items mi
               WHERE mi.tenant_id = v_tenant.id
                 AND mi.is_available = true
                 AND mi.category_id = c.id), '[]'::jsonb)
           ) ORDER BY c.sort_order, c.created_at)
  INTO v_menu
  FROM categories c
  WHERE c.tenant_id = v_tenant.id;

  RETURN jsonb_build_object(
    'is_valid', true,
    'tenant', jsonb_build_object('id', v_tenant.id, 'name', v_tenant.name, 'slug', v_tenant.slug),
    'categories', COALESCE(v_menu, '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── C3. Guest order creation — server recomputes every rupee ───────────────
-- p_items: [{"menu_item_id","variant_id"(opt),"qty","notes"(opt),"addon_ids":[..]}]
-- Prices come ONLY from menu_items/menu_variants/addons — the client never
-- names a price. Idempotent per (tenant_id, client_operation_id).
CREATE OR REPLACE FUNCTION sp_create_public_order(
  p_qr_token TEXT,
  p_table_number TEXT DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::jsonb,
  p_order_type TEXT DEFAULT 'dine_in',
  p_customer_name TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_client_operation_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_table RECORD;
  v_existing RECORD;
  v_item JSONB;
  v_menu RECORD;
  v_variant RECORD;
  v_addon_id TEXT;
  v_addon RECORD;
  v_allowed BOOLEAN;
  v_unit_price NUMERIC(10,2);
  v_line_total NUMERIC(10,2);
  v_subtotal NUMERIC(10,2) := 0;
  v_tax NUMERIC(10,2);
  v_total NUMERIC(10,2);
  v_order_id UUID;
  v_order_no BIGINT;
  v_order_item_id UUID;
  v_ctx_notes TEXT;
  v_variant_name TEXT;
  v_n INT := 0;
BEGIN
  -- 1. Resolve the table by its PERMANENT token (never trust the client's table id)
  SELECT dt.id AS table_id, dt.table_number, dt.location_id, dt.tenant_id,
         t.name AS tenant_name, t.status AS tenant_status
  INTO v_table
  FROM dining_tables dt JOIN tenants t ON t.id = dt.tenant_id
  WHERE dt.qr_token = trim(coalesce(p_qr_token, ''));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('is_valid', false, 'error', 'INVALID_TOKEN',
      'message', 'Scan the QR sticker on your table to order.');
  END IF;

  IF v_table.tenant_status NOT IN ('trial', 'active') THEN
    RETURN jsonb_build_object('is_valid', false, 'error', 'CAFE_INACTIVE',
      'message', 'This cafe is not taking orders right now.');
  END IF;

  IF p_table_number IS NOT NULL AND lower(trim(p_table_number)) <> lower(v_table.table_number) THEN
    RETURN jsonb_build_object('is_valid', false, 'error', 'TABLE_MISMATCH',
      'message', 'This link belongs to another table. Scan the sticker on your table.');
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('is_valid', false, 'error', 'EMPTY_ORDER',
      'message', 'Add something to your order first.');
  END IF;

  -- 2. Idempotent replay — same checkout intent returns the original order
  IF p_client_operation_id IS NOT NULL AND length(trim(p_client_operation_id)) > 0 THEN
    SELECT id, order_number, total, status, payment_status
    INTO v_existing
    FROM orders
    WHERE tenant_id = v_table.tenant_id
      AND client_operation_id = trim(p_client_operation_id)
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('is_valid', true, 'duplicate', true,
        'order', jsonb_build_object('id', v_existing.id, 'order_number', v_existing.order_number,
          'total', v_existing.total, 'status', v_existing.status,
          'payment_status', v_existing.payment_status, 'table_number', v_table.table_number));
    END IF;
  END IF;

  -- 3. Price every line from the LIVE menu (identity-only payload from the guest)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_n := v_n + 1;
    IF v_n > 40 THEN
      RETURN jsonb_build_object('is_valid', false, 'error', 'TOO_MANY_LINES',
        'message', 'Too many lines on one order — please split it.');
    END IF;

    SELECT name, price, is_available INTO v_menu
    FROM menu_items
    WHERE id = (v_item->>'menu_item_id')::uuid AND tenant_id = v_table.tenant_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('is_valid', false, 'error', 'ITEM_UNAVAILABLE',
        'message', 'Something on your order is no longer on the menu. Please refresh.');
    END IF;
    IF NOT v_menu.is_available THEN
      RETURN jsonb_build_object('is_valid', false, 'error', 'ITEM_UNAVAILABLE',
        'message', v_menu.name || ' just sold out. Please refresh your order.');
    END IF;

    v_unit_price := v_menu.price;

    IF v_item->>'variant_id' IS NOT NULL THEN
      SELECT name, price_delta INTO v_variant
      FROM menu_variants
      WHERE id = (v_item->>'variant_id')::uuid AND menu_item_id = (v_item->>'menu_item_id')::uuid;
      IF NOT FOUND THEN
        RETURN jsonb_build_object('is_valid', false, 'error', 'ITEM_UNAVAILABLE',
          'message', 'A chosen option is no longer offered. Please refresh.');
      END IF;
      v_unit_price := v_unit_price + COALESCE(v_variant.price_delta, 0);
    END IF;

    IF v_item->'addon_ids' IS NOT NULL AND jsonb_typeof(v_item->'addon_ids') = 'array' THEN
      FOREACH v_addon_id IN ARRAY ARRAY(
        SELECT jsonb_array_elements_text(v_item->'addon_ids')
      ) LOOP
        SELECT a.name, a.price, (EXISTS (
          SELECT 1 FROM menu_item_addons mia
          WHERE mia.menu_item_id = (v_item->>'menu_item_id')::uuid
            AND mia.addon_id = a.id)) AS allowed
        INTO v_addon
        FROM addons a
        WHERE a.id = (v_addon_id)::uuid AND a.tenant_id = v_table.tenant_id;
        IF NOT FOUND OR NOT v_addon.allowed THEN
          RETURN jsonb_build_object('is_valid', false, 'error', 'ADDON_UNAVAILABLE',
            'message', 'An extra on your order is no longer offered. Please refresh.');
        END IF;
        v_unit_price := v_unit_price + v_addon.price;
      END LOOP;
    END IF;

    IF COALESCE((v_item->>'qty')::int, 0) < 1 OR (v_item->>'qty')::int > 50 THEN
      RETURN jsonb_build_object('is_valid', false, 'error', 'BAD_QTY',
        'message', 'Quantity must be between 1 and 50.');
    END IF;

    v_line_total := round(v_unit_price * (v_item->>'qty')::int, 2);
    v_subtotal := v_subtotal + v_line_total;
  END LOOP;

  v_tax := round(v_subtotal * 0.05, 2);  -- GST 5% — matches the counter flow
  v_total := round(v_subtotal + v_tax, 2);

  v_ctx_notes := trim(concat_ws(' · ',
    nullif(trim(coalesce(p_notes, '')), ''),
    'via QR · Table ' || v_table.table_number));

  -- 4. Insert the ticket (status 'new' — the counter Oks it to the kitchen)
  INSERT INTO orders (tenant_id, location_id, table_id, order_type, status,
                      customer_name, subtotal, tax_amount, total,
                      payment_status, notes, client_operation_id)
  VALUES (v_table.tenant_id, v_table.location_id, v_table.table_id,
          'dine_in', 'new',
          nullif(trim(coalesce(p_customer_name, '')), ''),
          v_subtotal, v_tax, v_total, 'pending',
          nullif(v_ctx_notes, ''), nullif(trim(coalesce(p_client_operation_id, '')), ''))
  RETURNING id, order_number INTO v_order_id, v_order_no;

  -- 5. Snapshot items + add-ons (bills never depend on live menu rows)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT name, price INTO v_menu
    FROM menu_items WHERE id = (v_item->>'menu_item_id')::uuid;

    v_unit_price := v_menu.price;
    v_variant_name := NULL;
    IF v_item->>'variant_id' IS NOT NULL THEN
      SELECT name, price_delta INTO v_variant
      FROM menu_variants
      WHERE id = (v_item->>'variant_id')::uuid AND menu_item_id = (v_item->>'menu_item_id')::uuid;
      IF FOUND THEN
        v_variant_name := v_variant.name;
        v_unit_price := v_unit_price + COALESCE(v_variant.price_delta, 0);
      END IF;
    END IF;

    -- add-on prices join the unit price BEFORE the snapshot insert
    IF v_item->'addon_ids' IS NOT NULL AND jsonb_typeof(v_item->'addon_ids') = 'array' THEN
      FOREACH v_addon_id IN ARRAY ARRAY(
        SELECT jsonb_array_elements_text(v_item->'addon_ids')
      ) LOOP
        SELECT a.name, a.price INTO v_addon FROM addons a
        WHERE a.id = (v_addon_id)::uuid;
        v_unit_price := v_unit_price + v_addon.price;
      END LOOP;
    END IF;

    INSERT INTO order_items (tenant_id, order_id, menu_item_id, name, variant_name,
                             qty, unit_price, item_total, notes)
    VALUES (v_table.tenant_id, v_order_id, (v_item->>'menu_item_id')::uuid,
            v_menu.name, v_variant_name,
            (v_item->>'qty')::int, v_unit_price,
            round(v_unit_price * (v_item->>'qty')::int, 2),
            nullif(trim(coalesce(v_item->>'notes', '')), ''))
    RETURNING id INTO v_order_item_id;

    IF v_item->'addon_ids' IS NOT NULL AND jsonb_typeof(v_item->'addon_ids') = 'array' THEN
      FOREACH v_addon_id IN ARRAY ARRAY(
        SELECT jsonb_array_elements_text(v_item->'addon_ids')
      ) LOOP
        SELECT a.name, a.price INTO v_addon FROM addons a
        WHERE a.id = (v_addon_id)::uuid;
        INSERT INTO order_item_addons (tenant_id, order_item_id, addon_id, name, price)
        VALUES (v_table.tenant_id, v_order_item_id, (v_addon_id)::uuid, v_addon.name, v_addon.price);
      END LOOP;
    END IF;
  END LOOP;

  -- 6. The 011 trigger (trg_orders_sync_table) has already held the table.
  RETURN jsonb_build_object('is_valid', true, 'duplicate', false,
    'order', jsonb_build_object('id', v_order_id, 'order_number', v_order_no,
      'total', v_total, 'table_number', v_table.table_number, 'status', 'new',
      'payment_status', 'pending'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── C4. Guest tracking pager — order UUID is the capability ────────────────
CREATE OR REPLACE FUNCTION sp_get_public_order(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
BEGIN
  IF p_order_id IS NULL THEN
    RETURN jsonb_build_object('is_valid', false, 'error', 'NOT_FOUND',
      'message', 'This order link is not valid.');
  END IF;

  SELECT o.id, o.order_number, o.order_type, o.status, o.payment_status,
         o.payment_method, o.subtotal, o.tax_amount, o.total,
         o.customer_name, o.notes, o.created_at, o.updated_at,
         dt.table_number
  INTO v_order
  FROM orders o
  LEFT JOIN dining_tables dt ON dt.id = o.table_id
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('is_valid', false, 'error', 'NOT_FOUND',
      'message', 'This order link is not valid.');
  END IF;

  RETURN jsonb_build_object(
    'is_valid', true,
    'order', jsonb_build_object(
      'id', v_order.id, 'order_number', v_order.order_number,
      'order_type', v_order.order_type, 'status', v_order.status,
      'payment_status', v_order.payment_status, 'payment_method', v_order.payment_method,
      'subtotal', v_order.subtotal, 'tax_amount', v_order.tax_amount, 'total', v_order.total,
      'customer_name', v_order.customer_name, 'notes', v_order.notes,
      'table_number', v_order.table_number,
      'created_at', v_order.created_at, 'updated_at', v_order.updated_at,
      'items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'name', oi.name, 'variant_name', oi.variant_name, 'qty', oi.qty,
                 'unit_price', oi.unit_price, 'item_total', oi.item_total, 'notes', oi.notes,
                 'addons', COALESCE((
                   SELECT jsonb_agg(jsonb_build_object('name', oia.name, 'price', oia.price)
                     ORDER BY oia.name)
                   FROM order_item_addons oia WHERE oia.order_item_id = oi.id), '[]'::jsonb))
               ORDER BY oi.created_at)
        FROM order_items oi WHERE oi.order_id = v_order.id), '[]'::jsonb)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── Verification ───────────────────────────────────────────────────────────
DO $$
DECLARE
  v_tables INT;
  v_fns INT;
  v_col INT;
  v_idx INT;
BEGIN
  SELECT count(*) INTO v_tables FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('menu_variants', 'addons', 'menu_item_addons', 'order_item_addons');

  SELECT count(*) INTO v_fns FROM pg_proc
  WHERE pronamespace = 'public'::regnamespace
    AND proname IN ('sp_resolve_table_qr', 'sp_get_public_menu', 'sp_create_public_order', 'sp_get_public_order');

  SELECT count(*) INTO v_col FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'client_operation_id';

  SELECT count(*) INTO v_idx FROM pg_indexes
  WHERE schemaname = 'public' AND indexname = 'uq_orders_client_operation';

  IF v_tables <> 4 OR v_fns <> 4 OR v_col <> 1 OR v_idx <> 1 THEN
    RAISE EXCEPTION 'Migration 012 verification failed: tables=% (want 4), fns=% (want 4), col=% (want 1), idx=% (want 1)',
      v_tables, v_fns, v_col, v_idx;
  END IF;
END $$;

-- Final state: 001→012. The main flow is whole: menu with variants/addons,
-- counter orders, guest QR orders, KDS, payments, floor automation.
