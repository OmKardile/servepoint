-- ═══════════════════════════════════════════════════════════════════════════
-- 030_notification_bells.sql — ServePoint v5.40.0 "the bell actually rings"
--
-- The notifications screen (004) has stood ready since the first build —
-- cards, categories, mark-all-read — but NOTHING ever wrote to it. The bell
-- was a promise with no ringer: "reminders and system alerts will appear
-- here as they happen" was an eternal empty state. This migration wires the
-- bell to three events the ledger already records, so the screen finally
-- tells the truth:
--
--   1. LOW STOCK (category 'system')
--      AFTER UPDATE ON inventory_items, firing ONLY on the CROSSING: the
--      shelf moves from above its reorder line to at-or-under it. Staying
--      below the line never re-fires (no nagging), and a pure config edit
--      that leaves stock above the line stays silent. A shelf that runs dry
--      with no line set (reorder_point 0) still crosses at zero — a stockout
--      is news with or without a policy.
--
--   2. LOW RATING (category 'feedback')
--      AFTER INSERT ON order_feedback WHEN rating <= 2. A delighted guest is
--      nice; an unhappy one is URGENT — service recovery only works the same
--      hour. The order number and the guest's own words ride along so the
--      owner can act without digging.
--
--   3. TODAY'S BOOKING (category 'reminder')
--      AFTER INSERT ON reservations WHEN the slot falls on today (IST — the
--      house timezone; IST has no DST so the date math is exact). The book
--      keeps every future date; the bell only pings the ones that matter
--      before lunch.
--
-- EVERY notification insert is BEST-EFFORT: wrapped so a bell failure can
-- never break the ledger write it announces. The order completes; the stock
-- moves; the booking lands — and if the notification insert fails for any
-- reason, the event still happened and the screens still show it. The bell
-- is a courtesy, never a gate.
--
-- Trigger privilege notes: plain triggers run with the invoker's rights, and
-- every writer here is already a tenant member (staff/owner RLS), so the
-- notifications member_all policy (004) admits the insert. The definer paths
-- (015's deduction RPC, sp_adjust_stock, sp_submit_public_feedback) run as
-- the function owner and bypass RLS outright. Both roads reach the bell.
--
-- Realtime: notifications join supabase_realtime, so the badge and the list
-- move live — the ring is heard on every terminal, not just after a poll.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. the shelf crosses its line ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_notify_low_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Fire only on the crossing: was ABOVE the line, now AT or UNDER it.
  IF OLD.current_stock > OLD.reorder_point
     AND NEW.current_stock <= NEW.reorder_point THEN
    BEGIN
      INSERT INTO notifications (tenant_id, category, title, body)
      VALUES (
        NEW.tenant_id,
        'system',
        CASE WHEN NEW.current_stock <= 0
             THEN 'Out of stock: ' || NEW.name
             ELSE 'Low stock: ' || NEW.name
        END,
        CASE WHEN NEW.current_stock <= 0
             THEN 'The shelf has run dry — ' || trim_scale(NEW.current_stock) || ' ' || NEW.unit ||
                  ' left. Time to reorder before the kitchen feels it.'
             ELSE 'Shelf is down to ' || trim_scale(NEW.current_stock) || ' ' || NEW.unit ||
                  ' — at or under the reorder line (' || trim_scale(NEW.reorder_point) || ' ' || NEW.unit || ').' ||
                  ' Time to reorder.'
        END
      );
    EXCEPTION WHEN OTHERS THEN
      NULL; -- the bell is a courtesy; the ledger move itself must never fail
    END;
  END IF;
  RETURN NULL; -- AFTER trigger; the row is already written
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_low_stock ON inventory_items;
CREATE TRIGGER trg_inventory_low_stock
  AFTER UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION fn_notify_low_stock();

-- ── 2. the unhappy guest ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_notify_low_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_order_no TEXT;
  v_comment  TEXT;
BEGIN
  IF NEW.rating <= 2 THEN
    SELECT order_number INTO v_order_no FROM orders WHERE id = NEW.order_id;
    v_comment := NULLIF(trim(COALESCE(NEW.comment, '')), '');
    BEGIN
      INSERT INTO notifications (tenant_id, category, title, body)
      VALUES (
        NEW.tenant_id,
        'feedback',
        'Low rating: ' || NEW.rating || '★ from a guest',
        CASE
          WHEN v_comment IS NOT NULL THEN
            'Ticket ' || COALESCE(v_order_no, '—') || ' got ' || NEW.rating ||
            ' stars. The guest said: "' || v_comment || '" — worth a follow-up today.'
          ELSE
            'Ticket ' || COALESCE(v_order_no, '—') || ' got ' || NEW.rating ||
            ' stars with no comment — worth a follow-up today.'
        END
      );
    EXCEPTION WHEN OTHERS THEN
      NULL; -- the bell is a courtesy; the rating itself must never fail
    END;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_feedback_low_rating ON order_feedback;
CREATE TRIGGER trg_feedback_low_rating
  AFTER INSERT ON order_feedback
  FOR EACH ROW EXECUTE FUNCTION fn_notify_low_rating();

-- ── 3. tonight's promise ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_notify_today_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_table  TEXT;
  v_hour   TEXT;
BEGIN
  IF NEW.status = 'booked'
     AND (NEW.slot_at AT TIME ZONE 'Asia/Kolkata')::date
         = (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
    SELECT table_number INTO v_table FROM dining_tables WHERE id = NEW.table_id;
    v_hour := ltrim(to_char(NEW.slot_at AT TIME ZONE 'Asia/Kolkata', 'HH12:MI am'), '0');
    BEGIN
      INSERT INTO notifications (tenant_id, category, title, body)
      VALUES (
        NEW.tenant_id,
        'reminder',
        'Booking today: ' || NEW.guest_name || ' ×' || NEW.party_size,
        v_hour || ' — ' || COALESCE(v_table, 'table open') ||
        CASE WHEN NEW.phone <> '' THEN ' — ' || NEW.phone ELSE '' END ||
        CASE WHEN NEW.note <> '' THEN ' — "' || NEW.note || '"' ELSE '' END
      );
    EXCEPTION WHEN OTHERS THEN
      NULL; -- the bell is a courtesy; the booking itself must never fail
    END;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservation_today_reminder ON reservations;
CREATE TRIGGER trg_reservation_today_reminder
  AFTER INSERT ON reservations
  FOR EACH ROW EXECUTE FUNCTION fn_notify_today_booking();

-- ── Realtime: the ring is heard live ───────────────────────────────────────
DO $$
DECLARE
  t TEXT;
  n INT := 0;
BEGIN
  FOREACH t IN ARRAY ARRAY['notifications'] LOOP
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

-- ── Validation — hard-fail if the bell is not wired ────────────────────────
DO $$
DECLARE
  v_trig INT;
  v_pub  INT;
BEGIN
  SELECT count(*) INTO v_trig FROM information_schema.triggers
  WHERE trigger_schema = 'public'
    AND trigger_name IN ('trg_inventory_low_stock', 'trg_feedback_low_rating', 'trg_reservation_today_reminder');
  SELECT count(*) INTO v_pub FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime' AND tablename = 'notifications';

  IF v_trig <> 3 OR v_pub <> 1 THEN
    RAISE EXCEPTION '030 validation failed: trig=% pub=%', v_trig, v_pub;
  END IF;
  RAISE NOTICE '030 validated: trig=% pub=%', v_trig, v_pub;
END $$;
