-- ═══════════════════════════════════════════════════════════════════════════
-- ServePoint migration 020 — CASH DRAWER SESSIONS (shifts & drawer, NOVA)
--
-- The last unbuilt NOVA-roadmap item. A cash drawer session is one shift's
-- physical drawer: it OPENS with a counted float and CLOSES with a recount.
-- Between the two, the only write path into it is the payments ledger
-- (007) — cash payments land in the drawer, so expected cash at close is
--   opening_float + Σ(cash payments while open)
-- computed SERVER-SIDE at close time from ledger truth, never re-typed by
-- the counter. variance = counted − expected is stored, not derived, so the
-- shift history is immutable evidence.
--
-- Rules:
--   • ONE open drawer per tenant (unique partial index WHERE status='open')
--     — a cafe has one physical drawer; multi-location can extend later.
--   • RLS: the standard two-actor model — platform superadmin (service
--     role bypasses RLS by design) + tenant members. Zero anon paths.
--   • sp_open_drawer / sp_close_drawer are SECURITY DEFINER, authenticated
--     EXECUTE only (never anon — money actions need a logged-in human),
--     tenant from current_tenant_id() (001 helper), errors as P0001 with
--     stable codes the UI maps to honest messages.
--   • DROP-IF-EXISTS before both functions (the 017 overload lesson).
--   • Realtime: the live card mirrors drawer state across counter devices.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. cash_drawer_sessions ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cash_drawer_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  opened_by_email TEXT NOT NULL DEFAULT '',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  opening_float NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (opening_float >= 0),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  closed_by_email TEXT,
  closed_at TIMESTAMPTZ,
  counted_cash NUMERIC(12,2) CHECK (counted_cash IS NULL OR counted_cash >= 0),
  expected_cash NUMERIC(12,2),
  variance NUMERIC(12,2),
  closing_note TEXT CHECK (closing_note IS NULL OR char_length(closing_note) <= 280),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_drawer_tenant
  ON cash_drawer_sessions(tenant_id, opened_at DESC);

-- One physical drawer per cafe: at most ONE open session per tenant.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_drawer_one_open
  ON cash_drawer_sessions(tenant_id) WHERE status = 'open';

ALTER TABLE cash_drawer_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash drawer member all" ON cash_drawer_sessions;
CREATE POLICY "cash drawer member all" ON cash_drawer_sessions
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL AND sp_tenant_member(tenant_id))
  WITH CHECK (auth.uid() IS NOT NULL AND sp_tenant_member(tenant_id));

-- ── 2. sp_open_drawer — start a shift with a counted float ───────────────
DROP FUNCTION IF EXISTS sp_open_drawer(NUMERIC);
CREATE OR REPLACE FUNCTION sp_open_drawer(p_opening_float NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant UUID;
  v_session cash_drawer_sessions;
BEGIN
  v_tenant := current_tenant_id();
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'NOT_A_MEMBER' USING ERRCODE = 'P0001';
  END IF;

  IF p_opening_float IS NULL OR p_opening_float < 0 THEN
    RAISE EXCEPTION 'BAD_FLOAT' USING ERRCODE = 'P0001';
  END IF;

  -- the unique partial index is the hard guard; this pre-check turns the
  -- constraint violation into a stable, mappable code
  IF EXISTS (SELECT 1 FROM cash_drawer_sessions WHERE tenant_id = v_tenant AND status = 'open') THEN
    RAISE EXCEPTION 'DRAWER_ALREADY_OPEN' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO cash_drawer_sessions (tenant_id, opened_by_email, opening_float)
  VALUES (v_tenant, COALESCE(auth.jwt() ->> 'email', ''), round(p_opening_float, 2))
  RETURNING * INTO v_session;

  RETURN jsonb_build_object(
    'id', v_session.id,
    'opened_at', v_session.opened_at,
    'opening_float', v_session.opening_float,
    'status', v_session.status
  );
END;
$$;

-- ── 3. sp_close_drawer — recount, store variance, seal the shift ─────────
DROP FUNCTION IF EXISTS sp_close_drawer(UUID, NUMERIC, TEXT);
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

  -- ledger truth: every cash payment taken while this drawer was open
  SELECT COALESCE(round(SUM(amount), 2), 0) INTO v_cash_in
  FROM payments
  WHERE tenant_id = v_tenant
    AND method = 'cash'
    AND created_at >= v_session.opened_at
    AND created_at <= now();

  v_expected := round(v_session.opening_float + v_cash_in, 2);
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
    'expected_cash', v_session.expected_cash,
    'counted_cash', v_session.counted_cash,
    'variance', v_session.variance,
    'status', v_session.status
  );
END;
$$;

-- counter/authenticated staff only — never anon (money actions need a human)
-- PUBLIC loses the default EXECUTE too, otherwise anon inherits it back
REVOKE EXECUTE ON FUNCTION sp_open_drawer(NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sp_open_drawer(NUMERIC) TO authenticated;
REVOKE EXECUTE ON FUNCTION sp_close_drawer(UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sp_close_drawer(UUID, NUMERIC, TEXT) TO authenticated;

-- ── 4. realtime — the drawer card mirrors state across counter devices ───
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'cash_drawer_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE cash_drawer_sessions;
  END IF;
END $$;

-- ── 5. verification — fail the migration loudly, not the app silently ────
DO $$
DECLARE
  v_tbl BOOLEAN;
  v_rls INTEGER;
  v_pol INTEGER;
  v_fn INTEGER;
  v_anon BOOLEAN;
  v_rt INTEGER;
  v_idx INTEGER;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_class WHERE oid = 'public.cash_drawer_sessions'::regclass
  ) INTO v_tbl;
  IF NOT v_tbl THEN
    RAISE EXCEPTION '020 verification failed: cash_drawer_sessions missing';
  END IF;

  SELECT COUNT(*) INTO v_rls FROM pg_class
  WHERE oid = 'public.cash_drawer_sessions'::regclass AND relrowsecurity = true;
  IF v_rls <> 1 THEN
    RAISE EXCEPTION '020 verification failed: RLS not enabled';
  END IF;

  SELECT COUNT(*) INTO v_pol FROM pg_policies WHERE tablename = 'cash_drawer_sessions';
  IF v_pol <> 1 THEN
    RAISE EXCEPTION '020 verification failed: expected exactly 1 RLS policy, got %', v_pol;
  END IF;

  SELECT COUNT(*) INTO v_fn FROM pg_proc
  WHERE proname IN ('sp_open_drawer','sp_close_drawer')
    AND pronamespace = 'public'::regnamespace;
  IF v_fn <> 2 THEN
    RAISE EXCEPTION '020 verification failed: expected exactly 2 RPCs, got %', v_fn;
  END IF;

  SELECT has_function_privilege('anon', 'sp_open_drawer(NUMERIC)', 'EXECUTE') INTO v_anon;
  IF v_anon THEN
    RAISE EXCEPTION '020 verification failed: anon must NOT execute sp_open_drawer';
  END IF;

  SELECT COUNT(*) INTO v_rt FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime' AND tablename = 'cash_drawer_sessions';
  IF v_rt <> 1 THEN
    RAISE EXCEPTION '020 verification failed: realtime publication missing';
  END IF;

  SELECT COUNT(*) INTO v_idx FROM pg_indexes
  WHERE indexname = 'uq_cash_drawer_one_open';
  IF v_idx <> 1 THEN
    RAISE EXCEPTION '020 verification failed: one-open-per-tenant index missing';
  END IF;
END $$;
