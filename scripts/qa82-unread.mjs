// Task 82 — DB truth for the unread line round. Honest end state:
// 4 chat lines total (2 from round 80 + 1 tagged probe + 1 UI reply from
// this round), owner watermarks on both rooms, zero unread anywhere,
// the two raced probe lines already deleted (superseded mid-E2E).
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
const EMAIL = 'qrowner@qrflowcafe.in';
let fails = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  if (!cond) fails++;
};

// T1 — exactly 4 messages, honest composition
const msgs = await c.query(
  `SELECT cv.name AS room, cm.sender_name, cm.body FROM conversation_messages cm
    JOIN conversations cv ON cv.id = cm.conversation_id
    WHERE cm.tenant_id=$1 ORDER BY cm.created_at`, [T]);
ok(msgs.rowCount === 4, `T1: exactly 4 chat lines on record (${msgs.rowCount})`);
ok(msgs.rows.some(r => r.body.includes('QA round 82 — unread probe') && r.sender_name === 'Front of House'),
   'T2: the tagged probe line is real history (sender "Front of House")');
ok(msgs.rows.some(r => r.body.includes('QA round 82 reply') && r.sender_name === 'QR Owner'),
   'T3: the UI reply is real history (sender "QR Owner")');

// T4 — the raced probes are gone
const raced = await c.query(
  `SELECT count(*)::int AS n FROM conversation_messages WHERE tenant_id=$1 AND body LIKE '%second probe%'`, [T]);
ok(raced.rows[0].n === 0, 'T4: raced probe lines deleted (superseded mid-E2E)');

// T5 — watermarks: one per room for the owner, advancing after open
const wms = await c.query(
  `SELECT cv.name AS room, cr.last_read_at FROM conversation_reads cr
    JOIN conversations cv ON cv.id = cr.conversation_id
    WHERE cr.tenant_id=$1 AND cr.user_email=$2 ORDER BY cv.name`, [T, EMAIL]);
ok(wms.rowCount === 2, `T5: owner watermark on both rooms (${wms.rows.map(r => r.room).join(', ')})`);

// T6 — zero unread anywhere (server truth via the RPC)
const rpc = await c.query('SELECT * FROM fn_conversation_unread($1,$2,$3)', [T, EMAIL, 'QR Owner']);
ok(rpc.rowCount === 0, `T6: RPC says zero unread rooms (${rpc.rowCount})`);

// T7 — watermark actually moved past the probe line in FOH
const fohWm = wms.rows.find(r => r.room === 'Front of House')?.last_read_at;
const probeAt = (await c.query(
  `SELECT cm.created_at FROM conversation_messages cm
    JOIN conversations cv ON cv.id = cm.conversation_id
    WHERE cv.tenant_id=$1 AND cm.body LIKE 'QA round 82 — unread probe%'`, [T])).rows[0]?.created_at;
ok(fohWm && probeAt && new Date(fohWm) > new Date(probeAt),
   `T7: FOH watermark (${fohWm}) advanced past the probe (${probeAt})`);

// T8 — shape + RPC on duty
const shape = await c.query(
  `SELECT count(*)::int AS n FROM information_schema.columns
    WHERE table_schema='public' AND table_name='conversation_reads'`);
const fn = await c.query(
  `SELECT count(*)::int AS n FROM pg_proc WHERE proname='fn_conversation_unread'`);
ok(shape.rows[0].n === 4 && fn.rows[0].n === 1, 'T8: conversation_reads shape + RPC on duty');

console.log(fails === 0 ? '\nALL TRUTH GREEN' : `\n${fails} CHECK(S) FAILED`);
await c.end();
process.exit(fails === 0 ? 0 : 1);
