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
$function$
