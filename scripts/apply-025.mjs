// Task 66 — apply migration 025 (track-page café brand) to the cloud DB.
// Run: SUPABASE_DB_PASSWORD='<db-password>' node scripts/apply-025.mjs
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
  const sql = readFileSync('supabase/migrations/025_track_page_brand.sql', 'utf8');
  await c.query(sql);
  console.log('APPLIED 025_track_page_brand');

  // sentinel — same discipline as previous rounds
  await c.query(
    `INSERT INTO schema_migrations (name) VALUES ('025_track_page_brand')
     ON CONFLICT (name) DO NOTHING`,
  ).catch(async (e) => {
    const t = await c.query(`SELECT to_regclass('public.schema_migrations') AS t`);
    if (t.rows[0].t) throw e;
    console.log('SENTINEL SKIPPED (no schema_migrations table)');
  });
  console.log('SENTINEL OK');

  // proof 1 — latest real order's payload carries the tenant sibling with the right shape
  const latest = await c.query(`SELECT id FROM orders ORDER BY created_at DESC LIMIT 1`);
  if (latest.rowCount !== 1) throw new Error('no orders to probe');
  const oid = latest.rows[0].id;
  const r = await c.query(`SELECT sp_get_public_order($1) AS r`, [oid]);
  const payload = r.rows[0].r;
  if (payload.is_valid !== true) throw new Error('latest order probe invalid');
  const tn = payload.tenant;
  if (!tn || typeof tn.name !== 'string' || !('logo_url' in tn)) {
    throw new Error(`tenant payload wrong shape: ${JSON.stringify(tn)}`);
  }
  // 'order' payload unchanged — spot keys
  for (const k of ['id', 'order_number', 'status', 'items', 'created_at']) {
    if (!(k in payload.order)) throw new Error(`order payload lost ${k}`);
  }
  console.log('PROBE tenant payload:', JSON.stringify(tn));
  console.log('PROBE order keys intact; order_number =', payload.order.order_number);

  // proof 2 — the tenant name really is the order's café (join correctness)
  const j = await c.query(
    `SELECT t.name FROM orders o JOIN tenants t ON t.id = o.tenant_id WHERE o.id = $1`,
    [oid],
  );
  if (j.rows[0].name !== tn.name) throw new Error('tenant join mismatch');
  console.log('JOIN OK: tenant.name =', tn.name);

  // proof 3 — NOT_FOUND path intact, and it leaks no tenant
  const nf = await c.query(`SELECT sp_get_public_order(gen_random_uuid()) AS r`);
  const np = nf.rows[0].r;
  if (np.is_valid !== false || np.error !== 'NOT_FOUND' || 'tenant' in np) {
    throw new Error(`NOT_FOUND path changed: ${JSON.stringify(np)}`);
  }
  console.log('NOT_FOUND OK (no tenant leak)');

  // proof 4 — anon EXECUTE survived the replace-in-place
  const g = await c.query(
    `SELECT has_function_privilege('anon', 'public.sp_get_public_order(uuid)', 'EXECUTE') AS ok`,
  );
  if (g.rows[0].ok !== true) throw new Error('anon EXECUTE grant lost');
  console.log('GRANT OK: anon EXECUTE intact');

  // proof 5 — function identity: single signature, SECURITY DEFINER
  const f = await c.query(
    `SELECT count(*) AS n, bool_or(prosecdef) AS definer FROM pg_proc
      WHERE proname = 'sp_get_public_order' AND pronamespace = 'public'::regnamespace`,
  );
  if (Number(f.rows[0].n) !== 1 || f.rows[0].definer !== true) {
    throw new Error(`function state wrong: ${JSON.stringify(f.rows[0])}`);
  }
  console.log('FUNCTION OK: 1 signature, SECURITY DEFINER');
} catch (e) {
  console.error('APPLY FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end().catch(() => undefined);
}
