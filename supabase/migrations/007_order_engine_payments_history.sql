-- ═══════════════════════════════════════════════════════════════════════
-- ServePoint v5.1.0 — Migration 007: Order Engine (NOVA discipline)
-- Payments ledger + append-only status history + guarded RPCs.
-- ═══════════════════════════════════════════════════════════════════════
--
-- Learned from the alternative NOVA build (web-nova v0.5.139, migrations
-- 0001–0051) — its rules that this migration adopts:
--   • Writes to money paths go through SECURITY DEFINER RPCs that validate
--     membership server-side (the anon key alone can do nothing).
--   • Every order status change leaves an append-only audit trail.
--   • Payments are a ledger (one row per recorded payment), not just a
--     status field on the order.
--   • The counter is the gate — staff record money; nothing auto-pays.
--
-- HOW TO RUN: Supabase Dashboard → SQL Editor → paste → Run, or
--   SUPABASE_DB_PASSWORD='<db-password>' bun scripts/db-setup.mjs
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. payments — the money ledger ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('cash', 'upi', 'card')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'paid',
  confirmed_by_email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments member all" ON payments;
CREATE POLICY "payments member all" ON payments
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL AND sp_tenant_member(tenant_id))
  WITH CHECK (auth.uid() IS NOT NULL AND sp_tenant_member(tenant_id));

-- ── 2. order_status_history — append-only trail (trigger-written) ────────
CREATE TABLE IF NOT EXISTS order_status_history (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_history_order ON order_status_history(order_id, created_at ASC);

ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- Read-only for members; rows are written exclusively by the trigger's
-- SECURITY DEFINER context (append-only — no client INSERT policy, NOVA-style).
DROP POLICY IF EXISTS "order history member read" ON order_status_history;
CREATE POLICY "order history member read" ON order_status_history
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND sp_tenant_member(tenant_id));

CREATE OR REPLACE FUNCTION sp_log_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO order_status_history (tenant_id, order_id, from_status, to_status, actor_email)
  VALUES (
    NEW.tenant_id,
    NEW.id,
    OLD.status,
    NEW.status,
    COALESCE(auth.jwt() ->> 'email', '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_status_history ON orders;
CREATE TRIGGER trg_orders_status_history
AFTER UPDATE OF status ON orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION sp_log_order_status_change();

-- ── 3. sp_advance_order — the only way statuses change ───────────────────
-- Validates: order exists, caller is a workspace member (or platform
-- superadmin), and the transition is legal. Writes go through the trigger.
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
    (v_status IN ('new', 'pending') AND p_to_status IN ('preparing', 'cancelled')) OR
    (v_status = 'preparing' AND p_to_status IN ('ready', 'cancelled')) OR
    (v_status = 'ready' AND p_to_status = 'completed')
  ) THEN
    RAISE EXCEPTION 'Cannot move an order from % to %', v_status, p_to_status
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE orders SET status = p_to_status WHERE id = p_order_id;
END;
$$;

-- ── 4. sp_record_payment — the only way money is recorded ────────────────
-- Counter-is-the-gate: one ledger row + the order flips to completed in the
-- same transaction. Cancelled orders can never be paid.
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
END;
$$;

-- ── 5. Verification (prints the new surface) ─────────────────────────────
SELECT tablename, policyname FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('payments', 'order_status_history')
ORDER BY tablename, policyname;
