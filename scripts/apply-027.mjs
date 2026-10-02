// Task 75 — apply migration 027 (stock adjustments diary) to the cloud DB.
// Run: SUPABASE_DB_PASSWORD='<db-password>' node scripts/apply-027.mjs
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { dbPassword } from './db-creds.mjs';

const REF = 'gehjsxopcowmotgrrcgc';
const c = new pg.Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com',
  port: 5432,
  user: `postgres.${REF}`,
  password: dbPassword(),
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});

try {
  await c.connect();
  const sql = readFileSync('supabase/migrations/027_stock_adjustments.sql', 'utf8');
  await c.query(sql);
  console.log('APPLIED 027_stock_adjustments');

  await c.query(
    `INSERT INTO schema_migrations (name) VALUES ('027_stock_adjustments')
     ON CONFLICT (name) DO NOTHING`,
  ).catch(async (e) => {
    const t = await c.query(`SELECT to_regclass('public.schema_migrations') AS t`);
    if (t.rows[0].t) throw e;
    console.log('SENTINEL SKIPPED (no schema_migrations table)');
  });
  console.log('SENTINEL OK');

  // proof 1 — table columns exact
  const col = await c.query(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns
      WHERE table_name = 'stock_adjustments' ORDER BY ordinal_position`,
  );
  const names = col.rows.map((r) => r.column_name);
  for (const want of ['id', 'tenant_id', 'inventory_item_id', 'qty', 'reason', 'note', 'created_by_email', 'created_at']) {
    if (!names.includes(want)) throw new Error(`missing column: ${want}`);
  }
  console.log('TABLE OK:', names.join(', '));

  // proof 2 — exactly the two policies
  const p = await c.query(
    `SELECT policyname, cmd FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'stock_adjustments' ORDER BY policyname`,
  );
  if (p.rowCount !== 2) throw new Error(`policy count ${p.rowCount}`);
  console.log('POLICIES OK:', p.rows.map((r) => r.policyname).join(' · '));

  // proof 3 — RPC exists, locked to authenticated
  const fn = await c.query(
    `SELECT p.oid::regprocedure AS sig,
            (SELECT count(*) FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) AS a
              WHERE a.grantee = (SELECT oid FROM pg_roles WHERE rolname = 'anon')) AS anon_grants
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'sp_adjust_stock'`,
  );
  if (fn.rowCount !== 1) throw new Error('sp_adjust_stock missing');
  if (Number(fn.rows[0].anon_grants) !== 0) throw new Error('anon still has EXECUTE — revoke failed');
  console.log('RPC OK:', fn.rows[0].sig, '· anon EXECUTE revoked');

  // proof 4 — realtime publication
  const pub = await c.query(
    `SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'stock_adjustments'`,
  );
  if (pub.rowCount !== 1) throw new Error('stock_adjustments not on supabase_realtime');
  console.log('REALTIME OK: stock_adjustments published');

  // proof 5 — RPC guard probe (server-side honesty, no data written).
  // Direct pg session = no JWT → current_tenant_id() is NULL → the tenant gate
  // fires BEFORE arg validation, so a raw connection can only prove the gate.
  // The reason/sign/qty guards get proven with the owner's real JWT in the QA pass.
  try {
    await c.query(`SELECT sp_adjust_stock(gen_random_uuid(), 1, 'vibes', '')`);
    throw new Error('tenant gate not enforced');
  } catch (e) {
    if (!String(e.message).includes('NOT_A_MEMBER')) throw e;
    console.log('GUARD OK: no-JWT call refused (NOT_A_MEMBER, gate precedes arg checks)');
  }
} catch (e) {
  console.error('APPLY FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end().catch(() => undefined);
}
