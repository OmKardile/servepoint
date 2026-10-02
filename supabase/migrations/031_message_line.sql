-- ═══════════════════════════════════════════════════════════════════════════
-- 031_message_line.sql — ServePoint v5.41.0 "the staff line"
--
-- Migration 004 was titled "Notifications & Messages" and built BOTH halves:
-- notifications (a full screen since v5.0.0) and the team-chat tables —
-- conversations + conversation_messages, RLS'd, seeded with per-tenant
-- "Front of House" and "Kitchen" rooms. The API layer grew fetch/send. But
-- the MESSAGES SURFACE WAS NEVER BUILT — no screen, no route, no wire into
-- the realtime publication. The staff line existed only as tables in the
-- dark. This migration wires the plumbing the chat needs; the screen
-- (MessagesScreen, 5.41.0) is the visible half.
--
--   A. Realtime: conversation_messages + conversations join
--      supabase_realtime, so a message lands on every signed-in terminal
--      the moment it is sent — the cook and the counter see the same line.
--
--   B. Server-truth preview: a trigger on conversation_messages INSERT
--      stamps the parent conversation's last_message + last_message_at.
--      The 004 schema keeps the preview ON THE CONVERSATION ROW, so the
--      list never needs to join or re-sort client-side — and the stamp is
--      server truth (the client's clock is nobody's authority). The seeded
--      rooms ship with NULL previews; the UI reads that honestly as "No
--      messages yet" until the first line is sent.
--
-- Deliberate: a chat message does NOT ring the notifications bell. The
-- Messages screen is its own delivery surface with its own realtime
-- channel — duplicating every line into Notifications would make the bell
-- noise. If the house later wants chat pings, that's a separate decision.
--
-- RLS is untouched: 004's member_all policies on both tables already let
-- any active tenant member read and write the line — that is exactly the
-- point of a staff chat.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── B. the preview stamp — server truth, not the client ────────────────────
CREATE OR REPLACE FUNCTION fn_conversation_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE conversations
  SET last_message = NEW.body,
      last_message_at = clock_timestamp() -- now() freezes at transaction start; the wall-clock instant matters here
  WHERE id = NEW.conversation_id;
  RETURN NULL; -- AFTER trigger; the message row is already written
END;
$$;

DROP TRIGGER IF EXISTS trg_conversation_touch ON conversation_messages;
CREATE TRIGGER trg_conversation_touch
  AFTER INSERT ON conversation_messages
  FOR EACH ROW EXECUTE FUNCTION fn_conversation_touch();

-- ── A. Realtime: the line is heard live ────────────────────────────────────
DO $$
DECLARE
  t TEXT;
  n INT := 0;
BEGIN
  FOREACH t IN ARRAY ARRAY['conversation_messages', 'conversations'] LOOP
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

-- ── Validation — hard-fail if the line is not wired ────────────────────────
DO $$
DECLARE
  v_trig INT;
  v_pub  INT;
BEGIN
  SELECT count(*) INTO v_trig FROM information_schema.triggers
  WHERE trigger_schema = 'public'
    AND trigger_name = 'trg_conversation_touch'
    AND event_object_table = 'conversation_messages';
  SELECT count(*) INTO v_pub FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime'
    AND tablename IN ('conversation_messages', 'conversations');

  IF v_trig <> 1 OR v_pub <> 2 THEN
    RAISE EXCEPTION '031 validation failed: trig=% pub=%', v_trig, v_pub;
  END IF;
  RAISE NOTICE '031 validated: trig=% pub=%', v_trig, v_pub;
END $$;
