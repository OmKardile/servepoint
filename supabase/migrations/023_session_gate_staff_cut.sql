-- ═════════════════════════════════════════════════════════════════════════════
-- ServePoint MIGRATION 023: SESSION GATE + STAFF CUT  (Task 62, v5.24.0)
-- ═════════════════════════════════════════════════════════════════════════════
-- The ephemeral 10-minute table session finally gets teeth:
--
--   1. sp_verify_table_session(token) — tiny SECURITY DEFINER read for the
--      guest ribbon's 30s re-verify poll (002's RLS hides table_sessions
--      from anon). Also converges the status column toward the clock on
--      natural expiry (same hygiene as 002's own verify RPC).
--
--   2. sp_create_public_order grows an OPTIONAL p_session_token (DEFAULT
--      NULL): when a token IS presented it must be alive — active status,
--      matching table, unexpired clock, else SESSION_CLOSED. NULL proceeds
--      exactly as 017/022 did, so the printed QR stays the table's ordering
--      capability (012's 'separate capabilities' design is preserved, not
--      replaced). What the staff cut achieves honestly: it kills the
--      PRESENTED window (guest's open menu locks, token dies for orders).
--      It does NOT lock the table — a fresh scan of the printed sticker
--      reopens. Old overload dropped; one 9-arg overload remains, grants
--      unchanged (anon + authenticated).
--
-- Body otherwise identical to 022 (offer-title fix included).
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. The ribbon's re-verify RPC (anon-callable, SECURITY DEFINER) ─────────
CREATE OR REPLACE FUNCTION sp_verify_table_session(p_session_token TEXT)
RETURNS JSONB AS $$
DECLARE
  v_session RECORD;
BEGIN
  IF p_session_token IS NULL OR length(trim(p_session_token)) = 0 THEN
    RETURN jsonb_build_object('is_valid', false, 'reason', 'missing');
  END IF;

  SELECT ts.status, ts.expires_at
    INTO v_session
    FROM table_sessions ts
   WHERE ts.session_token = trim(p_session_token);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('is_valid', false, 'reason', 'unknown');
  END IF;
  IF v_session.status <> 'active' THEN
    RETURN jsonb_build_object('is_valid', false, 'reason', v_session.status);
  END IF;
  IF v_session.expires_at <= now() THEN
    UPDATE table_sessions SET status = 'expired'
     WHERE session_token = trim(p_session_token) AND status = 'active';
    RETURN jsonb_build_object('is_valid', false, 'reason', 'expired');
  END IF;
  RETURN jsonb_build_object('is_valid', true, 'reason', 'live',
    'remaining_seconds', GREATEST(0, EXTRACT(epoch FROM (v_session.expires_at - now()))::INT));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── 2. The order RPC: drop old overloads, recreate with the optional gate ───
DROP FUNCTION IF EXISTS sp_create_public_order(TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS sp_create_public_order(TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION sp_create_public_order(
  p_qr_token TEXT,
  p_table_number TEXT DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::jsonb,
  p_order_type TEXT DEFAULT 'dine_in',
  p_customer_name TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_client_operation_id TEXT DEFAULT NULL,
  p_offer_id UUID DEFAULT NULL,
  p_session_token TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_table RECORD;
  v_existing RECORD;
  v_session RECORD;
  v_item JSONB;
  v_menu RECORD;
  v_variant RECORD;
  v_addon_id TEXT;
  v_addon RECORD;
  v_allowed BOOLEAN;
  v_unit_price NUMERIC(10,2);
  v_line_total NUMERIC(10,2);
  v_subtotal NUMERIC(10,2) := 0;
  v_offer RECORD;
  v_offer_title TEXT;
  v_discount NUMERIC(10,2) := 0;
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

  -- 1.5 Session gate (023) — 002's design intent, finally wired: if the guest
  --     PRESENTS an ephemeral session token, that token must be alive. No token
  --     at all = proceed exactly as before (the printed QR remains the table's
  --     ordering capability; see 012's 'separate capabilities' note).
  IF p_session_token IS NOT NULL AND length(trim(p_session_token)) > 0 THEN
    SELECT ts.id, ts.status, ts.expires_at, ts.table_id
      INTO v_session
      FROM table_sessions ts
     WHERE ts.session_token = trim(p_session_token);
    IF NOT FOUND THEN
      RETURN jsonb_build_object('is_valid', false, 'error', 'SESSION_CLOSED', 'reason', 'unknown',
        'message', 'Your table session could not be verified. Scan the table QR to continue.');
    END IF;
    IF v_session.table_id <> v_table.table_id THEN
      RETURN jsonb_build_object('is_valid', false, 'error', 'SESSION_CLOSED', 'reason', 'table_mismatch',
        'message', 'This session belongs to another table. Scan the sticker on your table.');
    END IF;
    IF v_session.status <> 'active' THEN
      RETURN jsonb_build_object('is_valid', false, 'error', 'SESSION_CLOSED', 'reason', v_session.status,
        'message', 'This session is no longer open. Scan the table QR to continue.');
    END IF;
    IF v_session.expires_at <= now() THEN
      UPDATE table_sessions SET status = 'expired'
       WHERE id = v_session.id AND status = 'active';
      RETURN jsonb_build_object('is_valid', false, 'error', 'SESSION_CLOSED', 'reason', 'expired',
        'message', 'Your 10-minute table session ended. Scan the table QR to continue.');
    END IF;
    -- the order itself is the strongest activity signal the trail can show
    UPDATE table_sessions SET last_activity_at = now() WHERE id = v_session.id;
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('is_valid', false, 'error', 'EMPTY_ORDER',
      'message', 'Add something to your order first.');
  END IF;

  -- 2. Idempotent replay — same checkout intent returns the original order
  IF p_client_operation_id IS NOT NULL AND length(trim(p_client_operation_id)) > 0 THEN
    SELECT id, order_number, total, status, payment_status, discount_amount
    INTO v_existing
    FROM orders
    WHERE tenant_id = v_table.tenant_id
      AND client_operation_id = trim(p_client_operation_id)
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('is_valid', true, 'duplicate', true,
        'order', jsonb_build_object('id', v_existing.id, 'order_number', v_existing.order_number,
          'total', v_existing.total, 'status', v_existing.status,
          'payment_status', v_existing.payment_status, 'table_number', v_table.table_number,
          'discount_amount', v_existing.discount_amount,
          'offer_title', (SELECT of.title FROM offer_redemptions r
                          JOIN offers of ON of.id = r.offer_id
                          WHERE r.order_id = v_existing.id LIMIT 1)));
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

  -- 3b. The offer — re-validated server-side against the RECOMPUTED subtotal
  --     (the guest's device never gets to price its own discount).
  --     022: the title rides out in v_offer_title so the final RETURN can
  --     never touch the unassigned v_offer record on offerless checkouts.
  IF p_offer_id IS NOT NULL THEN
    SELECT id, title, discount_type, discount_value, min_order_amount, is_active
    INTO v_offer
    FROM offers
    WHERE id = p_offer_id AND tenant_id = v_table.tenant_id;

    IF NOT FOUND OR NOT v_offer.is_active THEN
      RETURN jsonb_build_object('is_valid', false, 'error', 'OFFER_INVALID',
        'message', 'That offer is no longer running. Please refresh and try again.');
    END IF;

    IF v_subtotal < v_offer.min_order_amount THEN
      RETURN jsonb_build_object('is_valid', false, 'error', 'OFFER_MIN',
        'message', 'This offer needs a minimum order of ₹' || round(v_offer.min_order_amount)::text || '.');
    END IF;

    v_discount := CASE v_offer.discount_type
      WHEN 'percent' THEN round(v_subtotal * LEAST(v_offer.discount_value, 100) / 100.0, 2)
      ELSE LEAST(round(v_offer.discount_value, 2), v_subtotal)
    END;
    IF v_discount < 0 THEN v_discount := 0; END IF;
    v_offer_title := v_offer.title;
  END IF;

  v_tax := round((v_subtotal - v_discount) * 0.05, 2);  -- GST 5% on the discounted base
  v_total := round(v_subtotal - v_discount + v_tax, 2);

  v_ctx_notes := trim(concat_ws(' · ',
    nullif(trim(coalesce(p_notes, '')), ''),
    'via QR · Table ' || v_table.table_number));

  -- 4. Insert the ticket (status 'new' — the counter Oks it to the kitchen)
  INSERT INTO orders (tenant_id, location_id, table_id, order_type, status,
                      customer_name, subtotal, discount_amount, tax_amount, total,
                      payment_status, notes, client_operation_id)
  VALUES (v_table.tenant_id, v_table.location_id, v_table.table_id,
          'dine_in', 'new',
          nullif(trim(coalesce(p_customer_name, '')), ''),
          v_subtotal, v_discount, v_tax, v_total, 'pending',
          nullif(v_ctx_notes, ''), nullif(trim(coalesce(p_client_operation_id, '')), ''))
  RETURNING id, order_number INTO v_order_id, v_order_no;

  -- 4b. The redemption ledger row rides with the ticket — UNIQUE(order_id) keeps
  --     it replay-proof; trg_offer_redemptions_usage recomputes usage_count.
  IF v_discount > 0 THEN
    INSERT INTO offer_redemptions (tenant_id, offer_id, order_id, discount_amount)
    VALUES (v_table.tenant_id, p_offer_id, v_order_id, v_discount);
  END IF;

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
    VALUES (v_table.tenant_id, v_order_id, (v_item->>'menu_item_id')::uuid, v_menu.name, v_variant_name,
            (v_item->>'qty')::int, round(v_unit_price, 2),
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

  RETURN jsonb_build_object('is_valid', true,
    'order', jsonb_build_object('id', v_order_id, 'order_number', v_order_no,
      'total', v_total, 'discount_amount', v_discount,
      'offer_title', v_offer_title,
      'status', 'new', 'payment_status', 'pending',
      'table_number', v_table.table_number));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION sp_create_public_order(TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sp_verify_table_session(TEXT) TO anon, authenticated;

-- ── 3. Verification (hard failure on any broken expectation) ────────────────
DO $$
DECLARE
  v_overloads INT;
  v_has_token BOOLEAN;
BEGIN
  SELECT count(*) INTO v_overloads
    FROM pg_proc
   WHERE proname = 'sp_create_public_order' AND pronamespace = 'public'::regnamespace;
  IF v_overloads <> 1 THEN
    RAISE EXCEPTION '023 verification failed: expected exactly 1 sp_create_public_order overload, found %', v_overloads;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc
     WHERE proname = 'sp_create_public_order' AND pronamespace = 'public'::regnamespace
       AND 'p_session_token' = ANY(proargnames)
  ) INTO v_has_token;
  IF NOT v_has_token THEN
    RAISE EXCEPTION '023 verification failed: sp_create_public_order missing p_session_token';
  END IF;

  IF to_regprocedure('public.sp_verify_table_session(text)') IS NULL THEN
    RAISE EXCEPTION '023 verification failed: sp_verify_table_session missing';
  END IF;

  IF NOT has_function_privilege('anon', 'public.sp_verify_table_session(text)', 'EXECUTE') THEN
    RAISE EXCEPTION '023 verification failed: anon lacks EXECUTE on sp_verify_table_session';
  END IF;
  IF NOT has_function_privilege('anon', 'public.sp_create_public_order(text,text,jsonb,text,text,text,text,uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION '023 verification failed: anon lacks EXECUTE on the 9-arg overload';
  END IF;
END $$;
