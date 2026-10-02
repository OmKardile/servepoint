-- ═══════════════════════════════════════════════════════════════════════════
-- ServePoint migration 021 — CASH DRAWER MOVEMENTS (payouts & safe drops)
--
-- The honesty gap 020 parked out loud: a real drawer doesn't only take money
-- in. Cash LEAVES it too — a supplier paid at the door (payout), or the
-- counter skips to the safe so the drawer doesn't grow top-heavy (safe drop).
-- Without a ledger for that, a counter operator closing a shift after a
-- payout would be blamed for a variance that isn't theirs — the whole point
-- of stored variance is trust.
--
-- Rules:
--   • cash_drawer_movements is an append-only evidence ledger like every
--     other ServePoint money table: tenant-scoped, member-only RLS, zero
--     anon paths, session-bound (CASCADE — a session dies with its shifts).
--   • kinds: 'payout' (cash out of the business) and 'drop' (cash moved to
--     the safe — still out of the DRAWER). Both reduce expected drawer cash.
--   • reason is REQUIRED (1–280 after trim) — "₹200 out" without a why is
--     not evidence, it's a leak. The UI enforces before the RPC does.
--   • sp_record_drawer_movement: SECURITY DEFINER, authenticated-only
--     EXECUTE (PUBLIC + anon revoked — the 020 grant lesson baked in from
--     the start), stable P0001 codes, session must be OPEN (movements after
--     a seal would rewrite sealed evidence).
--   • sp_close_drawer REBODIED (same signature, still exactly one overload):
--     expected = opening_float + cash-in − Σ(movements). No movements ⇒
--     byte-identical math to 020, so the 020 E2E stays green untouched.
--   • Realtime + db-setup 021 sentinel.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. cash_drawer_movements — append-only outflow ledger ────────────────
CREATE TABLE IF NOT EXISTS cash_drawer_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES cash_drawer_sessions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('payout', 'drop')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 280),
  created_by_email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_movements_tenant
  ON cash_drawer_movements(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_movements_session
  ON cash_drawer_movements(session_id, created_at);

ALTER TABLE cash_drawer_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash movements member all" ON cash_drawer_movements;
CREATE POLICY "cash movements member all" ON cash_drawer_movements
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL AND sp_tenant_member(tenant_id))
  WITH CHECK (auth.uid() IS NOT NULL AND sp_tenant_member(tenant_id));

-- ── 2. sp_record_drawer_movement — money leaves the drawer, on the record ─
DROP FUNCTION IF EXISTS sp_record_drawer_movement(UUID, TEXT, NUMERIC, TEXT);
CREATE OR REPLACE FUNCTION sp_record_drawer_movement(
  p_session_id UUID,
  p_kind TEXT,
  p_amount NUMERIC,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant UUID;
  v_session cash_drawer_sessions;
  v_kind TEXT;
  v_amount NUMERIC;
  v_reason TEXT;
  v_row cash_drawer_movements;
BEGIN
  v_tenant := current_tenant_id();
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'NOT_A_MEMBER' USING ERRCODE = 'P0001';
  END IF;

  v_kind := lower(btrim(COALESCE(p_kind, '')));
  IF v_kind NOT IN ('payout', 'drop') THEN
    RAISE EXCEPTION 'BAD_KIND' USING ERRCODE = 'P0001';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'BAD_AMOUNT' USING ERRCODE = 'P0001';
  END IF;
  v_amount := round(p_amount, 2);

  v_reason := btrim(COALESCE(p_reason, ''));
  IF char_length(v_reason) < 1 THEN
    RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(v_reason) > 280 THEN
    RAISE EXCEPTION 'TOO_LONG' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_session FROM cash_drawer_sessions
  WHERE id = p_session_id AND tenant_id = v_tenant;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_session.status <> 'open' THEN
    RAISE EXCEPTION 'DRAWER_NOT_OPEN' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO cash_drawer_movements (tenant_id, session_id, kind, amount, reason, created_by_email)
  VALUES (v_tenant, v_session.id, v_kind, v_amount, v_reason, COALESCE(auth.jwt() ->> 'email', ''))
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'session_id', v_row.session_id,
    'kind', v_row.kind,
    'amount', v_row.amount,
    'reason', v_row.reason,
    'created_at', v_row.created_at
  );
END;
$$;

