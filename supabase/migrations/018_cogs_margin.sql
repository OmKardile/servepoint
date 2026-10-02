-- ═══════════════════════════════════════════════════════════════════════════
-- 018_cogs_margin.sql — ServePoint v5.9.0 "the menu knows what it costs"
--
-- NOVA parity, final item: COGS wiring — the inventory shelf (015) finally
-- talks to the money screens (Reports + Close-out). NO new tables, NO
-- triggers, NO engine: the deduction ledger stays the single write path
-- (SINGLE-ENGINE RULE in 015 untouched); these are two read-only views that
-- PRICE what the recipes consume.
--
--   A. v_order_cogs     — one row per order with its ingredient cost:
--                         Σ over non-null item lines of
--                         recipe_lines.qty_per_serve × order_items.qty
--                         × inventory_items.cost_per_unit.
--                         Cost basis is CURRENT cost_per_unit (there is no
--                         cost-history table — stated honestly in the UI).
--   B. v_item_unit_cost — per menu item: what ONE serve costs in ingredients.
--                         Reports joins it to item lines for per-item margin.
--
-- Money basis (agreed definition, mirrored in the UI copy):
--   margin is computed on PAID, non-cancelled tickets only — margin cannot
--   be banked on money not collected. Net revenue (ex-GST, after discount)
--   − COGS = gross margin. Unpaid tickets still show their COGS in
--   Close-out's day card so the kitchen's burn is visible before the cash is.
--
-- Honest limitation (documented in both screens): recipes model the BASE
-- item; variant size deltas and add-on consumption are not priced yet.
--
-- RLS: both views are security_invoker = on (same shape as v_customer_stats
-- in 016) — every read flows through the caller's own tenant policies, no
-- SECURITY DEFINER surface added. Realtime: not needed (read on load).
-- Idempotent: CREATE OR REPLACE + membership-checked verification.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── A. per-order ingredient cost ───────────────────────────────────────────
CREATE OR REPLACE VIEW v_order_cogs
WITH (security_invoker = on) AS
SELECT
  o.tenant_id,
  o.id                              AS order_id,
  o.order_number,
  o.created_at,
  o.status,
  o.payment_status,
  o.subtotal,
  o.discount_amount,
  o.tax_amount,
  o.total,
  COALESCE(c.cogs, 0)::NUMERIC(12,2) AS cogs
FROM orders o
LEFT JOIN (
  SELECT oi.order_id,
         SUM(rl.qty_per_serve * oi.qty * ii.cost_per_unit) AS cogs
  FROM order_items oi
  JOIN recipe_lines rl
    ON rl.menu_item_id = oi.menu_item_id
  JOIN inventory_items ii
    ON ii.id = rl.inventory_item_id
  WHERE oi.menu_item_id IS NOT NULL
  GROUP BY oi.order_id
) c ON c.order_id = o.id;

-- ── B. per-menu-item unit ingredient cost ──────────────────────────────────
CREATE OR REPLACE VIEW v_item_unit_cost
WITH (security_invoker = on) AS
SELECT
  rl.tenant_id,
  rl.menu_item_id,
  SUM(rl.qty_per_serve * ii.cost_per_unit)::NUMERIC(12,2) AS unit_cost
FROM recipe_lines rl
JOIN inventory_items ii
  ON ii.id = rl.inventory_item_id
GROUP BY rl.tenant_id, rl.menu_item_id;

-- ── Verification — hard-fail if the views are not whole ────────────────────
DO $$
DECLARE
  n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM pg_views
  WHERE schemaname = 'public'
    AND viewname IN ('v_order_cogs', 'v_item_unit_cost');
  IF n <> 2 THEN
    RAISE EXCEPTION '018: expected 2 views, found %', n;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace
    WHERE s.nspname = 'public' AND c.relname = 'v_order_cogs'
      AND c.reloptions::text LIKE '%security_invoker=on%'
  ) THEN
    RAISE EXCEPTION '018: v_order_cogs is not security_invoker';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace
    WHERE s.nspname = 'public' AND c.relname = 'v_item_unit_cost'
      AND c.reloptions::text LIKE '%security_invoker=on%'
  ) THEN
    RAISE EXCEPTION '018: v_item_unit_cost is not security_invoker';
  END IF;

  RAISE NOTICE '018 OK: v_order_cogs + v_item_unit_cost, both security_invoker';
END $$;
