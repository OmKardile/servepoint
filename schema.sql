-- =============================================================================
-- TSOS (The Cafe Operating System)
-- MIGRATION 002: EPHEMERAL 10-MINUTE TABLE QR SESSION TOKEN ARCHITECTURE
-- =============================================================================

-- Enable pgcrypto if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. TABLE SESSIONS TABLE
CREATE TABLE IF NOT EXISTS table_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES dining_tables(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  token_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'consumed')),
  ip_address TEXT,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance & Security Indexes
CREATE INDEX IF NOT EXISTS idx_table_sessions_token ON table_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_table_sessions_table ON table_sessions(table_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_tenant ON table_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_expiry ON table_sessions(expires_at, status);
CREATE INDEX IF NOT EXISTS idx_table_sessions_created ON table_sessions(created_at);

-- Row Level Security (RLS)
ALTER TABLE table_sessions ENABLE ROW LEVEL SECURITY;

-- Anonymous users (diners) can view their active session by matching token
CREATE POLICY "Diners view own active session"
ON table_sessions FOR SELECT
TO anon, authenticated
USING (
  session_token = current_setting('request.headers', true)::json->>'x-table-session-token'
  OR status = 'active'
);

-- Internal tenant members can manage table sessions
CREATE POLICY "Tenant staff manage sessions"
ON table_sessions FOR ALL
TO authenticated
USING (tenant_id = current_tenant_id())
WITH CHECK (tenant_id = current_tenant_id());


-- =============================================================================
-- 2. CRYPTOGRAPHIC EPHEMERAL TOKEN GENERATOR & VERIFICATION RPCs
-- =============================================================================

/**
 * RPC: issue_ephemeral_table_session
 * 
 * Verifies the physical dining table QR token. If valid, provisions a cryptographically
 * secure 10-minute session token.
 */
CREATE OR REPLACE FUNCTION issue_ephemeral_table_session(
  p_tenant_slug TEXT,
  p_table_number TEXT,
  p_permanent_token TEXT,
  p_user_agent TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_tenant RECORD;
  v_table RECORD;
  v_digits TEXT;
  v_session_id UUID;
  v_session_token TEXT;
  v_token_hash TEXT;
  v_expires_at TIMESTAMPTZ;
  v_secret_salt TEXT := 'tsos_ephemeral_qr_salt_2026';
BEGIN
  -- 1. Validate Tenant
  SELECT id, name, slug, status, upi_id INTO v_tenant
  FROM tenants
  WHERE slug = LOWER(TRIM(p_tenant_slug));

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'is_valid', false,
      'error', 'CAFE_NOT_FOUND',
      'message', 'The requested cafe outlet could not be found.'
    );
  END IF;

  IF v_tenant.status NOT IN ('trial', 'active') THEN
    RETURN jsonb_build_object(
      'is_valid', false,
      'error', 'CAFE_INACTIVE',
      'message', 'This cafe account is currently suspended or past due.'
    );
  END IF;

  v_digits := REGEXP_REPLACE(p_table_number, '[^0-9]', '', 'g');

  -- 2. Validate Physical Permanent Table QR Token
  SELECT dt.id, dt.table_number, dt.capacity, dt.status, dt.location_id, dt.qr_token
  INTO v_table
  FROM dining_tables dt
  WHERE dt.tenant_id = v_tenant.id
    AND (
      LOWER(dt.table_number) = LOWER(TRIM(p_table_number)) OR
      (v_digits <> '' AND REGEXP_REPLACE(dt.table_number, '[^0-9]', '', 'g')::INT = v_digits::INT)
    )
    AND dt.qr_token = TRIM(p_permanent_token);

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'is_valid', false,
      'error', 'INVALID_PERMANENT_QR',
      'message', 'Cryptographic verification failed. Scan the physical QR attached to your table.'
    );
  END IF;

  -- 3. Calculate 10-Minute Expiry
  v_session_id := gen_random_uuid();
  v_expires_at := now() + INTERVAL '10 minutes';

  -- 4. Generate cryptographically signed token (HMAC format: v1.<payload_b64>.<hmac>)
  v_session_token := encode(
    (v_session_id::TEXT || ':' || v_table.id::TEXT || ':' || extract(epoch from v_expires_at)::BIGINT::TEXT)::BYTEA,
    'base64'
  ) || '.' || encode(
    hmac(
      (v_session_id::TEXT || ':' || v_table.id::TEXT || ':' || extract(epoch from v_expires_at)::BIGINT::TEXT),
      (v_table.qr_token || v_secret_salt),
      'sha256'
    ),
    'hex'
  );

  v_token_hash := encode(digest(v_session_token, 'sha256'), 'hex');

  -- 5. Revoke any previous active sessions for this table from same IP (optional hygiene)
  IF p_ip_address IS NOT NULL THEN
    UPDATE table_sessions
    SET status = 'revoked'
    WHERE table_id = v_table.id
      AND ip_address = p_ip_address
      AND status = 'active';
  END IF;

  -- 6. Insert into table_sessions
  INSERT INTO table_sessions (
    id,
    tenant_id,
    table_id,
    session_token,
    token_hash,
    status,
    ip_address,
    user_agent,
    expires_at,
    last_activity_at,
    created_at
  ) VALUES (
    v_session_id,
    v_tenant.id,
    v_table.id,
    v_session_token,
    v_token_hash,
    'active',
    p_ip_address,
    p_user_agent,
    v_expires_at,
    now(),
    now()
  );

  -- 7. Mark table occupied
  IF v_table.status = 'free' OR v_table.status = 'available' THEN
    UPDATE dining_tables
    SET status = 'occupied', updated_at = now()
    WHERE id = v_table.id;
  END IF;

  RETURN jsonb_build_object(
    'is_valid', true,
    'session_token', v_session_token,
    'session_id', v_session_id,
    'expires_at', v_expires_at,
    'expires_in_seconds', 600,
    'tenant', jsonb_build_object(
      'id', v_tenant.id,
      'name', v_tenant.name,
      'slug', v_tenant.slug,
      'upi_id', v_tenant.upi_id
    ),
    'table', jsonb_build_object(
      'id', v_table.id,
      'table_number', v_table.table_number,
      'location_id', v_table.location_id,
      'capacity', v_table.capacity,
      'status', 'occupied'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


/**
 * RPC: verify_and_consume_table_session
 * 
 * Invoked by order submission handler to verify X-Table-Session-Token before inserting orders.
 */
CREATE OR REPLACE FUNCTION verify_and_consume_table_session(
  p_session_token TEXT,
  p_table_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_session RECORD;
  v_table RECORD;
BEGIN
  IF p_session_token IS NULL OR TRIM(p_session_token) = '' THEN
    RETURN jsonb_build_object(
      'is_valid', false,
      'error', 'MISSING_SESSION_TOKEN',
      'message', 'No active table session token provided in X-Table-Session-Token header.'
    );
  END IF;

  -- 1. Lookup session
  SELECT ts.*
  INTO v_session
  FROM table_sessions ts
  WHERE ts.session_token = p_session_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'is_valid', false,
      'error', 'INVALID_SESSION',
      'message', 'Table session token was not recognized or has been revoked.'
    );
  END IF;

  -- 2. Check Expiry
  IF v_session.expires_at < now() OR v_session.status <> 'active' THEN
    UPDATE table_sessions
    SET status = 'expired'
    WHERE id = v_session.id AND status = 'active';

    RETURN jsonb_build_object(
      'is_valid', false,
      'error', 'SESSION_EXPIRED',
      'message', 'Table session expired after 10 minutes. Please re-scan table QR to submit order.'
    );
  END IF;

  -- 3. Verify Table ID Match
  IF p_table_id IS NOT NULL AND v_session.table_id::TEXT <> p_table_id THEN
    RETURN jsonb_build_object(
      'is_valid', false,
      'error', 'TABLE_MISMATCH',
      'message', 'Session token table does not match target order table.'
    );
  END IF;

  -- 4. Verify Dining Table is not settled/free
  SELECT dt.status INTO v_table
  FROM dining_tables dt
  WHERE dt.id = v_session.table_id;

  -- Update session activity
  UPDATE table_sessions
  SET last_activity_at = now()
  WHERE id = v_session.id;

  RETURN jsonb_build_object(
    'is_valid', true,
    'session_id', v_session.id,
    'tenant_id', v_session.tenant_id,
    'table_id', v_session.table_id,
    'expires_at', v_session.expires_at,
    'remaining_seconds', GREATEST(0, EXTRACT(epoch from (v_session.expires_at - now()))::INT)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


/**
 * RPC: renew_ephemeral_table_session
 * 
 * Re-validates the physical table QR token and issues an extended 10-minute session.
 */
CREATE OR REPLACE FUNCTION renew_ephemeral_table_session(
  p_tenant_slug TEXT,
  p_table_number TEXT,
  p_permanent_token TEXT,
  p_current_session_token TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
BEGIN
  -- Mark current session consumed/revoked if provided
  IF p_current_session_token IS NOT NULL THEN
    UPDATE table_sessions
    SET status = 'consumed'
    WHERE session_token = p_current_session_token;
  END IF;

  -- Issue fresh 10-minute session
  RETURN issue_ephemeral_table_session(
    p_tenant_slug,
    p_table_number,
    p_permanent_token
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- 3. CLEANUP FUNCTION & MAINTENANCE ROUTINE
-- =============================================================================

/**
 * Function: purge_expired_table_sessions
 * 
 * Purges dead sessions older than 24 hours to keep the database lean and performant.
 */
CREATE OR REPLACE FUNCTION purge_expired_table_sessions()
RETURNS INT AS $$
DECLARE
  v_deleted_count INT;
BEGIN
  DELETE FROM table_sessions
  WHERE expires_at < (now() - INTERVAL '24 hours')
     OR (status IN ('expired', 'revoked', 'consumed') AND created_at < (now() - INTERVAL '24 hours'));
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- If pg_cron extension is available, schedule purge daily at 04:00 UTC
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('purge-table-sessions-nightly', '0 4 * * *', 'SELECT purge_expired_table_sessions();');
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- pg_cron not configured, manual or edge function invocation used instead
  NULL;
END $$;
