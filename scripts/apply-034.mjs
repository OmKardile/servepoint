// Task 84 — apply migration 034_conversation_typing.sql with proofs.
// Proofs:
//   P1  table shape: 5 columns + composite PK (conversation_id, user_email)
//   P2  RLS policy present, table RLS-enabled
//   P3  publication: conversation_typing on supabase_realtime
//   P4  ROLLBACK probe — upsert a typing row twice (ON CONFLICT updates the
//       SAME row, heartbeat semantics), then delete it; ROLLBACK, zero residue
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
  new URL('../supabase/migrations/034_conversation_typing.sql', import.meta.url), 'utf8');
await c.query(sql);
console.log('migration 034 applied.');

// P1 — shape
const cols = await c.query(
  `SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='conversation_typing' ORDER BY column_name`);
const pk = await c.query(
  `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
    WHERE conrelid = 'conversation_typing'::regclass AND contype='p'`);
ok(cols.rowCount === 5 &&
   pk.rows[0]?.def.includes('PRIMARY KEY (conversation_id, user_email)'),
  `P1: shape ok — (${cols.rows.map(r => r.column_name).join(', ')}) ${pk.rows[0]?.def}`);

// P2 — RLS on + policy present
const rls = await c.query(
  `SELECT relrowsecurity FROM pg_class WHERE relname='conversation_typing' AND relnamespace='public'::regnamespace`);
const pol = await c.query(
  `SELECT count(*)::int AS n FROM pg_policies
    WHERE schemaname='public' AND tablename='conversation_typing' AND policyname='conversation_typing_member_all'`);
ok(rls.rows[0]?.relrowsecurity === true && pol.rows[0]?.n === 1,
  `P2: RLS enabled + member_all policy (${pol.rows[0]?.n})`);

// P3 — publication
const pub = await c.query(
  `SELECT count(*)::int AS n FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='conversation_typing'`);
ok(pub.rows[0]?.n === 1, `P3: conversation_typing published on supabase_realtime`);

// P4 — rollback probe: upsert twice → same row, typing_at advances; delete; ROLLBACK
await c.query('BEGIN');
const conv = await c.query(
  `SELECT id FROM conversations WHERE tenant_id=$1 ORDER BY created_at LIMIT 1`, [T]);
const convId = conv.rows[0].id;
await c.query(
  `INSERT INTO conversation_typing (conversation_id, tenant_id, user_email, sender_name)
   VALUES ($1,$2,'probe@qa.dev','QA Probe')
   ON CONFLICT (conversation_id, user_email) DO UPDATE SET typing_at = now()`, [convId, T]);
const first = await c.query(
  `SELECT typing_at FROM conversation_typing WHERE conversation_id=$1 AND user_email='probe@qa.dev'`, [convId]);
await new Promise((r) => setTimeout(r, 30));
await c.query(
  `INSERT INTO conversation_typing (conversation_id, tenant_id, user_email, sender_name)
   VALUES ($1,$2,'probe@qa.dev','QA Probe')
   ON CONFLICT (conversation_id, user_email) DO UPDATE SET typing_at = now()`, [convId, T]);
const both = await c.query(
  `SELECT count(*)::int AS n FROM conversation_typing WHERE conversation_id=$1 AND user_email='probe@qa.dev'`, [convId]);
await c.query(`DELETE FROM conversation_typing WHERE conversation_id=$1 AND user_email='probe@qa.dev'`, [convId]);
const afterDel = await c.query(
  `SELECT count(*)::int AS n FROM conversation_typing WHERE conversation_id=$1 AND user_email='probe@qa.dev'`, [convId]);
ok(both.rows[0].n === 1 && afterDel.rows[0].n === 0 && first.rows.length === 1,
  `P4: probe upsert kept ONE row (heartbeat), delete cleared it — ROLLBACK next`);
await c.query('ROLLBACK');
const residue = await c.query(
  `SELECT count(*)::int AS n FROM conversation_typing WHERE user_email='probe@qa.dev'`);
ok(residue.rows[0].n === 0, `P5: zero probe residue after ROLLBACK`);

console.log(fails === 0 ? 'APPLY OK' : `APPLY FAILED (${fails})`);
await c.end();
process.exit(fails === 0 ? 0 : 1);