-- counter/authenticated staff only — PUBLIC's default EXECUTE revoked too
-- (the 020 lesson baked in from the start)
REVOKE EXECUTE ON FUNCTION sp_record_drawer_movement(UUID, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sp_record_drawer_movement(UUID, TEXT, NUMERIC, TEXT) TO authenticated;

-- ── 3. sp_close_drawer REBODIED — expected now nets the outflows ─────────
-- Same signature (still exactly ONE overload); no movements ⇒ identical
-- math to 020, so the 020 E2E suite stays green untouched.
CREATE OR REPLACE FUNCTION sp_close_drawer(p_session_id UUID, p_counted_cash NUMERIC, p_note TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant UUID;
  v_session cash_drawer_sessions;
  v_cash_in NUMERIC;
  v_out NUMERIC;
  v_expected NUMERIC;
  v_variance NUMERIC;
  v_note TEXT;
BEGIN
  v_tenant := current_tenant_id();
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'NOT_A_MEMBER' USING ERRCODE = 'P0001';
  END IF;

  IF p_counted_cash IS NULL OR p_counted_cash < 0 THEN
    RAISE EXCEPTION 'BAD_COUNT' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_session FROM cash_drawer_sessions
  WHERE id = p_session_id AND tenant_id = v_tenant;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_session.status <> 'open' THEN
    RAISE EXCEPTION 'ALREADY_CLOSED' USING ERRCODE = 'P0001';
  END IF;

  -- ledger truth in: every cash payment taken while this drawer was open
  SELECT COALESCE(round(SUM(amount), 2), 0) INTO v_cash_in
  FROM payments
  WHERE tenant_id = v_tenant
    AND method = 'cash'
    AND created_at >= v_session.opened_at
    AND created_at <= now();

  -- ledger truth out: payouts + safe drops recorded on the open shift
  SELECT COALESCE(round(SUM(amount), 2), 0) INTO v_out
  FROM cash_drawer_movements
  WHERE session_id = v_session.id;

  v_expected := round(v_session.opening_float + v_cash_in - v_out, 2);
  v_variance := round(p_counted_cash - v_expected, 2);

  IF p_note IS NULL THEN
    v_note := NULL;
  ELSE
    v_note := trim(p_note);
    IF char_length(v_note) > 280 THEN
      RAISE EXCEPTION 'TOO_LONG' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE cash_drawer_sessions
  SET status = 'closed',
      closed_by_email = COALESCE(auth.jwt() ->> 'email', ''),
      closed_at = now(),
      counted_cash = round(p_counted_cash, 2),
      expected_cash = v_expected,
      variance = v_variance,
      closing_note = v_note
  WHERE id = v_session.id
  RETURNING * INTO v_session;

  RETURN jsonb_build_object(
    'id', v_session.id,
    'closed_at', v_session.closed_at,
    'opening_float', v_session.opening_float,
    'cash_in', v_cash_in,
    'movements_out', v_out,
    'expected_cash', v_session.expected_cash,
    'counted_cash', v_session.counted_cash,
    'variance', v_session.variance,
    'status', v_session.status
  );
END;
$$;

-- ── 4. realtime — movement chips appear on every counter device ──────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'cash_drawer_movements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE cash_drawer_movements;
  END IF;
END $$;

-- ── 5. verification — fail the migration loudly, not the app silently ────
DO $$
DECLARE
  v_tbl BOOLEAN;
  v_rls INTEGER;
  v_pol INTEGER;
  v_fn_move INTEGER;
  v_fn_close INTEGER;
  v_anon BOOLEAN;
  v_rt INTEGER;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_class WHERE oid = 'public.cash_drawer_movements'::regclass
  ) INTO v_tbl;
  IF NOT v_tbl THEN
    RAISE EXCEPTION '021 verification failed: cash_drawer_movements missing';
  END IF;

  SELECT COUNT(*) INTO v_rls FROM pg_class
  WHERE oid = 'public.cash_drawer_movements'::regclass AND relrowsecurity = true;
  IF v_rls <> 1 THEN
    RAISE EXCEPTION '021 verification failed: RLS not enabled';
  END IF;

  SELECT COUNT(*) INTO v_pol FROM pg_policies WHERE tablename = 'cash_drawer_movements';
  IF v_pol <> 1 THEN
    RAISE EXCEPTION '021 verification failed: expected exactly 1 RLS policy, got %', v_pol;
  END IF;

  SELECT COUNT(*) INTO v_fn_move FROM pg_proc
  WHERE proname = 'sp_record_drawer_movement' AND pronamespace = 'public'::regnamespace;
  SELECT COUNT(*) INTO v_fn_close FROM pg_proc
  WHERE proname = 'sp_close_drawer' AND pronamespace = 'public'::regnamespace;
  IF v_fn_move <> 1 OR v_fn_close <> 1 THEN
    RAISE EXCEPTION '021 verification failed: expected exactly 1 movement RPC + 1 close RPC, got %/%', v_fn_move, v_fn_close;
  END IF;

  -- the close body must net the movements ledger
  IF position('cash_drawer_movements' in (
    SELECT prosrc FROM pg_proc
    WHERE proname = 'sp_close_drawer' AND pronamespace = 'public'::regnamespace
  )) = 0 THEN
    RAISE EXCEPTION '021 verification failed: sp_close_drawer does not read the movements ledger';
  END IF;

  SELECT has_function_privilege('anon', 'sp_record_drawer_movement(UUID,TEXT,NUMERIC,TEXT)', 'EXECUTE') INTO v_anon;
  IF v_anon THEN
    RAISE EXCEPTION '021 verification failed: anon must NOT execute sp_record_drawer_movement';
  END IF;

  SELECT COUNT(*) INTO v_rt FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime' AND tablename = 'cash_drawer_movements';
  IF v_rt <> 1 THEN
    RAISE EXCEPTION '021 verification failed: realtime publication missing';
  END IF;
END $$;
