-- ═══════════════════════════════════════════════════════════════════════════
-- 035_staff_presence.sql — ServePoint v5.46.0 "the line's people"
--
-- The typing line (034) answers "who is answering THIS room right now";
-- it can't answer the quieter question the rooms pane actually starts
-- with: is anyone even HERE? You open Messages at 7 am, the thread reads
-- silence, and you can't tell "nobody has seen this" from "nobody is at
-- the app". This migration adds the signal under the typing signal:
--
--   staff_presence (user_email, tenant_id) → sender_name, last_seen_at
--   PK (user_email, tenant_id): one row per member per tenant, upserted
--   on a ~45s heartbeat for as long as the member has the app open.
--   Presence is APP-level, not room-level — "on the line" means "at the
--   counter", and a café team is small enough that one strip says it all.
--
-- Identity: keyed on user_email (033/034's split — the auth identity that
-- survives the roster), sender_name rides along as a DISPLAY copy only.
--
-- Truth model — the same window-is-the-truth contract as 034, stretched
-- to presence scale: a member counts as online while last_seen_at >
-- now() - 120s. A 45s heartbeat tolerates two missed beats before the
-- dot honestly goes gray; a closed tab simply goes stale — no sign-out
-- retract choreography, no cron, no vacuum. Stale rows cost one row per
-- (member, tenant) and are corrected by the next heartbeat.
--
-- DELIBERATE (034's rule holds): staff_presence JOINS the realtime
-- publication — being here is ANNOUNCED, not derived. The whole value is
-- the dot flipping green the moment a teammate opens the app; a 30s poll
-- would make "right now" a lie.
--
-- Who is on the strip: the roster comes from tenant_users (003's
-- member model, already member-readable FOR SELECT in 001 §15), LEFT
-- JOINed to this ledger by email. Members who have never opened the app
-- since 035 simply have no row — rendered as "not seen yet", never
-- fabricated.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS staff_presence (
  user_email TEXT NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL DEFAULT '',
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_email, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_presence_tenant
  ON staff_presence(tenant_id, last_seen_at);

ALTER TABLE staff_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_presence_member_all" ON staff_presence;
CREATE POLICY "staff_presence_member_all" ON staff_presence
  FOR ALL USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM tenant_users tu
      WHERE tu.tenant_id = staff_presence.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role IN ('owner','staff')
        AND tu.is_active
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM tenant_users tu
      WHERE tu.tenant_id = staff_presence.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role IN ('owner','staff')
        AND tu.is_active
    )
  );

-- Presence announces itself: INSERT (first open), UPDATE (heartbeat) and
-- DELETE (leave/cleanup) all ping the socket. Guarded add keeps the file
-- idempotent — a re-apply must not error on the publication.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'staff_presence'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE staff_presence';
  END IF;
END $$;

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
     AND table_name = 'staff_presence'
     AND column_name IN ('user_email','tenant_id','sender_name','last_seen_at');
  IF v_col <> 4 THEN
    RAISE EXCEPTION 'staff_presence missing columns (found %/4)', v_col;
  END IF;

  SELECT count(*) INTO v_pol
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'staff_presence'
     AND policyname = 'staff_presence_member_all';
  IF v_pol <> 1 THEN
    RAISE EXCEPTION 'staff_presence_member_all policy missing';
  END IF;

  SELECT count(*) INTO v_pub
    FROM pg_publication_tables
   WHERE pubname = 'supabase_realtime'
     AND schemaname = 'public'
     AND tablename = 'staff_presence';
  IF v_pub <> 1 THEN
    RAISE EXCEPTION 'staff_presence not on supabase_realtime';
  END IF;

  SELECT tableowner INTO v_owner FROM pg_tables
   WHERE schemaname='public' AND tablename='staff_presence';
  RAISE NOTICE '035 verified: 4 cols, member_all policy, published. owner=%', v_owner;
END $$;
