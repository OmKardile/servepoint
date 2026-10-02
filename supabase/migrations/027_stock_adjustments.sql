-- ═══════════════════════════════════════════════════════════════════════════
-- 027_stock_adjustments.sql — ServePoint v5.36.0 "the shelf keeps its diary"
--
-- The deduction engine (015) records stock OUT when tickets fire. But the
-- shelf has more than one author: deliveries come IN, stock spoils, spills,
-- breaks, and the count needs honest corrections. Until now a restock was a
-- client-side read-modify-write — un-atomic across terminals and invisible
-- to any ledger — and waste had no path at all.
--
--   A. stock_adjustments — append-only diary of every hand-made move:
--        delivery (+) · spoilage / spillage / damage (−) · correction (±).
--      Signed qty: + is stock in, − is stock out. The order engine's
--      stock_deductions stays the sole writer of kitchen consumption —
--      this table never records a sale.
--
--   B. sp_adjust_stock — THE atomic path for every hand-made move.
--      SECURITY DEFINER, tenant-guarded, row-locked (SELECT … FOR UPDATE)
--      so two terminals can never lost-update the shelf. Sign rules are
--      honest per reason: delivery must be positive, waste reasons must be
--      negative, correction may go either way. Negative stock stays allowed
--      (015's precedent — real cafes oversell; the UI shows it red).
--
--   C. restock moves off the client RMW: src/lib/api.ts now calls this RPC
--      with reason 'delivery', so every delivery lands in the same diary.
--
-- RLS: the same two-policy shape as 012/015. Realtime: stock_adjustments
-- joins supabase_realtime so the diary moves live.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── A. stock_adjustments — the hand-made moves, on the record ──────────────
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  qty NUMERIC(12,3) NOT NULL CHECK (qty <> 0),
  reason TEXT NOT NULL CHECK (reason IN ('delivery','spoilage','spillage','damage','correction')),
  note TEXT NOT NULL DEFAULT '',
  created_by_email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_item
  ON stock_adjustments(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_tenant_time
  ON stock_adjustments(tenant_id, created_at DESC);

-- ── RLS — same two-policy shape as 012/015 ─────────────────────────────────
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full access on stock_adjustments" ON stock_adjustments;
CREATE POLICY "Superadmin full access on stock_adjustments"
  ON stock_adjustments FOR ALL TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

DROP POLICY IF EXISTS "Tenant full access on own stock_adjustments" ON stock_adjustments;
CREATE POLICY "Tenant full access on own stock_adjustments"
  ON stock_adjustments FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── B. sp_adjust_stock — one atomic, honest, row-locked move ───────────────
DROP FUNCTION IF EXISTS sp_adjust_stock(UUID, NUMERIC, TEXT, TEXT);
CREATE OR REPLACE FUNCTION sp_adjust_stock(
  p_inventory_item_id UUID,
  p_qty NUMERIC,
  p_reason TEXT,
  p_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant UUID;
  v_reason TEXT;
  v_note TEXT;
  v_qty NUMERIC;
  v_item inventory_items;
  v_row stock_adjustments;
BEGIN
  v_tenant := current_tenant_id();
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'NOT_A_MEMBER' USING ERRCODE = 'P0001';
  END IF;

  v_reason := lower(btrim(COALESCE(p_reason, '')));
  IF v_reason NOT IN ('delivery', 'spoilage', 'spillage', 'damage', 'correction') THEN
    RAISE EXCEPTION 'BAD_REASON' USING ERRCODE = 'P0001';
  END IF;

  IF p_qty IS NULL OR round(p_qty, 3) = 0 THEN
    RAISE EXCEPTION 'BAD_QTY' USING ERRCODE = 'P0001';
  END IF;
  v_qty := round(p_qty, 3);
  IF abs(v_qty) > 1000000 THEN
    RAISE EXCEPTION 'QTY_TOO_LARGE' USING ERRCODE = 'P0001';
  END IF;

  -- honest sign rules: deliveries arrive, waste leaves, corrections may flip
  IF v_reason = 'delivery' AND v_qty < 0 THEN
    RAISE EXCEPTION 'DELIVERY_MUST_BE_POSITIVE' USING ERRCODE = 'P0001';
  END IF;
  IF v_reason IN ('spoilage', 'spillage', 'damage') AND v_qty > 0 THEN
    RAISE EXCEPTION 'WASTE_MUST_BE_NEGATIVE' USING ERRCODE = 'P0001';
  END IF;

  v_note := btrim(COALESCE(p_note, ''));
  IF char_length(v_note) > 280 THEN
    RAISE EXCEPTION 'TOO_LONG' USING ERRCODE = 'P0001';
  END IF;

  -- row lock: two terminals can never lost-update the shelf (the 015 engine
  -- owns sale-time deduction; this lock only orders the hand-made moves)
  SELECT * INTO v_item FROM inventory_items
  WHERE id = p_inventory_item_id AND tenant_id = v_tenant
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO stock_adjustments (tenant_id, inventory_item_id, qty, reason, note, created_by_email)
  VALUES (v_tenant, v_item.id, v_qty, v_reason, v_note, COALESCE(auth.jwt() ->> 'email', ''))
  RETURNING * INTO v_row;

  UPDATE inventory_items
  SET current_stock = current_stock + v_qty,
      updated_at = now()
  WHERE id = v_item.id;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'inventory_item_id', v_row.inventory_item_id,
    'qty', v_row.qty,
    'reason', v_row.reason,
    'note', v_row.note,
    'new_stock', v_item.current_stock + v_qty
  );
END;
$$;

-- counter/authenticated staff only — PUBLIC's default EXECUTE revoked too
-- (the 020 lesson, baked in from the start)
REVOKE EXECUTE ON FUNCTION sp_adjust_stock(UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sp_adjust_stock(UUID, NUMERIC, TEXT, TEXT) TO authenticated;

-- ── Realtime: the diary moves live ─────────────────────────────────────────
DO $$
DECLARE
  t TEXT;
  n INT := 0;
BEGIN
  FOREACH t IN ARRAY ARRAY['stock_adjustments'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
      n := n + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'realtime tables added: %', n;
END $$;

-- ── Validation — hard-fail if the diary is not whole ───────────────────────
DO $$
DECLARE
  v_tables INT;
  v_policies INT;
  v_fn INT;
  v_pub INT;
BEGIN
  SELECT count(*) INTO v_tables FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'stock_adjustments';
  SELECT count(*) INTO v_policies FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'stock_adjustments';
  SELECT count(*) INTO v_fn FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'sp_adjust_stock';
  SELECT count(*) INTO v_pub FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime' AND tablename = 'stock_adjustments';

  IF v_tables <> 1 OR v_policies <> 2 OR v_fn <> 1 OR v_pub <> 1 THEN
    RAISE EXCEPTION '027 validation failed: tables=% policies=% fn=% pub=%', v_tables, v_policies, v_fn, v_pub;
  END IF;
  RAISE NOTICE '027 validated: tables=% policies=% fn=% pub=%', v_tables, v_policies, v_fn, v_pub;
END $$;
