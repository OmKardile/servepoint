-- ═══════════════════════════════════════════════════════════════════════
-- ServePoint v5.1.3 — Migration 008: Payment guards (NOVA ledger discipline)
-- ═══════════════════════════════════════════════════════════════════════
--
-- Found by the live-cloud E2E probe (test → debug → retest):
--   sp_record_payment accepted a SECOND payment on an already-paid order
--   (the ledger would book the money twice). 007 guarded only against
--   cancelled orders. This migration re-creates the function with:
--     • double-payment guard — an order can be paid exactly once
--     • (behaviour otherwise identical to 007)
--
-- Idempotent (CREATE OR REPLACE). Applies from the CLI:
--   SUPABASE_DB_PASSWORD='<db-password>' bun scripts/db-setup.mjs
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION sp_record_payment(p_order_id UUID, p_method TEXT, p_amount NUMERIC)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant UUID;
  v_status TEXT;
  v_pay_status TEXT;
BEGIN
  SELECT tenant_id, status, payment_status INTO v_tenant, v_status, v_pay_status
  FROM orders WHERE id = p_order_id FOR UPDATE;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT sp_tenant_member(v_tenant) THEN
    RAISE EXCEPTION 'Not a member of this workspace' USING ERRCODE = '42501';
  END IF;

  IF v_status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot record a payment on a cancelled order' USING ERRCODE = 'P0001';
  END IF;

  -- v5.1.3: the counter records money exactly once per order
  IF v_pay_status = 'completed' THEN
    RAISE EXCEPTION 'Order has already been paid' USING ERRCODE = 'P0001';
  END IF;

  IF p_method NOT IN ('cash', 'upi', 'card') THEN
    RAISE EXCEPTION 'Unknown payment method: %', p_method USING ERRCODE = 'P0001';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be positive' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO payments (tenant_id, order_id, method, amount, status, confirmed_by_email)
  VALUES (v_tenant, p_order_id, p_method, p_amount, 'paid', COALESCE(auth.jwt() ->> 'email', ''));

  UPDATE orders
  SET payment_status = 'completed', payment_method = p_method
  WHERE id = p_order_id;
END;
$$;

-- ── Verification ─────────────────────────────────────────────────────────
SELECT pg_get_functiondef('public.sp_record_payment(uuid,text,numeric)'::regprocedure) IS NOT NULL
  AS sp_record_payment_rebuilt,
  pg_get_functiondef('public.sp_record_payment(uuid,text,numeric)'::regprocedure) LIKE '%already been paid%'
  AS double_pay_guard_present;
