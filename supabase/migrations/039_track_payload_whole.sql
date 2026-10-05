-- ============================================================================
-- 039_track_payload_whole.sql — the ticket's payload learns three fields back
--
-- PREPARED, NOT YET APPLIED (needs SUPABASE_DB_PASSWORD / the pooler — the
-- owner-word wall). One command when ready:
--   SUPABASE_DB_PASSWORD='…' node -e "…apply via scripts/db-setup.mjs lineage…"
--
-- THE ARCHAEOLOGY (written 2026-10-06, Task 295, proven live first):
--   · 017 put discount_amount + offer_title on sp_get_public_order so the
--     guest's ticket could speak the offer row.
--   · 019 added feedback_rating so the reopened pager showed the thank-you
--     from server truth.
--   · 025 (track page brand) rebuilt the function "same shape as 017" —
--     but from the PRE-019 body: it silently dropped feedback_rating AND
--     017's own discount_amount + offer_title. No verification caught it.
--   · 037 (legal footer) inherited 025's body and added the tenant's three
--     legal fields — the drops rode along.
--   · Live consequence (proven in Task 295's walk): the offer/discount row
--     never renders on a real discounted ticket (Number(undefined) > 0 is
--     false), and the thanks card flips back to the rate form at the next
--     10-second poll — the guest is asked to rate what they already rated.
--     The re-rate then hit a SECOND wound: the replay guard answered
--     { is_valid: false, error: 'ALREADY' } and the UI said "Could not send
--     your rating" — an accusation where the truth was "already heard".
--     The client-side halves of both fixes ship in 5.256.0 (the tab keeps
--     its own accepted act; ALREADY reads as acceptance); THIS migration
--     restores the server truth AND makes the replay speak acceptance
--     (section B).
--
-- SHAPE: the FULL merge — 037's body (tenant + legal fields) + 017's
-- discount_amount + offer_title + 019's feedback_rating. One body, every
-- lineage's fields, no fork. SECURITY DEFINER + search_path pinned, the
-- 037 way. Grants are unconditional on this function (REVOKE/GRANT below
-- re-asserts what the family always declared); RLS is untouched.
--
-- Deliberately untouched: sp_submit_public_feedback (019, live and correct),
-- order_feedback table/RLS/realtime (019), every other RPC in the family.
-- ============================================================================

-- ── A. the whole payload ───────────────────────────────────────────────────
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
         o.payment_method, o.subtotal, o.discount_amount, o.tax_amount, o.total,
         o.customer_name, o.notes, o.created_at, o.updated_at,
         dt.table_number,
         tn.name AS tenant_name, tn.logo_url AS tenant_logo_url,
         tn.legal_name AS tenant_legal_name, tn.gst_number AS tenant_gst_number,
         tn.fssai_number AS tenant_fssai_number,
         (SELECT of_.title FROM offer_redemptions r
          JOIN offers of_ ON of_.id = r.offer_id
          WHERE r.order_id = o.id LIMIT 1) AS offer_title,
         (SELECT f.rating FROM order_feedback f
          WHERE f.order_id = o.id LIMIT 1) AS feedback_rating
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
      'subtotal', v_order.subtotal, 'discount_amount', v_order.discount_amount,
      'offer_title', v_order.offer_title,
      'tax_amount', v_order.tax_amount, 'total', v_order.total,
      'customer_name', v_order.customer_name, 'notes', v_order.notes,
      'table_number', v_order.table_number,
      'created_at', v_order.created_at, 'updated_at', v_order.updated_at,
      'feedback_rating', v_order.feedback_rating,
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

-- ── B. the replay speaks the truth (proven live in Task 295) ────────────────
-- sp_submit_public_feedback's UNIQUE(order_id) replay guard returned
-- { is_valid: false, error: 'ALREADY' } — and the guest UI read that as
-- "Could not send your rating. Try again." A guest whose FIRST rating was
-- already stored (the 025/037 poll-flip made them rate again) was told
-- their voice FAILED. The replay now returns the STORED word with
-- is_valid: true and a 'replayed' marker — the contract's truth: a second
-- submit can never stack, and it was never a failure. The 5.256 client
-- accepts BOTH shapes (is_valid OR error==='ALREADY'), so this lands
-- honestly before or after the client.
CREATE OR REPLACE FUNCTION public.sp_submit_public_feedback(
  p_order_id UUID,
  p_rating   INTEGER,
  p_comment  TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant UUID;
  v_clean  TEXT;
  v_row    order_feedback;
BEGIN
  IF p_order_id IS NULL THEN
    RETURN jsonb_build_object('is_valid', false, 'error', 'NOT_FOUND',
      'message', 'This order link is not valid.');
  END IF;

  SELECT tenant_id INTO v_tenant FROM orders WHERE id = p_order_id;
  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object('is_valid', false, 'error', 'NOT_FOUND',
      'message', 'This order link is not valid.');
  END IF;

  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('is_valid', false, 'error', 'BAD_RATING',
      'message', 'Please choose between 1 and 5 stars.');
  END IF;

  -- a rating is one tap — keep the comment a comment, not an essay
  v_clean := NULLIF(trim(COALESCE(p_comment, '')), '');
  IF length(v_clean) > 280 THEN
    RETURN jsonb_build_object('is_valid', false, 'error', 'TOO_LONG',
      'message', 'Please keep the note under 280 characters.');
  END IF;

  -- UNIQUE(order_id) is the replay guard: a second submit can never stack.
  -- The replay is an ACCEPTANCE carrying the stored word — never a failure.
  INSERT INTO order_feedback (tenant_id, order_id, rating, comment)
  VALUES (v_tenant, p_order_id, p_rating, v_clean)
  ON CONFLICT (order_id) DO NOTHING
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    SELECT * INTO v_row FROM order_feedback WHERE order_id = p_order_id;
    RETURN jsonb_build_object('is_valid', true, 'replayed', true,
      'rating', v_row.rating, 'comment', v_row.comment,
      'created_at', v_row.created_at);
  END IF;

  RETURN jsonb_build_object('is_valid', true,
    'rating', v_row.rating, 'created_at', v_row.created_at);
END;
$$;

REVOKE ALL ON FUNCTION public.sp_submit_public_feedback(UUID,INTEGER,TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.sp_submit_public_feedback(UUID,INTEGER,TEXT) TO anon, authenticated;

-- ── C. grants re-asserted (the family's standing posture) ──────────────────
REVOKE ALL ON FUNCTION public.sp_get_public_order(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.sp_get_public_order(uuid) TO anon, authenticated;

-- ── D. verification (runs at migration time — the family's own law) ────────
DO $$
BEGIN
  IF (SELECT position('feedback_rating' in prosrc) = 0 FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace AND proname = 'sp_get_public_order') THEN
    RAISE EXCEPTION '039 verification failed: sp_get_public_order missing feedback_rating';
  END IF;
  IF (SELECT position('offer_title' in prosrc) = 0 FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace AND proname = 'sp_get_public_order') THEN
    RAISE EXCEPTION '039 verification failed: sp_get_public_order missing offer_title';
  END IF;
  IF (SELECT position('discount_amount' in prosrc) = 0 FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace AND proname = 'sp_get_public_order') THEN
    RAISE EXCEPTION '039 verification failed: sp_get_public_order missing discount_amount';
  END IF;
  IF (SELECT position('fssai_number' in prosrc) = 0 FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace AND proname = 'sp_get_public_order') THEN
    RAISE EXCEPTION '039 verification failed: sp_get_public_order missing fssai_number';
  END IF;
  IF NOT has_function_privilege('anon',
       'sp_get_public_order(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION '039 verification failed: anon EXECUTE grant missing';
  END IF;
  IF NOT has_function_privilege('anon',
       'sp_submit_public_feedback(UUID,INTEGER,TEXT)', 'EXECUTE') THEN
    RAISE EXCEPTION '039 verification failed: submit RPC anon EXECUTE grant missing';
  END IF;
  IF (SELECT position("'replayed', true" in prosrc) = 0 FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace AND proname = 'sp_submit_public_feedback') THEN
    RAISE EXCEPTION '039 verification failed: the submit replay still speaks ALREADY-failure, not acceptance';
  END IF;

  RAISE NOTICE '039 verified: the track payload carries discount_amount, offer_title, feedback_rating AND the 037 legal tenant fields; the submit replay speaks acceptance; anon EXECUTE intact';
END;
$$;
