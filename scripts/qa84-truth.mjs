// Task 84 — clean the typing probe and prove the cloud honest:
// zero typing rows left (probe deleted, owner retracted on send),
// migration 034 intact, chat lines at the honest 5 (4 previous + the
// round's own UI-sent line, QA-tagged), 3 true bells untouched.
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

// DELETE the probe row (my own QA row; the owner's row was already
// retracted by the UI's send-path retractTyping — verify, don't assume)
const del = await c.query(
  `DELETE FROM conversation_typing WHERE tenant_id=$1 AND user_email='probe-foh@qa.dev' RETURNING user_email`, [T]);
ok(del.rows.length <= 1, `D1: probe typing row gone (deleted this pass: ${del.rows.length})`);

const left = await c.query(`SELECT count(*)::int AS n FROM conversation_typing WHERE tenant_id=$1`, [T]);
ok(left.rows[0].n === 0, `D2: zero typing rows remain (owner's retracted on send — honest exit state)`);

// Migration 034 still on duty
const shape = await c.query(
  `SELECT count(*)::int AS n FROM information_schema.columns
    WHERE table_schema='public' AND table_name='conversation_typing'`);
const pub = await c.query(
  `SELECT count(*)::int AS n FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='conversation_typing'`);
const pol = await c.query(
  `SELECT count(*)::int AS n FROM pg_policies
    WHERE schemaname='public' AND tablename='conversation_typing' AND policyname='conversation_typing_member_all'`);
ok(shape.rows[0].n === 5 && pub.rows[0].n === 1 && pol.rows[0].n === 1,
   `D3: 034 intact — 5 cols, published, member_all policy`);

// Chat history: 5 lines (4 honest + this round's QA-tagged UI line)
const msg = await c.query(
  `SELECT count(*)::int AS n, count(*) FILTER (WHERE body LIKE 'QA round 84%')::int AS qa
     FROM conversation_messages WHERE tenant_id=$1`, [T]);
ok(msg.rows[0].n === 5 && msg.rows[0].qa === 1,
   `D4: chat lines at 5 (4 prior + this round's QA-tagged line) (${msg.rows[0].n}, qa=${msg.rows[0].qa})`);

// The 3 true bells untouched
const bells = await c.query(
  `SELECT count(*)::int AS n, count(*) FILTER (WHERE is_read)::int AS read_n,
          count(*) FILTER (WHERE link_to IS NOT NULL)::int AS door_n
     FROM notifications WHERE tenant_id=$1`, [T]);
ok(bells.rows[0].n === 3 && bells.rows[0].read_n === 3 && bells.rows[0].door_n === 3,
   `D5: the 3 true bells untouched (n=${bells.rows[0].n}, read=${bells.rows[0].read_n}, doored=${bells.rows[0].door_n})`);

// Watermarks unchanged (owner × both rooms)
const wm = await c.query(
  `SELECT count(*)::int AS n FROM conversation_reads WHERE tenant_id=$1`, [T]);
ok(wm.rows[0].n === 2, `D6: watermark rows unchanged at 2 (${wm.rows[0].n})`);

console.log(fails === 0 ? 'TRUTH OK' : `TRUTH FAILED (${fails})`);
await c.end();
process.exit(fails === 0 ? 0 : 1);
