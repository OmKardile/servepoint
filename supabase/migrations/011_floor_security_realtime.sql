-- =============================================================================
-- ServePoint (TSOS) — MIGRATION 011: TABLE FLOOR — SECURITY, REALTIME, LIFECYCLE
-- =============================================================================
-- Three jobs:
--
--   A. Close two anonymous-read RLS leaks inherited from the early schema:
--
--      1. dining_tables "Public guest verify dining table by token" used
--         USING (true) — any anon client could read EVERY tenant's tables,
--         INCLUDING each table's permanent qr_token (the secret that mints
--         ephemeral sessions). Now header-gated: a row is only visible to a
--         request that carries that table's qr_token in the
--         "x-table-qr-token" header. Guests verify via the
--         issue_ephemeral_table_session RPC (SECURITY DEFINER), which never
--         needed the open policy in the first place.
--
--      2. table_sessions "Diners view own active session" ended with
--         "OR status = 'active'" — any anon client could read every active
--         session across all tenants (and thus every session_token). The OR
--         is removed; visibility now strictly requires presenting the
--         session's own token via the "x-table-session-token" header, which
--         is what the original comment always claimed the policy did.
--
--   B. Put dining_tables + table_sessions on the supabase_realtime
--      publication (same model as migration 010 did for orders). Realtime
--      enforces the tables' SELECT RLS against the subscriber's JWT, so
--      tenant members only ever receive their own rows; the Floor board and
--      future QR surfaces stay live.
--
--   C. Order ↔ table lifecycle automation. orders.table_id (migration 001)
--      finally gets a moving part: placing/advancing an order that carries a
--      table_id holds that table (status 'occupied', active_order_id set);
--      when the order completes or is cancelled, the table is released.
--      Manual floor actions (reserve, start billing, manual free) stay with
--      the staff — this trigger only reflects order state.
-- =============================================================================

-- ── A1. dining_tables: replace the open public policy ─────────────────────
DROP POLICY IF EXISTS "Public guest verify dining table by token" ON dining_tables;
CREATE POLICY "Public guest verify dining table by token"
ON dining_tables FOR SELECT
TO anon, authenticated
USING (
  qr_token = current_setting('request.headers', true)::json->>'x-table-qr-token'
);

-- ── A2. table_sessions: drop the status='active' leak ─────────────────────
DROP POLICY IF EXISTS "Diners view own active session" ON table_sessions;
CREATE POLICY "Diners view own session by token header"
ON table_sessions FOR SELECT
TO anon, authenticated
USING (
  session_token = current_setting('request.headers', true)::json->>'x-table-session-token'
);

-- Tenant staff keep full management via "Tenant staff manage sessions" (002)
-- and "Tenant full access on own dining_tables" (001) — untouched.

-- ── B. Floor joins the realtime publication ───────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'dining_tables'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE dining_tables;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'table_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE table_sessions;
  END IF;
END $$;

-- ── C. Order ↔ table lifecycle automation ─────────────────────────────────
CREATE OR REPLACE FUNCTION sp_sync_table_on_order()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.table_id IS NULL THEN
    RETURN NEW; -- takeaway / delivery / unlinked dine-in: nothing to hold
  END IF;

  IF NEW.status IN ('completed', 'cancelled') THEN
    -- Order left the rail → release the table only if THIS order still holds it
    -- (a manual free may already have cleared it; never fight the staff).
    UPDATE dining_tables
       SET status = 'available',
           active_order_id = NULL,
           updated_at = now()
     WHERE id = NEW.table_id
       AND active_order_id = NEW.id;
  ELSE
    -- new/pending/preparing/ready all mean "someone is sitting here".
    UPDATE dining_tables
       SET status = 'occupied',
           active_order_id = NEW.id,
           updated_at = now()
     WHERE id = NEW.table_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_orders_sync_table ON orders;
CREATE TRIGGER trg_orders_sync_table
AFTER INSERT OR UPDATE OF table_id, status ON orders
FOR EACH ROW EXECUTE FUNCTION sp_sync_table_on_order();

-- ── Verification (fail loudly — this migration must not silently half-apply)
DO $$
DECLARE
  v_pub  INT;
  v_trg  INT;
  v_pol  INT;
BEGIN
  SELECT count(*) INTO v_pub
  FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename IN ('dining_tables', 'table_sessions');

  SELECT count(*) INTO v_trg
  FROM pg_trigger
  WHERE tgname = 'trg_orders_sync_table'
    AND tgrelid = 'orders'::regclass
    AND NOT tgisinternal;

  SELECT count(*) INTO v_pol
  FROM pg_policies
  WHERE schemaname = 'public'
    AND ((tablename = 'dining_tables'    AND policyname = 'Public guest verify dining table by token')
      OR (tablename = 'table_sessions'   AND policyname = 'Diners view own session by token header'));

  IF v_pub <> 2 OR v_trg <> 1 OR v_pol <> 2 THEN
    RAISE EXCEPTION
      'Migration 011 verification failed: publication=% (want 2), trigger=% (want 1), policies=% (want 2)',
      v_pub, v_trg, v_pol;
  END IF;
END $$;

-- Final state: 001→011. Floor is live, leaks closed, tables follow orders.
