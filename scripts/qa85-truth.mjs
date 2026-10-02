// Task 85 — truth script: 035 presence round leaves the cloud honest.
// Idempotent narrative (the qa83 lesson): every probe is already deleted by
// the cleanup step before this runs — the script PROVES the zero state.
//   D1  probe member row gone (tenant_users, qa-probe@servepoint.test)
//   D2  probe presence row gone (staff_presence, qa-probe@servepoint.test)
//   D3  staff_presence holds ONLY the owner's honest live heartbeat row
//   D4  conversation_typing empty (the honest exit state from 034)
//   D5  chat at the honest 5 lines (80/82/84 precedent)
//   D6  the 3 true bells untouched (all read, all doored)
//   D7  migration 035 intact: 4 cols, member_all policy, published
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

const probeTeam = await c.query(
  `SELECT count(*)::int n FROM tenant_users WHERE email='qa-probe@servepoint.test' AND tenant_id=$1`, [T]);
ok(probeTeam.rows[0].n === 0, `D1: probe member row gone (${probeTeam.rows[0].n})`);

const probePres = await c.query(
  `SELECT count(*)::int n FROM staff_presence WHERE user_email='qa-probe@servepoint.test' AND tenant_id=$1`, [T]);
ok(probePres.rows[0].n === 0, `D2: probe presence row gone (${probePres.rows[0].n})`);

const pres = await c.query(`SELECT user_email FROM staff_presence WHERE tenant_id=$1`, [T]);
const onlyOwner = pres.rows.length === 1 && pres.rows[0].user_email === 'qrowner@qrflowcafe.in';
ok(onlyOwner, `D3: presence holds only the owner's live heartbeat (${pres.rows.map(r => r.user_email).join(', ') || 'empty'})`);

const typing = await c.query(`SELECT count(*)::int n FROM conversation_typing WHERE tenant_id=$1`, [T]);
ok(typing.rows[0].n === 0, `D4: typing table empty (${typing.rows[0].n})`);

const chat = await c.query(
  `SELECT count(*)::int n FROM conversation_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE tenant_id=$1)`, [T]);
ok(chat.rows[0].n === 5, `D5: chat at the honest 5 lines (${chat.rows[0].n})`);

const bells = await c.query(`SELECT count(*)::int n FROM notifications WHERE tenant_id=$1`, [T]);
const bellsRead = await c.query(`SELECT count(*)::int n FROM notifications WHERE tenant_id=$1 AND is_read`, [T]);
ok(bells.rows[0].n === 3 && bellsRead.rows[0].n === 3, `D6: 3 true bells, all read (${bellsRead.rows[0].n}/${bells.rows[0].n})`);

const cols = await c.query(
  `SELECT count(*)::int n FROM information_schema.columns
    WHERE table_schema='public' AND table_name='staff_presence'`);
const pol = await c.query(
  `SELECT count(*)::int n FROM pg_policies WHERE schemaname='public' AND tablename='staff_presence' AND policyname='staff_presence_member_all'`);
const pub = await c.query(
  `SELECT count(*)::int n FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='staff_presence'`);
ok(cols.rows[0].n === 4 && pol.rows[0].n === 1 && pub.rows[0].n === 1,
  `D7: 035 intact — 4 cols, member_all policy, published (${cols.rows[0].n}/${pol.rows[0].n}/${pub.rows[0].n})`);

console.log(fails === 0 ? 'TRUTH OK' : `TRUTH FAILED (${fails})`);
await c.end();
process.exit(fails === 0 ? 0 : 1);
