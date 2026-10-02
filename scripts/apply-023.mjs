// Task 62 — apply migration 023 (session gate + staff cut) to the cloud DB.
// Run: node scripts/apply-023.mjs
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
  const sql = readFileSync('supabase/migrations/023_session_gate_staff_cut.sql', 'utf8');
  await c.query(sql);
  console.log('APPLIED 023_session_gate_staff_cut');

  // sentinel — same discipline as previous rounds
  await c.query(
    `INSERT INTO schema_migrations (name) VALUES ('023_session_gate_staff_cut')
     ON CONFLICT (name) DO NOTHING`,
  ).catch(async (e) => {
    const t = await c.query(`SELECT to_regclass('public.schema_migrations') AS t`);
    if (t.rows[0].t) throw e;
    console.log('SENTINEL SKIPPED (no schema_migrations table)');
  });
  console.log('SENTINEL OK');

  // proof 1 — overload shape
  const p = await c.query(
    `SELECT proname, proargnames FROM pg_proc
      WHERE pronamespace='public'::regnamespace AND proname IN ('sp_create_public_order','sp_verify_table_session')`,
  );
  for (const r of p.rows) console.log('FN:', r.proname, '| args:', (r.proargnames || []).join(','));

  // proof 2 — verify RPC on a garbage token
  const v = await c.query(`SELECT sp_verify_table_session('garbage-token') AS r`);
  console.log('VERIFY garbage:', JSON.stringify(v.rows[0].r));

  // proof 3 — the gate fires on a PRESENTED dead token (before any pricing/insert)
  const t = await c.query(
    `SELECT qr_token FROM dining_tables WHERE table_number='T2' LIMIT 1`,
  );
  const qr = t.rows[0]?.qr_token;
  if (!qr) throw new Error('no T2 table row for the gate proof');
  const g = await c.query(
    `SELECT sp_create_public_order($1, NULL, '[]'::jsonb, 'dine_in', NULL, NULL, NULL, NULL, 'dead-session-token') AS r`,
    [qr],
  );
  console.log('GATE dead token:', JSON.stringify(g.rows[0].r));

  // proof 4 — NULL token proceeds exactly as before (legacy behavior intact)
  const n = await c.query(
    `SELECT sp_create_public_order($1, NULL, '[]'::jsonb, 'dine_in', NULL, NULL, NULL, NULL, NULL) AS r`,
    [qr],
  );
  console.log('GATE null token:', JSON.stringify(n.rows[0].r));

  // proof 5 — neither proof wrote anything
  const o = await c.query(`SELECT count(*)::int AS n FROM orders`);
  console.log('ORDER COUNT after proofs:', o.rows[0].n);
} catch (e) {
  console.error('APPLY FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end().catch(() => undefined);
}
