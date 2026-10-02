-- ═══════════════════════════════════════════════════════════════════════════
-- 013_counter_gate.sql — ServePoint v5.3.0 "The counter is the gate"
--
-- NOVA rule (spec line 495): "KDS consumes only preparing/ready; guest orders
-- enter the kitchen exclusively via inbox Ok or checkout auto-advance."
--
-- Two engine changes, both additive and idempotent:
--   1. sp_advance_order learns `new → pending`: the counter inbox "Ok" files
--      a fresh ticket into the kitchen queue WITHOUT forcing the kitchen to
--      have already started cooking. `new → preparing` stays legal (one-tap
--      kitchens may still fire straight to the pan).
--   2. sp_record_payment auto-advances the meal: when money lands while the
--      order is still un-started (new/pending), the order moves to
--      `preparing` in the same transaction — the walk-in "money in hand"
--      rule (spec line 141). Paid-and-unstarted tickets must never sit in
--      the inbox while the kitchen idles.
--
-- The order_status_history trigger keeps stamping every status hop, so the
-- auto-advance is auditable like any manual advance.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. sp_advance_order — the only way statuses change (v2) ───────────────
CREATE OR REPLACE FUNCTION sp_advance_order(p_order_id UUID, p_to_status TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant UUID;
  v_status TEXT;
BEGIN
  SELECT tenant_id, status INTO v_tenant, v_status
  FROM orders WHERE id = p_order_id FOR UPDATE;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT sp_tenant_member(v_tenant) THEN
    RAISE EXCEPTION 'Not a member of this workspace' USING ERRCODE = '42501';
  END IF;

  IF v_status = 'cancelled' THEN
    RAISE EXCEPTION 'Order is cancelled and cannot change status' USING ERRCODE = 'P0001';
  END IF;

  IF p_to_status NOT IN ('pending', 'preparing', 'ready', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'Unknown status: %', p_to_status USING ERRCODE = 'P0001';
  END IF;

  IF NOT (
    (v_status = 'new' AND p_to_status IN ('pending', 'preparing', 'cancelled')) OR
    (v_status = 'pending' AND p_to_status IN ('preparing', 'cancelled')) OR
    (v_status = 'preparing' AND p_to_status IN ('ready', 'cancelled')) OR
    (v_status = 'ready' AND p_to_status = 'completed')
  ) THEN
    RAISE EXCEPTION 'Cannot move an order from % to %', v_status, p_to_status
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE orders SET status = p_to_status WHERE id = p_order_id;
END;
$$;

-- ── 2. sp_record_payment — the only way money is recorded (v3) ────────────
-- Guards from 008 kept (double-pay rejection, cancelled rejection).
-- NEW: money-in-hand auto-advance — a payment on an un-started order
-- (new/pending) pushes it straight to `preparing`, same transaction.
CREATE OR REPLACE FUNCTION sp_record_payment(p_order_id UUID, p_method TEXT, p_amount NUMERIC)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant UUID;
  v_status TEXT;
BEGIN
  SELECT tenant_id, status INTO v_tenant, v_status
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

  -- Money in hand ⇒ the kitchen must see it. Counter-gate rule: paid
  -- walk-in sales never wait in the inbox (v0.5.139 walk-in auto-advance).
  IF v_status IN ('new', 'pending') THEN
    UPDATE orders SET status = 'preparing' WHERE id = p_order_id;
  END IF;
END;
$$;

-- ── 3. Verification ───────────────────────────────────────────────────────
DO $$
DECLARE
  v_new_pending BOOLEAN;
  v_auto_advance BOOLEAN;
BEGIN
  SELECT pg_get_functiondef('sp_advance_order(UUID,TEXT)'::regprocedure)
           LIKE '%v_status = ''new'' AND p_to_status IN (''pending''%'
    INTO v_new_pending;
  SELECT pg_get_functiondef('sp_record_payment(UUID,TEXT,NUMERIC)'::regprocedure)
           LIKE '%IF v_status IN (''new'', ''pending'') THEN%'
    INTO v_auto_advance;

  IF NOT v_new_pending OR NOT v_auto_advance THEN
    RAISE EXCEPTION '013 verification failed: new→pending=% auto-advance=%',
      v_new_pending, v_auto_advance;
  END IF;
  RAISE NOTICE '013_counter_gate verified: inbox-Ok ladder + money-in-hand auto-advance live';
END
$$;
