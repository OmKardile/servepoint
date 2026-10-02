-- ═══════════════════════════════════════════════════════════════════════════
-- 034_conversation_typing.sql — ServePoint v5.45.0 "the typing line"
--
-- The unread line (033) taught the staff line WHO it talks to; it still
-- can't tell you who is answering RIGHT NOW. You send "refilling the
-- pitcher?" into Kitchen and stare at silence — not the absence of a
-- teammate, just the absence of a signal. This migration adds the signal:
--
--   conversation_typing (conversation_id, user_email) → sender_name, typing_at
--   PK (conversation_id, user_email): one row per typist per room, upserted
--   on a ~2.5s heartbeat while the typist keeps typing, deleted the moment
--   the line is sent (or the room is left).
--
-- Identity: keyed on user_email (the auth identity that survives the
-- roster), NEVER on sender_name — sender_name rides along as a DISPLAY
-- copy only, the same split 033 made (two teammates could share a name;
-- nobody shares an email).
--
-- Truth model — the display window IS the truth: a typist's row is only
-- shown while typing_at > now() - 6s. A heartbeat that stops simply goes
-- stale and disappears from the UI; no cron, no vacuum choreography. The
-- row itself is tiny and self-overwriting (upsert), so stale rows cost
-- one row per (room, typist) and are corrected by the next heartbeat.
--
-- DELIBERATE (vs 033's choice): conversation_typing JOINS the realtime
-- publication — presence is ANNOUNCED, not derived. The whole value is
-- the live ping ("they're typing NOW"); a 30s poll would make the signal
-- a lie. Unlike 033's read-watermarks (reading habits, zero UI need),
-- "who is typing in this room" is exactly what the room is for.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS conversation_typing (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  sender_name TEXT NOT NULL DEFAULT '',
  typing_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_email)
);

CREATE INDEX IF NOT EXISTS idx_conversation_typing_room
  ON conversation_typing(conversation_id, typing_at);

ALTER TABLE conversation_typing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversation_typing_member_all" ON conversation_typing;
CREATE POLICY "conversation_typing_member_all" ON conversation_typing
  FOR ALL USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM tenant_users tu
      WHERE tu.tenant_id = conversation_typing.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role IN ('owner','staff')
        AND tu.is_active
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM tenant_users tu
      WHERE tu.tenant_id = conversation_typing.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role IN ('owner','staff')
        AND tu.is_active
    )
  );

-- Presence announces itself: INSERT (started typing), UPDATE (heartbeat
-- kept it alive) and DELETE (line sent / room left) all ping the socket.
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_typing;

-- ── Verification (fail loudly) ─────────────────────────────────────────────
DO $$
DECLARE
  v_col   INT;
  v_pol   INT;
  v_pub   INT;
  v_owner TEXT;
BEGIN
  SELECT count(*) INTO v_col
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'conversation_typing'
     AND column_name IN ('conversation_id','tenant_id','user_email','sender_name','typing_at');
  IF v_col <> 5 THEN
    RAISE EXCEPTION 'conversation_typing missing columns (found %/5)', v_col;
  END IF;

  SELECT count(*) INTO v_pol
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'conversation_typing'
     AND policyname = 'conversation_typing_member_all';
  IF v_pol <> 1 THEN
    RAISE EXCEPTION 'conversation_typing_member_all policy missing';
  END IF;

  SELECT count(*) INTO v_pub
    FROM pg_publication_tables
   WHERE pubname = 'supabase_realtime'
     AND schemaname = 'public'
     AND tablename = 'conversation_typing';
  IF v_pub <> 1 THEN
    RAISE EXCEPTION 'conversation_typing not on supabase_realtime';
  END IF;

  SELECT tableowner INTO v_owner FROM pg_tables
   WHERE schemaname='public' AND tablename='conversation_typing';
  RAISE NOTICE '034 verified: 5 cols, member_all policy, published. owner=%', v_owner;
END $$;
