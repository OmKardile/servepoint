-- ============================================================================
-- 019_guest_feedback.sql — NOVA parity: guest feedback ("how was everything?")
--
-- The last guest-side NOVA item from the early roadmap (line: shifts & drawer,
-- guest feedback). The guest loop is: scan → order → track → pay → and now
-- RATE. One rating per order, ever (UNIQUE(order_id) — the 015/016 ledger
-- pattern: the constraint IS the replay guard, nothing to drift).
--
-- Security model — capabilities, not accounts (012 principle):
--   - the order UUID doubles as the rating capability: anyone holding the
--     track link can rate that order, exactly once, only while it exists;
--   - anon NEVER touches the table directly (no INSERT/SELECT policy) — every
--     guest write goes through sp_submit_public_feedback (SECURITY DEFINER)
--     which validates the order, clamps the shape, and stays silent on replays;
--   - staff read through the standard two-policy RLS shape (superadmin +
--     current_tenant_id), same as customers/offers in 016.
--
-- sp_get_public_order (017 version) is replaced to expose feedback_rating —
-- a reopened track page shows the thank-you state from SERVER truth, not
-- localStorage guesswork.
--
-- Realtime: order_feedback joins supabase_realtime so a future live widget
-- can subscribe without another migration.
-- ============================================================================

-- ── A. table ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_order_feedback_tenant_time
  ON order_feedback(tenant_id, created_at DESC);

-- ── B. RLS — anon is locked out; staff read their own tenant ────────────────
ALTER TABLE order_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full access on order_feedback" ON order_feedback;
CREATE POLICY "Superadmin full access on order_feedback"
  ON order_feedback FOR ALL TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

DROP POLICY IF EXISTS "Tenant full access on own order_feedback" ON order_feedback;
CREATE POLICY "Tenant full access on own order_feedback"
  ON order_feedback FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- No anon policy of any kind: RLS deny-by-default blocks direct anon writes
-- and reads; the SECURITY DEFINER RPC below is the ONLY guest path.

-- ── C. guest submit RPC — validate, clamp, replay-silent ────────────────────
-- p_rating is INTEGER on purpose: int4→smallint is an ASSIGNMENT cast (not
-- implicit), so an integer literal from a raw SQL caller would fail overload
-- resolution ("function does not exist"). INTEGER resolves everywhere; the
-- column CHECK (1..5) stays the hard boundary.
CREATE OR REPLACE FUNCTION sp_submit_public_feedback(
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

  -- UNIQUE(order_id) is the replay guard: a second submit can never stack
  INSERT INTO order_feedback (tenant_id, order_id, rating, comment)
  VALUES (v_tenant, p_order_id, p_rating, v_clean)
  ON CONFLICT (order_id) DO NOTHING
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('is_valid', false, 'error', 'ALREADY',
      'message', 'This order was already rated.');
  END IF;

  RETURN jsonb_build_object('is_valid', true,
    'rating', v_row.rating, 'created_at', v_row.created_at);
END;
$$;

-- ── D. track projection learns the rating ───────────────────────────────────
-- Same shape as 017, plus feedback_rating so the reopened pager shows the
-- thank-you state from server truth.
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
         o.payment_method, o.subtotal, o.discount_amount, o.tax_amount, o.total,
         o.customer_name, o.notes, o.created_at, o.updated_at,
         dt.table_number,
         (SELECT of.title FROM offer_redemptions r
          JOIN offers of ON of.id = r.offer_id
          WHERE r.order_id = o.id LIMIT 1) AS offer_title,
         (SELECT f.rating FROM order_feedback f
          WHERE f.order_id = o.id LIMIT 1) AS feedback_rating
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── E. ACL parity (replacements keep existing ACLs) ─────────────────────────
-- DROP first: arg-type changes OVERLOAD instead of replace (017 lesson) —
-- a leftover smallint shadow would keep winning calls and break resolution.
DROP FUNCTION IF EXISTS sp_submit_public_feedback(UUID, SMALLINT, TEXT);
GRANT EXECUTE ON FUNCTION sp_submit_public_feedback(UUID, INTEGER, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sp_get_public_order(UUID) TO anon, authenticated;

-- ── F. realtime ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'order_feedback' AND schemaname = 'public'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.order_feedback';
  END IF;
END $$;

-- ── G. Verification ─────────────────────────────────────────────────────────
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- table + RLS
  IF to_regclass('public.order_feedback') IS NULL THEN
    RAISE EXCEPTION '019 verification failed: order_feedback table missing';
  END IF;
  SELECT relrowsecurity::int INTO v_count FROM pg_class
   WHERE oid = 'public.order_feedback'::regclass;
  IF v_count <> 1 THEN
    RAISE EXCEPTION '019 verification failed: RLS not enabled on order_feedback';
  END IF;

  -- both tenant policies exist
  SELECT count(*) INTO v_count FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'order_feedback'
     AND policyname IN ('Superadmin full access on order_feedback',
                        'Tenant full access on own order_feedback');
  IF v_count <> 2 THEN
    RAISE EXCEPTION '019 verification failed: expected 2 RLS policies on order_feedback';
  END IF;

  -- exactly ONE submit overload, anon-executable
  IF (SELECT count(*) FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace
        AND proname = 'sp_submit_public_feedback') <> 1 THEN
    RAISE EXCEPTION '019 verification failed: expected exactly 1 sp_submit_public_feedback overload';
  END IF;
  IF NOT has_function_privilege('anon',
       'sp_submit_public_feedback(UUID,INTEGER,TEXT)', 'EXECUTE') THEN
    RAISE EXCEPTION '019 verification failed: anon EXECUTE grant missing';
  END IF;

  -- the pager projection now carries the rating
  IF (SELECT position('feedback_rating' in prosrc) = 0 FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace AND proname = 'sp_get_public_order') THEN
    RAISE EXCEPTION '019 verification failed: sp_get_public_order missing feedback_rating';
  END IF;

  -- the ledger table streams
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname = 'supabase_realtime'
                   AND tablename = 'order_feedback' AND schemaname = 'public') THEN
    RAISE EXCEPTION '019 verification failed: order_feedback not on supabase_realtime';
  END IF;

  RAISE NOTICE '019 verified: table+RLS+2 policies, submit RPC anon-executable, pager exposes feedback_rating, realtime on';
END;
$$;
