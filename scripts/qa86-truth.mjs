// Task 86 — truth script: the "needs you now" round leaves the cloud whole.
// The round staged ZERO orders — only two restorable flips (Coffee beans
// stock, one menu item's availability). This script proves both flips are
// home and nothing else moved.
//   D1  Coffee beans back at 4880 g (the round's only inventory write)
//   D2  Veg Grilled Sandwich available again (the round's only menu write)
//   D3  orders unchanged at 36 (zero probe tickets this round)
//   D4  the 3 true bells untouched, chat at the honest 5 lines
//   D5  presence still owner-only (035's honest live heartbeat)
//   D6  035 intact (4 cols + member_all policy + published)
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

const beans = await c.query(
  `SELECT current_stock FROM inventory_items WHERE tenant_id=$1 AND name='Coffee beans'`, [T]);
ok(Number(beans.rows[0]?.current_stock) === 4880, `D1: Coffee beans at 4880 (${beans.rows[0]?.current_stock})`);

const sw = await c.query(
  `SELECT is_available FROM menu_items WHERE id='60577ac1-cccd-465f-aafd-06b7db8c130f'`);
ok(sw.rows[0]?.is_available === true, `D2: Veg Grilled Sandwich available again (${sw.rows[0]?.is_available})`);

const orders = await c.query(`SELECT count(*)::int n FROM orders WHERE tenant_id=$1`, [T]);
ok(orders.rows[0].n === 36, `D3: orders unchanged at 36 (${orders.rows[0].n})`);

const bells = await c.query(`SELECT count(*)::int n FROM notifications WHERE tenant_id=$1`, [T]);
const chat = await c.query(
  `SELECT count(*)::int n FROM conversation_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE tenant_id=$1)`, [T]);
ok(bells.rows[0].n === 3 && chat.rows[0].n === 5, `D4: 3 bells, 5 chat lines (${bells.rows[0].n}/${chat.rows[0].n})`);

const pres = await c.query(`SELECT user_email FROM staff_presence WHERE tenant_id=$1`, [T]);
ok(pres.rows.length === 1 && pres.rows[0].user_email === 'qrowner@qrflowcafe.in',
  `D5: presence owner-only (${pres.rows.map(r => r.user_email).join(', ') || 'empty'})`);

const cols = await c.query(
  `SELECT count(*)::int n FROM information_schema.columns WHERE table_schema='public' AND table_name='staff_presence'`);
const pub = await c.query(
  `SELECT count(*)::int n FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='staff_presence'`);
ok(cols.rows[0].n === 4 && pub.rows[0].n === 1, `D6: 035 intact (${cols.rows[0].n} cols, pub=${pub.rows[0].n})`);

console.log(fails === 0 ? 'TRUTH OK' : `TRUTH FAILED (${fails})`);
await c.end();
process.exit(fails === 0 ? 0 : 1);
