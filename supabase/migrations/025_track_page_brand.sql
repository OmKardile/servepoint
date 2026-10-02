-- 025 · Track-page café brand (v5.28.0 · Task 66)
-- The guest's ticket page learns whose ticket it is. sp_get_public_order —
-- the /track/:orderId projection — now joins the order's tenant and returns
-- a sibling 'tenant' payload ({name, logo_url}) next to 'order'. The track
-- header shows the café's NAME on every ticket, and the logo tile when the
-- owner set one in Settings → Café brand (migration 024). Honest absence:
-- NULL logo renders the name-only header — never a broken image; a NOT_FOUND
-- order never leaks a tenant.
--
-- Read-only: no new grants needed (CREATE OR REPLACE keeps 012's EXECUTE on
-- anon/authenticated), no RLS change (SECURITY DEFINER body only, same
-- signature → replaced in place, not overloded), no column changes. Body is
-- 012's byte-for-byte except: the tenants join, the two tenant SELECT arms,
-- and the 'tenant' payload key.

CREATE OR REPLACE FUNCTION public.sp_get_public_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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
         tn.name AS tenant_name, tn.logo_url AS tenant_logo_url
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
      'logo_url', v_order.tenant_logo_url
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
$fn$;

-- ── Verification (runs at migration time) ──────────────────────────────────
DO $$
DECLARE
  v_keys TEXT;
  v_order_id UUID;
BEGIN
  SELECT id INTO v_order_id FROM orders ORDER BY created_at DESC LIMIT 1;
  IF v_order_id IS NOT NULL THEN
    SELECT string_agg(k, ',' ORDER BY k) INTO v_keys
      FROM (SELECT jsonb_object_keys(public.sp_get_public_order(v_order_id)) AS k) s;
    IF v_keys IS NULL OR position('order' in v_keys) = 0 OR position('tenant' in v_keys) = 0 THEN
      RAISE EXCEPTION '025 verification failed: payload keys = %', v_keys;
    END IF;
  END IF;
END $$;
