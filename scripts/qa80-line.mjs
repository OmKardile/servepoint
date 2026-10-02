// Task 80 — DB truth of the staff line round. Read-only.
// Expect: exactly 2 messages (one per room, QA-tagged bodies), both rooms'
// last_message/last_message_at stamped SERVER-SIDE by the 031 trigger with
// bodies matching the sent lines; realtime publication carries both tables.
import pg from 'pg';
import { dbPassword } from './db-creds.mjs';
const c = new pg.Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com', port: 5432,
  user: 'postgres.gehjsxopcowmotgrrcgc', password: dbPassword(),
  database: 'postgres', ssl: { rejectUnauthorized: false },
});
await c.connect();
const T = 'd207be19-e86f-4780-befb-3968831a38fe';
let fails = 0;
const ok = (cond, label) => { console.log(`${cond ? '✓' : '✗'} ${label}`); if (!cond) fails++; };

const msgs = await c.query(
  `SELECT m.body, m.sender_name, m.created_at, cv.name AS room
    FROM conversation_messages m JOIN conversations cv ON cv.id = m.conversation_id
    WHERE m.tenant_id = $1 ORDER BY m.created_at ASC`, [T]);
ok(msgs.rowCount === 2, `messages: exactly 2 rows (${msgs.rowCount})`);
const foh = msgs.rows.find(r => r.room === 'Front of House');
const kit = msgs.rows.find(r => r.room === 'Kitchen');
ok(!!foh && foh.sender_name === 'QR Owner' && foh.body.includes('QA round 80') && foh.body.includes('bell'),
  `FOH line: sender "${foh?.sender_name}", body on record`);
ok(!!kit && kit.sender_name === 'QR Owner' && kit.body.includes('kitchen copy'),
  `Kitchen line: sender "${kit?.sender_name}", body on record`);

const convs = await c.query(
  `SELECT name, last_message, last_message_at FROM conversations
    WHERE tenant_id = $1 ORDER BY name`, [T]);
for (const cv of convs.rows) {
  const stamped = cv.last_message && cv.last_message_at;
  const matches = cv.last_message && cv.last_message.includes('QA round 80');
  ok(!!stamped && !!matches,
    `room "${cv.name}": preview stamped server-side — "${cv.last_message?.slice(0, 42)}…"`);
}

const pub = await c.query(
  `SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime'
    AND tablename IN ('conversation_messages','conversations')`);
ok(pub.rowCount === 2, 'realtime: both chat tables published');

console.log(fails === 0 ? '\nALL GREEN' : `\n${fails} CHECK(S) FAILED`);
await c.end();
process.exit(fails === 0 ? 0 : 1);
