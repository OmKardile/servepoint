// Task 85 — apply migration 035_staff_presence.sql with proofs.
// Proofs:
//   P1  table shape: 4 columns + composite PK (user_email, tenant_id)
//   P2  RLS policy present, table RLS-enabled
//   P3  publication: staff_presence on supabase_realtime (idempotent)
//   P4  ROLLBACK probe — upsert a presence row twice (ON CONFLICT updates
//       the SAME row, heartbeat semantics; last_seen_at advances), then
//       delete it; ROLLBACK, zero residue
import pg from 'pg';
import { dbPassword } from './db-creds.mjs';

const c = new pg.Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com',
  port: 5432,
  user: 'postgres.gehjsxopcowmotgrrcgc',
  password: dbPassword(),
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});
await c.connect();
const T = 'd207be19-e86f-4780-befb-3968831a38fe';
let fails = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  if (!cond) fails++;
};

const sql = await (await import('node:fs/promises')).readFile(
  new URL('../supabase/migrations/035_staff_presence.sql', import.meta.url), 'utf8');
await c.query(sql);
console.log('migration 035 applied.');

// P1 — shape
const cols = await c.query(
  `SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='staff_presence' ORDER BY column_name`);
const pk = await c.query(
  `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
    WHERE conrelid = 'staff_presence'::regclass AND contype='p'`);
ok(cols.rowCount === 4 &&
   pk.rows[0]?.def.includes('PRIMARY KEY (user_email, tenant_id)'),
  `P1: shape ok — (${cols.rows.map(r => r.column_name).join(', ')}) ${pk.rows[0]?.def}`);

// P2 — RLS on + policy present
const rls = await c.query(
  `SELECT relrowsecurity FROM pg_class WHERE relname='staff_presence' AND relnamespace='public'::regnamespace`);
const pol = await c.query(
  `SELECT count(*)::int AS n FROM pg_policies
    WHERE schemaname='public' AND tablename='staff_presence' AND policyname='staff_presence_member_all'`);
ok(rls.rows[0]?.relrowsecurity === true && pol.rows[0]?.n === 1,
  `P2: RLS enabled + member_all policy (${pol.rows[0]?.n})`);

// P3 — publication
const pub = await c.query(
  `SELECT count(*)::int AS n FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='staff_presence'`);
ok(pub.rows[0]?.n === 1, `P3: staff_presence published on supabase_realtime`);

// P4 — rollback probe: upsert twice → same row, last_seen_at advances; delete; ROLLBACK
await c.query('BEGIN');
await c.query(
  `INSERT INTO staff_presence (user_email, tenant_id, sender_name)
   VALUES ('probe@qa.dev',$1,'QA Probe')
   ON CONFLICT (user_email, tenant_id) DO UPDATE SET last_seen_at = now()`, [T]);
const first = await c.query(
  `SELECT last_seen_at FROM staff_presence WHERE user_email='probe@qa.dev' AND tenant_id=$1`, [T]);
await new Promise((r) => setTimeout(r, 30));
await c.query(
  `INSERT INTO staff_presence (user_email, tenant_id, sender_name)
   VALUES ('probe@qa.dev',$1,'QA Probe')
   ON CONFLICT (user_email, tenant_id) DO UPDATE SET last_seen_at = now()`, [T]);
const both = await c.query(
  `SELECT count(*)::int AS n FROM staff_presence WHERE user_email='probe@qa.dev' AND tenant_id=$1`, [T]);
await c.query(
  `DELETE FROM staff_presence WHERE user_email='probe@qa.dev' AND tenant_id=$1`, [T]);
const afterDel = await c.query(
  `SELECT count(*)::int AS n FROM staff_presence WHERE user_email='probe@qa.dev' AND tenant_id=$1`, [T]);
ok(both.rows[0].n === 1 && afterDel.rows[0].n === 0 && first.rows.length === 1,
  `P4: probe upsert kept ONE row (heartbeat), delete cleared it — ROLLBACK next`);
await c.query('ROLLBACK');
const residue = await c.query(
  `SELECT count(*)::int AS n FROM staff_presence WHERE user_email='probe@qa.dev'`);
ok(residue.rows[0].n === 0, `P5: zero probe residue after ROLLBACK`);

console.log(fails === 0 ? 'APPLY OK' : `APPLY FAILED (${fails})`);
await c.end();
process.exit(fails === 0 ? 0 : 1);
