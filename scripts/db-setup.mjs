// Supabase provisioning script: applies TSOS migrations 001-005 to the live
// Supabase project via the Supavisor session pooler (IPv4 path — direct
// db.<ref>.supabase.co:5432 is IPv6-only on current projects), then verifies.
// NOT part of the app bundle.
//
// USAGE (password never committed):
//   SUPABASE_DB_PASSWORD='<db-password>' bun scripts/db-setup.mjs
import { readFileSync } from 'node:fs';
import pg from 'pg';

const REF = 'gehjsxopcowmotgrrcgc';
const HOST = 'aws-0-ap-northeast-2.pooler.supabase.com';
const PASSWORD = process.env.SUPABASE_DB_PASSWORD;
if (!PASSWORD) {
  console.error('Set SUPABASE_DB_PASSWORD env var (see docs/CREDENTIALS.md).');
  process.exit(1);
}

const client = new pg.Client({
  host: HOST,
  port: 5432,
  user: `postgres.${REF}`,
  password: PASSWORD,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 12000,
});

async function scalar(sql) {
  const { rows } = await client.query(sql);
  return rows[0] ? Object.values(rows[0])[0] : null;
}

async function tableExists(name) {
  const v = await scalar(
    `SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='${name}'`
  );
  return Number(v) > 0;
}

async function applyFile(label, path, alreadyApplied) {
  if (alreadyApplied) {
    console.log(`SKIP  ${label} (already applied)`);
    return;
  }
  const sql = readFileSync(path, 'utf8');
  try {
    await client.query(sql);
    console.log(`APPLY ${label} ✓`);
  } catch (err) {
    console.error(`FAIL  ${label}: ${err.message}`);
    throw err;
  }
}

try {
  await client.connect();
  console.log(`CONNECTED ${HOST} as postgres.${REF}`);

  // 003 sentinel: role CHECK widened to the three-role model
  let threeRole = false;
  {
    const { rows } = await client.query(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conname='tenant_users_role_check'
          AND conrelid = to_regclass('public.tenant_users')`
    );
    threeRole = rows.length > 0 && String(rows[0].def).includes("'staff'");
  }

  await applyFile('001_multi_tenant_saas', 'supabase/migrations/001_multi_tenant_saas.sql', await tableExists('tenants'));
  await applyFile('002_ephemeral_table_sessions', 'supabase/migrations/002_ephemeral_table_sessions.sql', await tableExists('table_sessions'));
  await applyFile('003_role_model_staff_merge', 'supabase/migrations/003_role_model_staff_merge.sql', threeRole);
  await applyFile('004_notifications_messages', 'supabase/migrations/004_notifications_messages.sql', await tableExists('notifications'));
  await applyFile('005_production_baseline_hardening', 'supabase/migrations/005_production_baseline_hardening.sql', false);

  // ── Verification ──────────────────────────────────────────────────────────
  const tables = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
  );
  console.log('PUBLIC TABLES:', tables.rows.map((r) => r.table_name).join(', '));

  const policies = await client.query(
    `SELECT tablename, count(*) AS n FROM pg_policies WHERE schemaname='public'
      AND tablename IN ('tenants','subscriptions','platform_audit_logs')
      GROUP BY tablename ORDER BY tablename`
  );
  console.log('PLATFORM POLICIES:', JSON.stringify(policies.rows));

  const auditCols = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='platform_audit_logs' ORDER BY ordinal_position`
  );
  console.log('AUDIT COLUMNS:', auditCols.rows.map((r) => r.column_name).join(', '));

  const op = await client.query(
    `SELECT email, raw_user_meta_data->>'role' AS role, (email_confirmed_at IS NOT NULL) AS confirmed
       FROM auth.users WHERE email='admin@tsos.dev'`
  );
  console.log('BOOTSTRAP OPERATOR:', JSON.stringify(op.rows));

  const tu = await client.query(
    `SELECT email, role, is_active, (tenant_id IS NULL) AS tenant_free
       FROM tenant_users WHERE email='admin@tsos.dev'`
  );
  console.log('TENANT_USERS ROW:', JSON.stringify(tu.rows));

  const tenantsCount = await scalar('SELECT count(*)::text FROM public.tenants');
  const auditCount = await scalar('SELECT count(*)::text FROM public.platform_audit_logs');
  console.log('ROW COUNTS tenants/audit_logs:', `${tenantsCount}/${auditCount}`);

  console.log('SETUP COMPLETE ✓');
} catch (err) {
  console.error('SETUP-FAILED:', err.message);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
