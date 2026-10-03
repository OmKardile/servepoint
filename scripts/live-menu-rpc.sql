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
  SELECT id, name, slug, status, logo_url INTO v_tenant
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
                                 'logo_url', v_tenant.logo_url),
    'categories', COALESCE(v_menu, '[]'::jsonb)
  );
END;
$function$
