-- =============================================================================
-- ServePoint migration 010 — Realtime for the Kitchen Display System (KDS)
-- Additive · idempotent · no data touched
--
-- WHY: the KDS board (src/components/kitchen/KitchenScreen.tsx) listens to
-- postgres_changes on `orders` + `order_items`, so the kitchen rail refreshes
-- the instant a new sale lands or the counter fires sp_advance_order.
-- Supabase Realtime only broadcasts tables that are members of the
-- `supabase_realtime` publication — by default NO table is a member, so we
-- add both here (guarded, re-running must not error).
--
-- SECURITY: Realtime enforces the table's SELECT RLS policies against the
-- subscriber's JWT — tenant members only ever receive their own tenant's
-- rows (orders/order_items policies come from 001/005, helpers SECURITY
-- DEFINER with pinned search_path).
--
-- REPLICA IDENTITY: left at DEFAULT — UPDATE/INSERT events carry the full
-- new row, which is all the KDS needs (it re-fetches items on any ping).
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'order_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
  END IF;
END
$$;

-- ── Verification (visible when applied through scripts/db-setup.mjs) ────────
DO $$
DECLARE
  n INTEGER;
BEGIN
  SELECT count(*) INTO n FROM pg_publication_tables
   WHERE pubname = 'supabase_realtime'
     AND schemaname = 'public'
     AND tablename IN ('orders', 'order_items');
  IF n <> 2 THEN
    RAISE EXCEPTION 'Realtime publication incomplete: % of 2 tables streaming', n;
  END IF;
END
$$;
