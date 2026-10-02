-- ═══════════════════════════════════════════════════════════════════════════
-- 028_reservations.sql — ServePoint v5.38.0 "the book"
--
-- The floor knew how to hold a table (011's trigger) and how to mark one
-- reserved (5.35.0) — but the PHONE had no ledger. "Saturday 7pm, party of
-- four, window seat" lived on paper scraps and in staff memory. This is the
-- reservation book: one row per promised table, with the guest's name, the
-- hour, and what became of it.
--
--   A. reservations — the book itself.
--      slot_at is the promised ARRIVAL hour (timestamptz; the client writes
--      IST wall-clock with an explicit +05:30 offset — IST has no DST, so
--      the math is exact). status is the whole lifecycle:
--        booked    — the promise stands
--        seated    — the party arrived and took the table
--        no_show   — the hour passed, the seats stayed empty
--        cancelled — the guest called it off (kept on the books, restorable)
--      table_id is OPTIONAL: a booking may promise no specific table yet
--      (the host picks one when the party walks in). ON DELETE SET NULL —
--      retiring a table (5.35.0) must not shred the book's history.
--
--   B. No RPC on purpose: writes are single-row CRUD under the same RLS
--      shape as customers/offers (016). There is no cross-row atomicity to
--      protect — the "seat" flow's optional table flip is a best-effort
--      second write the UI performs honestly (the board's own trigger keeps
--      the truth once the first order lands).
--
--   C. updated_at is stamped by a BEFORE UPDATE trigger — the book keeps
--      its own time, no client is trusted with it.
--
-- RLS: the same two-policy shape as 016/027. Realtime: reservations join
-- supabase_realtime so the book moves live on every terminal.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── A. reservations — the phone promises, on the record ────────────────────
CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  guest_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  party_size INT NOT NULL CHECK (party_size BETWEEN 1 AND 40),
  table_id UUID REFERENCES dining_tables(id) ON DELETE SET NULL,
  slot_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'booked'
    CHECK (status IN ('booked', 'seated', 'no_show', 'cancelled')),
  note TEXT NOT NULL DEFAULT '' CHECK (char_length(note) <= 280),
  created_by_email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reservations_tenant_slot
  ON reservations(tenant_id, slot_at DESC);
CREATE INDEX IF NOT EXISTS idx_reservations_table
  ON reservations(table_id) WHERE table_id IS NOT NULL;

-- ── C. updated_at keeps itself honest ──────────────────────────────────────
-- clock_timestamp(), not now(): now() is frozen at transaction start, so two
-- writes inside one transaction would leave an identical stamp. The book
-- wants the real wall-clock instant of the write.
CREATE OR REPLACE FUNCTION trg_reservations_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservations_touch ON reservations;
CREATE TRIGGER trg_reservations_touch
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION trg_reservations_touch_updated_at();

-- ── B2. who took the promise — server truth, not the client ────────────────
-- 027's RPC stamped created_by_email from auth.jwt(); plain CRUD has no such
-- path, so the stamp lives here: an INSERT trigger that fills the actor's
-- email from the request's JWT (empty only when no session exists at all —
-- which RLS already makes unreachable for tenant writes).
CREATE OR REPLACE FUNCTION trg_reservations_stamp_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.created_by_email IS NULL OR NEW.created_by_email = '' THEN
    NEW.created_by_email := COALESCE(auth.jwt() ->> 'email', '');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservations_creator ON reservations;
CREATE TRIGGER trg_reservations_creator
  BEFORE INSERT ON reservations
  FOR EACH ROW EXECUTE FUNCTION trg_reservations_stamp_creator();

-- ── RLS — same two-policy shape as 016/027 ─────────────────────────────────
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full access on reservations" ON reservations;
CREATE POLICY "Superadmin full access on reservations"
  ON reservations FOR ALL TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

DROP POLICY IF EXISTS "Tenant full access on own reservations" ON reservations;
CREATE POLICY "Tenant full access on own reservations"
  ON reservations FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── Realtime: the book moves live ──────────────────────────────────────────
DO $$
DECLARE
  t TEXT;
  n INT := 0;
BEGIN
  FOREACH t IN ARRAY ARRAY['reservations'] LOOP
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

-- ── Validation — hard-fail if the book is not whole ────────────────────────
DO $$
DECLARE
  v_tables INT;
  v_policies INT;
  v_trig INT;
  v_pub INT;
BEGIN
  SELECT count(*) INTO v_tables FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'reservations';
  SELECT count(*) INTO v_policies FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'reservations';
  SELECT count(*) INTO v_trig FROM information_schema.triggers
  WHERE trigger_schema = 'public' AND event_object_table = 'reservations'
    AND trigger_name IN ('trg_reservations_touch', 'trg_reservations_creator');
  SELECT count(*) INTO v_pub FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime' AND tablename = 'reservations';

  IF v_tables <> 1 OR v_policies <> 2 OR v_trig <> 2 OR v_pub <> 1 THEN
    RAISE EXCEPTION '028 validation failed: tables=% policies=% trig=% pub=%', v_tables, v_policies, v_trig, v_pub;
  END IF;
  RAISE NOTICE '028 validated: tables=% policies=% trig=% pub=%', v_tables, v_policies, v_trig, v_pub;
END $$;
