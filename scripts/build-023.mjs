// Task 62 — build migration 023 by splicing the session gate into 022's
// sp_create_public_order body (byte-true splice, exact anchors, loud failure).
// Run: node scripts/build-023.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('supabase/migrations/022_public_order_offer_fix.sql', 'utf8');

// extract the function text exactly
const start = src.indexOf('CREATE OR REPLACE FUNCTION sp_create_public_order');
const endMarker = '$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;';
const end = src.indexOf(endMarker, start);
if (start < 0 || end < 0) throw new Error('anchor: function bounds not found');
let fn = src.slice(start, end + endMarker.length);

// A. signature gains p_session_token
const sigA = `  p_offer_id UUID DEFAULT NULL
)`;
const sigB = `  p_offer_id UUID DEFAULT NULL,
  p_session_token TEXT DEFAULT NULL
)`;
if (!fn.includes(sigA)) throw new Error('anchor A (signature) not found');
fn = fn.replace(sigA, sigB);

// B. DECLARE gains v_session
const decA = `DECLARE
  v_table RECORD;
  v_existing RECORD;`;
const decB = `DECLARE
  v_table RECORD;
  v_existing RECORD;
  v_session RECORD;`;
if (!fn.includes(decA)) throw new Error('anchor B (declare) not found');
fn = fn.replace(decA, decB);

// C. gate before the EMPTY_ORDER check
const gateA = `  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN`;
const gate = `  -- 1.5 Session gate (023) — 002's design intent, finally wired: if the guest
  --     PRESENTS an ephemeral session token, that token must be alive. No token
  --     at all = proceed exactly as before (the printed QR remains the table's
  --     ordering capability; see 012's 'separate capabilities' note).
  IF p_session_token IS NOT NULL AND length(trim(p_session_token)) > 0 THEN
    SELECT ts.id, ts.status, ts.expires_at, ts.table_id
      INTO v_session
      FROM table_sessions ts
     WHERE ts.session_token = trim(p_session_token);
    IF NOT FOUND THEN
      RETURN jsonb_build_object('is_valid', false, 'error', 'SESSION_CLOSED', 'reason', 'unknown',
        'message', 'Your table session could not be verified. Scan the table QR to continue.');
    END IF;
    IF v_session.table_id <> v_table.table_id THEN
      RETURN jsonb_build_object('is_valid', false, 'error', 'SESSION_CLOSED', 'reason', 'table_mismatch',
        'message', 'This session belongs to another table. Scan the sticker on your table.');
    END IF;
    IF v_session.status <> 'active' THEN
      RETURN jsonb_build_object('is_valid', false, 'error', 'SESSION_CLOSED', 'reason', v_session.status,
        'message', 'This session is no longer open. Scan the table QR to continue.');
    END IF;
    IF v_session.expires_at <= now() THEN
      UPDATE table_sessions SET status = 'expired'
       WHERE id = v_session.id AND status = 'active';
      RETURN jsonb_build_object('is_valid', false, 'error', 'SESSION_CLOSED', 'reason', 'expired',
        'message', 'Your 10-minute table session ended. Scan the table QR to continue.');
    END IF;
    -- the order itself is the strongest activity signal the trail can show
    UPDATE table_sessions SET last_activity_at = now() WHERE id = v_session.id;
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN`;
if (!fn.includes(gateA)) throw new Error('anchor C (gate position) not found');
fn = fn.replace(gateA, gate);

