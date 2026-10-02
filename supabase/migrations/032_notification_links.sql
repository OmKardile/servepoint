-- ═══════════════════════════════════════════════════════════════════════════
-- 032_notification_links.sql — ServePoint v5.42.0 "the bell's door opens"
--
-- 5.40.0 made the bell ring; this migration gives every ring a DOOR. A bell
-- that announces "Coffee beans is under its line" and then leaves the owner
-- to find Inventory by hand is half the courtesy. Each of the three trigger
-- generators now stamps `link_to` — the in-app section slug its card opens:
--
--   low stock   (system)   → 'inventory'   the shelf that crossed its line
--   low rating  (feedback) → 'bills'       the ticket that took the stars
--   booking     (reminder) → 'floor'       the book that holds the promise
--
-- The column is TEXT, no CHECK whitelist: the client admits a slug only if
-- it is a real section (Object.hasOwn on SECTION_LABELS) and renders no
-- button otherwise — an unknown door is no door, honestly hidden. promotion
-- and message categories stay doorless by design (no writer rings them yet;
-- the staff line has its own surface).
--
-- The two rows already on record (5.40.0's true system + reminder bells)
-- are backfilled with their true sources — their triggers are known, the
-- doors are not a guess.
--
-- DELIBERATE: no RLS change (004's member_all covers the new column, it is
-- a plain column on the same row), no realtime change (notifications are
-- already published — and an is_read UPDATE pings the same channels, which
-- is exactly how the header badge stays honest when a single card is marked
-- read).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. the door column ─────────────────────────────────────────────────────
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link_to TEXT;

-- ── 2. honest backfill — the bells already on record get their true doors ──
UPDATE notifications
SET link_to = CASE category
                WHEN 'system'   THEN 'inventory'
                WHEN 'feedback' THEN 'bills'
                WHEN 'reminder' THEN 'floor'
                ELSE NULL
              END
WHERE link_to IS NULL
  AND category IN ('system', 'feedback', 'reminder');

-- ── 3. the three generators learn the door ─────────────────────────────────

-- 3a. the shelf crosses its line (unchanged semantics, + link_to)
CREATE OR REPLACE FUNCTION fn_notify_low_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Fire only on the crossing: was ABOVE the line, now AT or UNDER it.
  IF OLD.current_stock > OLD.reorder_point
     AND NEW.current_stock <= NEW.reorder_point THEN
    BEGIN
      INSERT INTO notifications (tenant_id, category, title, body, link_to)
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
        END,
        'inventory'
      );
    EXCEPTION WHEN OTHERS THEN
      NULL; -- the bell is a courtesy; the ledger move itself must never fail
    END;
  END IF;
  RETURN NULL; -- AFTER trigger; the row is already written
END;
$$;

-- 3b. the unhappy guest (unchanged semantics, + link_to)
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
      INSERT INTO notifications (tenant_id, category, title, body, link_to)
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
        END,
        'bills'
      );
    EXCEPTION WHEN OTHERS THEN
      NULL; -- the bell is a courtesy; the rating itself must never fail
    END;
  END IF;
  RETURN NULL;
END;
$$;

-- 3c. tonight's promise (unchanged semantics, + link_to)
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
      INSERT INTO notifications (tenant_id, category, title, body, link_to)
      VALUES (
        NEW.tenant_id,
        'reminder',
        'Booking today: ' || NEW.guest_name || ' ×' || NEW.party_size,
        v_hour || ' — ' || COALESCE(v_table, 'table open') ||
        CASE WHEN NEW.phone <> '' THEN ' — ' || NEW.phone ELSE '' END ||
        CASE WHEN NEW.note <> '' THEN ' — "' || NEW.note || '"' ELSE '' END,
        'floor'
      );
    EXCEPTION WHEN OTHERS THEN
      NULL; -- the bell is a courtesy; the booking itself must never fail
    END;
  END IF;
  RETURN NULL;
END;
$$;

-- ── Validation — hard-fail if a door is missing ────────────────────────────
DO $$
DECLARE
  v_col   INT;
  v_trig  INT;
  v_fn    INT;
  v_blind INT;
  v_pub   INT;
BEGIN
  SELECT count(*) INTO v_col FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'notifications'
     AND column_name = 'link_to' AND data_type = 'text';

  SELECT count(*) INTO v_trig FROM information_schema.triggers
   WHERE trigger_schema = 'public'
     AND trigger_name IN ('trg_inventory_low_stock', 'trg_feedback_low_rating', 'trg_reservation_today_reminder');

  SELECT count(*) INTO v_fn FROM pg_proc
   WHERE proname IN ('fn_notify_low_stock', 'fn_notify_low_rating', 'fn_notify_today_booking')
     AND prosrc LIKE '%link_to%';

  -- every bell-written row must carry its door
  SELECT count(*) INTO v_blind FROM notifications
   WHERE category IN ('system', 'feedback', 'reminder') AND link_to IS NULL;

  SELECT count(*) INTO v_pub FROM pg_publication_tables
   WHERE pubname = 'supabase_realtime' AND tablename = 'notifications';

  IF v_col <> 1 OR v_trig <> 3 OR v_fn <> 3 OR v_blind <> 0 OR v_pub <> 1 THEN
    RAISE EXCEPTION '032 validation failed: col=% trig=% fn=% blind=% pub=%',
      v_col, v_trig, v_fn, v_blind, v_pub;
  END IF;
  RAISE NOTICE '032 validated: col=% trig=% fn=% blind=% pub=%',
    v_col, v_trig, v_fn, v_blind, v_pub;
END $$;
