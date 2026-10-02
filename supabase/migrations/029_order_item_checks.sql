-- ═══════════════════════════════════════════════════════════════════════════
-- 029_order_item_checks.sql — ServePoint v5.39.0 "fire as you go"
--
-- The pass shows the cook WHAT to make, but not WHAT'S DONE. A four-line
-- ticket during a rush is held in the cook's head: which flatties have
-- dropped, which muffin is plated. This gives every ticket line its own
-- honest tick: checked_at, a timestamp — not a boolean. When it was fired
-- matters as much as whether.
--
--   A. order_items.checked_at — NULL = waiting on the line, timestamp =
--      fired and off the cook's mind. Plain RLS-scoped CRUD on purpose:
--      order_items already carries "Tenant full access on own order_items"
--      (007), so staff writes are tenant-gated without a new policy.
--
--   B. One guard keeps the ledger honest: a line can only be checked while
--      its ticket is LIVE (pending / preparing / ready). Ticking a line on
--      a cancelled or completed ticket is noise, and the DB refuses it.
--      Un-checking (checked_at → NULL) is always allowed — the book
--      forgives a mis-tap, same spirit as 5.38.0's book.
--
-- No RLS change, no realtime change: order_items already rides
-- supabase_realtime (010), so every terminal's rail refreshes on the write.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── A. the tick ─────────────────────────────────────────────────────────────
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ;

-- ── B. the guard — tick only on live tickets ───────────────────────────────
CREATE OR REPLACE FUNCTION trg_order_item_check_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF NEW.checked_at IS NOT NULL AND (OLD.checked_at IS NULL OR OLD.checked_at IS DISTINCT FROM NEW.checked_at) THEN
    SELECT status INTO v_status FROM orders WHERE id = NEW.order_id;
    IF v_status IS NULL OR lower(v_status) IN ('cancelled', 'completed') THEN
      RAISE EXCEPTION 'ORDER_NOT_ACTIVE' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_item_check_guard_trg ON order_items;
CREATE TRIGGER trg_order_item_check_guard_trg
  BEFORE UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION trg_order_item_check_guard();

-- ── Validation — hard-fail if the tick is not whole ─────────────────────────
DO $$
DECLARE
  v_col INT;
  v_trig INT;
BEGIN
  SELECT count(*) INTO v_col FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'order_items'
    AND column_name = 'checked_at' AND data_type = 'timestamp with time zone';
  SELECT count(*) INTO v_trig FROM pg_trigger
  WHERE tgrelid = 'order_items'::regclass
    AND tgname = 'trg_order_item_check_guard_trg' AND NOT tgisinternal;

  IF v_col <> 1 OR v_trig <> 1 THEN
    RAISE EXCEPTION '029 validation failed: col=% trig=%', v_col, v_trig;
  END IF;
  RAISE NOTICE '029 validated: col=% trig=%', v_col, v_trig;
END $$;
