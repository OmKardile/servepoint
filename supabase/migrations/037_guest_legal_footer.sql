-- ============================================================================
-- 037_guest_legal_footer.sql — the guest sees the licence
--
-- Task 90 gave the owner a place to TYPE the legal identity (Settings →
-- Business profile: legal_name / gst_number / fssai_number) and a printed
-- bill that carries it. But the two guest-facing surfaces — the QR menu
-- and the track page — still never show it. In India the FSSAI licence
-- number on a menu is a trust marker guests (and aggregators like Swiggy/
-- Zomato) expect to find, and the GSTIN belongs beside it.
--
-- This migration extends the TWO public RPCs so the payload carries the
-- café's legal identity alongside its brand:
--   · sp_get_public_menu  (024) — tenant object += legal_name, gst_number,
--     fssai_number
--   · sp_get_public_order (025) — tenant object += the same three
--
-- Everything else in both functions is byte-for-byte the live definition
-- (dumped via pg_get_functiondef before editing — no drift, no surprises).
-- Honest absence is preserved: fields the owner never set stay NULL and
-- the guest footer simply doesn't render a licence line.
-- ============================================================================

-- ── A. sp_get_public_menu — same body as live (024 lineage), +3 fields ─────
CREATE OR REPLACE FUNCTION public.sp_get_public_menu(p_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant RECORD;
  v_menu JSONB;
BEGIN
  SELECT id, name, slug, status, logo_url,
         legal_name, gst_number, fssai_number INTO v_tenant
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
    'tenant', jsonb_build_object('id', v_tenant.id, 'name', v_tenant.name, 'slug', v_tenant.slug,
                                 'logo_url', v_tenant.logo_url,
                                 'legal_name', v_tenant.legal_name,
                                 'gst_number', v_tenant.gst_number,
                                 'fssai_number', v_tenant.fssai_number),
    'categories', COALESCE(v_menu, '[]'::jsonb)
  );
END;
$function$;

-- ── B. sp_get_public_order — same body as live (025 lineage), +3 fields ────
CREATE OR REPLACE FUNCTION public.sp_get_public_order(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
         dt.table_number,
         tn.name AS tenant_name, tn.logo_url AS tenant_logo_url,
         tn.legal_name AS tenant_legal_name, tn.gst_number AS tenant_gst_number,
         tn.fssai_number AS tenant_fssai_number
  INTO v_order
  FROM orders o
  LEFT JOIN dining_tables dt ON dt.id = o.table_id
  LEFT JOIN tenants tn ON tn.id = o.tenant_id
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('is_valid', false, 'error', 'NOT_FOUND',
      'message', 'This order link is not valid.');
  END IF;

  RETURN jsonb_build_object(
    'is_valid', true,
    'tenant', jsonb_build_object(
      'name', v_order.tenant_name,
      'logo_url', v_order.tenant_logo_url,
      'legal_name', v_order.tenant_legal_name,
      'gst_number', v_order.tenant_gst_number,
      'fssai_number', v_order.tenant_fssai_number
    ),
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
$function$;