const header = `-- ═════════════════════════════════════════════════════════════════════════════
-- ServePoint MIGRATION 023: SESSION GATE + STAFF CUT  (Task 62, v5.24.0)
-- ═════════════════════════════════════════════════════════════════════════════
-- The ephemeral 10-minute table session finally gets teeth:
--
--   1. sp_verify_table_session(token) — tiny SECURITY DEFINER read for the
--      guest ribbon's 30s re-verify poll (002's RLS hides table_sessions
--      from anon). Also converges the status column toward the clock on
--      natural expiry (same hygiene as 002's own verify RPC).
--
--   2. sp_create_public_order grows an OPTIONAL p_session_token (DEFAULT
--      NULL): when a token IS presented it must be alive — active status,
--      matching table, unexpired clock, else SESSION_CLOSED. NULL proceeds
--      exactly as 017/022 did, so the printed QR stays the table's ordering
--      capability (012's 'separate capabilities' design is preserved, not
--      replaced). What the staff cut achieves honestly: it kills the
--      PRESENTED window (guest's open menu locks, token dies for orders).
--      It does NOT lock the table — a fresh scan of the printed sticker
--      reopens. Old overload dropped; one 9-arg overload remains, grants
--      unchanged (anon + authenticated).
--
-- Body otherwise identical to 022 (offer-title fix included).
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. The ribbon's re-verify RPC (anon-callable, SECURITY DEFINER) ─────────
CREATE OR REPLACE FUNCTION sp_verify_table_session(p_session_token TEXT)
RETURNS JSONB AS $$
DECLARE
  v_session RECORD;
BEGIN
  IF p_session_token IS NULL OR length(trim(p_session_token)) = 0 THEN
    RETURN jsonb_build_object('is_valid', false, 'reason', 'missing');
  END IF;

  SELECT ts.status, ts.expires_at
    INTO v_session
    FROM table_sessions ts
   WHERE ts.session_token = trim(p_session_token);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('is_valid', false, 'reason', 'unknown');
  END IF;
  IF v_session.status <> 'active' THEN
    RETURN jsonb_build_object('is_valid', false, 'reason', v_session.status);
  END IF;
  IF v_session.expires_at <= now() THEN
    UPDATE table_sessions SET status = 'expired'
     WHERE session_token = trim(p_session_token) AND status = 'active';
    RETURN jsonb_build_object('is_valid', false, 'reason', 'expired');
  END IF;
  RETURN jsonb_build_object('is_valid', true, 'reason', 'live',
    'remaining_seconds', GREATEST(0, EXTRACT(epoch FROM (v_session.expires_at - now()))::INT));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── 2. The order RPC: drop old overloads, recreate with the optional gate ───
DROP FUNCTION IF EXISTS sp_create_public_order(TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS sp_create_public_order(TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, UUID);

${fn}

GRANT EXECUTE ON FUNCTION sp_create_public_order(TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sp_verify_table_session(TEXT) TO anon, authenticated;

-- ── 3. Verification (hard failure on any broken expectation) ────────────────
DO $$
DECLARE
  v_overloads INT;
  v_has_token BOOLEAN;
BEGIN
  SELECT count(*) INTO v_overloads
    FROM pg_proc
   WHERE proname = 'sp_create_public_order' AND pronamespace = 'public'::regnamespace;
  IF v_overloads <> 1 THEN
    RAISE EXCEPTION '023 verification failed: expected exactly 1 sp_create_public_order overload, found %', v_overloads;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc
     WHERE proname = 'sp_create_public_order' AND pronamespace = 'public'::regnamespace
       AND 'p_session_token' = ANY(proargnames)
  ) INTO v_has_token;
  IF NOT v_has_token THEN
    RAISE EXCEPTION '023 verification failed: sp_create_public_order missing p_session_token';
  END IF;

  IF to_regprocedure('public.sp_verify_table_session(text)') IS NULL THEN
    RAISE EXCEPTION '023 verification failed: sp_verify_table_session missing';
  END IF;

  IF NOT has_function_privilege('anon', 'public.sp_verify_table_session(text)', 'EXECUTE') THEN
    RAISE EXCEPTION '023 verification failed: anon lacks EXECUTE on sp_verify_table_session';
  END IF;
  IF NOT has_function_privilege('anon', 'public.sp_create_public_order(text,text,jsonb,text,text,text,text,uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION '023 verification failed: anon lacks EXECUTE on the 9-arg overload';
  END IF;
END $$;
`;

writeFileSync('supabase/migrations/023_session_gate_staff_cut.sql', header);
console.log('WROTE supabase/migrations/023_session_gate_staff_cut.sql');
console.log('function lines:', fn.split('\n').length, '| total lines:', header.split('\n').length);
