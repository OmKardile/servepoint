// Task 80 — apply migration 031_message_line.sql with proofs.
// Proofs:
//   P1  the preview trigger exists on conversation_messages
//   P2  both chat tables joined the realtime publication
//   P3  ROLLBACK probe — an INSERT stamps the parent conversation's
//       last_message/last_message_at (server truth), zero residue
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
  new URL('../supabase/migrations/031_message_line.sql', import.meta.url), 'utf8');
await c.query(sql);

// P1 — trigger on duty
const trig = await c.query(
  `SELECT 1 FROM information_schema.triggers
    WHERE trigger_schema='public' AND trigger_name='trg_conversation_touch'
      AND event_object_table='conversation_messages'`);
ok(trig.rowCount === 1, 'P1: trg_conversation_touch on duty');

// P2 — realtime publication
const pub = await c.query(
  `SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime'
    AND tablename IN ('conversation_messages','conversations') ORDER BY tablename`);
ok(pub.rowCount === 2, `P2: chat tables in realtime (${pub.rows.map(r => r.tablename).join(', ')})`);

// P3 — rollback probe: insert a message, the parent preview moves.
await c.query('BEGIN');
const conv = await c.query(
  `SELECT id, name FROM conversations WHERE tenant_id=$1 AND kind='team' ORDER BY name LIMIT 1`, [T]);
const before = await c.query(
  `SELECT last_message, last_message_at FROM conversations WHERE id=$1`, [conv.rows[0].id]);
await c.query(
  `INSERT INTO conversation_messages (conversation_id, tenant_id, sender_name, body)
    VALUES ($1,$2,'probe-bot','apply-031 probe — this line must vanish')`,
  [conv.rows[0].id, T]);
const after = await c.query(
  `SELECT last_message, last_message_at FROM conversations WHERE id=$1`, [conv.rows[0].id]);
ok(after.rows[0].last_message === 'apply-031 probe — this line must vanish' &&
   after.rows[0].last_message_at !== null &&
   before.rows[0].last_message_at === null,
  `P3: preview stamped on the parent — "${after.rows[0].last_message?.slice(0, 40)}"`);
await c.query('ROLLBACK');

// Residue check
const residue = await c.query(
  `SELECT
     (SELECT count(*)::int FROM conversation_messages WHERE tenant_id=$1) AS msgs,
     (SELECT count(*)::int FROM conversations WHERE tenant_id=$1 AND last_message_at IS NOT NULL) AS stamped`,
  [T]);
ok(residue.rows[0].msgs === 0 && residue.rows[0].stamped === 0,
  `Residue: msgs=${residue.rows[0].msgs} stamped=${residue.rows[0].stamped} — all clean`);

console.log(fails === 0 ? '\nALL PROOFS GREEN' : `\n${fails} PROOF(S) FAILED`);
await c.end();
process.exit(fails === 0 ? 0 : 1);
