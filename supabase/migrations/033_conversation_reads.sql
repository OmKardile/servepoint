-- ═══════════════════════════════════════════════════════════════════════════
-- 033_conversation_reads.sql — ServePoint v5.43.0 "the unread line"
--
-- The staff line talks (031) but nothing tells you WHO it talked to: a room
-- with fresh chatter reads exactly like one you already caught up on. 004
-- shipped no per-user read state at all — no members table, no watermark —
-- so "unread" was unknowable. This migration adds the watermark:
--
--   conversation_reads (conversation_id, user_email) → last_read_at
--   PK (conversation_id, user_email): one row per reader per room, upserted
--   the moment the room is opened (and refreshed while it stays open).
--
-- The unread count for a room is then server truth:
--   messages newer than my watermark AND not sent by me.
-- "Me" on a message is sender_name (004's identity for a line — there is no
-- sender FK); the client compares against the session's display name, the
-- same rule that already decides which bubbles are "mine".
--
-- Keys on user_email (the auth identity that survives across the staff
-- roster), NOT on sender_name (a display label two teammates could share).
--
-- DELIBERATE: no realtime publication for conversation_reads — the badge is
-- DERIVED, not announced. A new message already pings the 031 publication;
-- the rooms list refetches counts on that ping and recomputes from this
-- table. Publishing read-watermarks would leak every teammate's reading
-- habits onto the realtime socket for zero UI need.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS conversation_reads (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_email)
);

CREATE INDEX IF NOT EXISTS idx_conversation_reads_user
  ON conversation_reads(tenant_id, user_email);

ALTER TABLE conversation_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversation_reads_member_all" ON conversation_reads;
CREATE POLICY "conversation_reads_member_all" ON conversation_reads
  FOR ALL USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM tenant_users tu
      WHERE tu.tenant_id = conversation_reads.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role IN ('owner','staff')
        AND tu.is_active
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM tenant_users tu
      WHERE tu.tenant_id = conversation_reads.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role IN ('owner','staff')
        AND tu.is_active
    )
  );

-- ── The unread arithmetic, server-side ─────────────────────────────────────
-- One RPC (SECURITY INVOKER — the caller's own RLS guards both tables):
-- messages newer than my watermark AND not mine, per room.
CREATE OR REPLACE FUNCTION fn_conversation_unread(
  p_tenant_id UUID,
  p_user_email TEXT,
  p_sender_name TEXT
)
RETURNS TABLE (conv_id UUID, unread BIGINT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT m.conversation_id AS conv_id, count(*)::bigint AS unread
  FROM conversation_messages m
  LEFT JOIN conversation_reads r
    ON r.conversation_id = m.conversation_id
   AND r.user_email = p_user_email
  WHERE m.tenant_id = p_tenant_id
    AND m.sender_name <> p_sender_name
    AND m.created_at > COALESCE(r.last_read_at, to_timestamp(0))
  GROUP BY m.conversation_id;
$$;

-- ── Validation — hard-fail if the watermark is not trustworthy ─────────────
DO $$
DECLARE
  v_cols  INT;
  v_pk    INT;
  v_pol   INT;
  v_fn    INT;
BEGIN
  SELECT count(*) INTO v_cols FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'conversation_reads'
     AND column_name IN ('conversation_id','tenant_id','user_email','last_read_at');

  SELECT count(*) INTO v_pk FROM information_schema.table_constraints
   WHERE table_schema = 'public' AND table_name = 'conversation_reads'
     AND constraint_type = 'PRIMARY KEY';

  SELECT count(*) INTO v_pol FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'conversation_reads'
     AND policyname = 'conversation_reads_member_all';

  SELECT count(*) INTO v_fn FROM pg_proc
   WHERE proname = 'fn_conversation_unread'
     AND prosrc LIKE '%last_read_at%';

  IF v_cols <> 4 OR v_pk <> 1 OR v_pol <> 1 OR v_fn <> 1 THEN
    RAISE EXCEPTION '033 validation failed: cols=% pk=% pol=% fn=%', v_cols, v_pk, v_pol, v_fn;
  END IF;
  RAISE NOTICE '033 validated: cols=% pk=% pol=% fn=%', v_cols, v_pk, v_pol, v_fn;
END $$;
