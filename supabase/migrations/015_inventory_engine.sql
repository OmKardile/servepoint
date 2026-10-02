-- ═══════════════════════════════════════════════════════════════════════════
-- 015_inventory_engine.sql — ServePoint v5.4.0 "the stock moves with the pan"
--
-- NOVA inventory parity: the AUTOMATIC deduction engine on top of the
-- inventory shelf. NOTE ON PROVENANCE: `inventory_items` (location_id,
-- current_stock, reorder_point, cost_per_unit — the "SKU shelf") was applied
-- to the live cloud by a parallel round directly from the CLI; this migration
-- ADOPTS that table as canonical and adds the missing moving parts:
--
--   A. recipe_lines     — menu_item → ingredient consumption per serve
--   B. stock_deductions — an append-only LEDGER of every deduction, keyed
--                         UNIQUE (order_id, inventory_item_id): the engine can
--                         never double-deduct a ticket, however many times the
--                         status replays. Stock going negative is allowed (real
--                         cafes oversell) — the UI shows it red.
--   C. trg_orders_deduct_stock — fires on orders.status → 'preparing' (and
--                         only on that transition), deducts recipe × qty in a
--                         single CTE statement (insert ledger rows ON CONFLICT
--                         DO NOTHING, then apply exactly the rows it inserted)
--                         against inventory_items.current_stock.
--
-- ⚠️ SINGLE-ENGINE RULE: trg_orders_deduct_stock is THE deduction path. Any
-- other code that decrements current_stock must check this trigger exists
-- first — double-deduction burns real stock.
--
-- Deduction timing (NOVA): "preparing" is when stock is genuinely consumed —
-- not at placement (counter declines would phantom-burn stock), not at
-- completion (the food already left). Ledger rows keep the audit trail.
--
-- RLS: the same two-policy shape as 012 for the two NEW tables. The
-- inventory_items policies already exist (applied out-of-band) — this file
-- does NOT touch them.
-- Realtime: stock_deductions joins supabase_realtime (inventory_items is
-- already on it from the out-of-band apply); the board moves live.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── A. recipe_lines — what one serve of a menu item consumes ───────────────
CREATE TABLE IF NOT EXISTS recipe_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  qty_per_serve NUMERIC(12,3) NOT NULL CHECK (qty_per_serve > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (menu_item_id, inventory_item_id)
);
CREATE INDEX IF NOT EXISTS idx_recipe_lines_item ON recipe_lines(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_recipe_lines_inventory ON recipe_lines(inventory_item_id);

-- ── B. stock_deductions — the append-only ledger (idempotency key lives here)
CREATE TABLE IF NOT EXISTS stock_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  qty NUMERIC(12,3) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, inventory_item_id)
);
CREATE INDEX IF NOT EXISTS idx_stock_deductions_order ON stock_deductions(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_deductions_tenant_time
  ON stock_deductions(tenant_id, created_at DESC);

-- ── RLS — same two-policy shape as 012, for the two NEW tables only ────────
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['recipe_lines', 'stock_deductions'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($f$
      DROP POLICY IF EXISTS "Superadmin full access on %I" ON %I
    $f$, t, t);
    EXECUTE format($f$
      CREATE POLICY "Superadmin full access on %I"
      ON %I FOR ALL TO authenticated
      USING (is_superadmin())
      WITH CHECK (is_superadmin())
    $f$, t, t);
    EXECUTE format($f$
      DROP POLICY IF EXISTS "Tenant full access on own %I" ON %I
    $f$, t, t);
    EXECUTE format($f$
      CREATE POLICY "Tenant full access on own %I"
      ON %I FOR ALL TO authenticated
      USING (tenant_id = current_tenant_id())
      WITH CHECK (tenant_id = current_tenant_id())
    $f$, t, t);
  END LOOP;
END $$;

-- ── C. the deduction engine ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sp_deduct_stock_on_preparing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only the moment the kitchen starts the ticket.
  IF NEW.status IS DISTINCT FROM 'preparing' THEN
    RETURN NEW;
  END IF;

  -- One atomic statement: insert ledger rows (UNIQUE(order, ingredient)
  -- makes replays no-ops), then apply exactly the rows THIS statement
  -- inserted. Idempotent by construction.
  WITH ins AS (
    INSERT INTO stock_deductions (tenant_id, order_id, menu_item_id, inventory_item_id, qty)
    SELECT o.tenant_id,
           o.id,
           oi.menu_item_id,
           rl.inventory_item_id,
           rl.qty_per_serve * oi.qty
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id AND oi.menu_item_id IS NOT NULL
    JOIN recipe_lines rl ON rl.menu_item_id = oi.menu_item_id
    WHERE o.id = NEW.id
    ON CONFLICT (order_id, inventory_item_id) DO NOTHING
    RETURNING inventory_item_id, qty
  )
  UPDATE inventory_items ii
  SET current_stock = ii.current_stock - ins.qty,
      updated_at = now()
  FROM ins
  WHERE ins.inventory_item_id = ii.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_deduct_stock ON orders;
CREATE TRIGGER trg_orders_deduct_stock
AFTER UPDATE OF status ON orders
FOR EACH ROW
WHEN (NEW.status = 'preparing' AND OLD.status IS DISTINCT FROM 'preparing')
EXECUTE FUNCTION sp_deduct_stock_on_preparing();

-- ── Realtime: the stock board moves live ───────────────────────────────────
DO $$
DECLARE
  t TEXT;
  n INT := 0;
BEGIN
  FOREACH t IN ARRAY ARRAY['inventory_items', 'stock_deductions'] LOOP
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

-- ── Validation — hard-fail if the engine is not whole ──────────────────────
DO $$
DECLARE
  v_tables INT;
  v_trg INT;
  v_pub INT;
BEGIN
  SELECT count(*) INTO v_tables FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('recipe_lines', 'stock_deductions');
  SELECT count(*) INTO v_trg FROM pg_trigger
  WHERE tgname = 'trg_orders_deduct_stock' AND NOT tgisinternal;
  SELECT count(*) INTO v_pub FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime'
    AND tablename IN ('inventory_items', 'stock_deductions');

  IF v_tables <> 2 OR v_trg <> 1 OR v_pub <> 2 THEN
    RAISE EXCEPTION '015 validation failed: tables=% trigger=% pub=%', v_tables, v_trg, v_pub;
  END IF;
  RAISE NOTICE '015 validated: tables=% trigger=% pub=%', v_tables, v_trg, v_pub;
END $$;
