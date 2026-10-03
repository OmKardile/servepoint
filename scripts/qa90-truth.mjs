// Task 90 — truth script: the "bill speaks legal" round leaves the cloud
// exactly as it found it. The E2E walked the honest cycle (Settings →
// Business profile fill → Save → reload persist → receipt builder asserts
// with the REAL stored values → clear through the same owner-gated UI), so
// the exit state is the pre-round state.
//   D1  tenants.legal_* back to null (the round's only cloud writes, restored)
//   D2  orders unchanged at 36; bells at the honest 3; chat at 5
//   D3  presence still owner-only (035's honest live heartbeat)
//   D4  menu-photos bucket still zero objects
//   D5  no schema drift: tenants columns unchanged (20 base cols, no new)
//   D6  the owner UPDATE policy on tenants untouched (1 row, owner role)
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

const legal = await c.query(
  `SELECT legal_name, gst_number, fssai_number, address, owner_phone FROM tenants WHERE id=$1`, [T]);
const L = legal.rows[0] || {};
ok(!L.legal_name && !L.gst_number && !L.fssai_number && !L.address && !L.owner_phone,
  `D1: tenants legal fields all null (${JSON.stringify(L)})`);

const orders = await c.query(`SELECT count(*)::int n FROM orders WHERE tenant_id=$1`, [T]);
const bells = await c.query(`SELECT count(*)::int n FROM notifications WHERE tenant_id=$1`, [T]);
const chat = await c.query(
  `SELECT count(*)::int n FROM conversation_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE tenant_id=$1)`, [T]);
ok(orders.rows[0].n === 36 && bells.rows[0].n === 3 && chat.rows[0].n === 5,
  `D2: orders 36, bells 3, chat 5 (${orders.rows[0].n}/${bells.rows[0].n}/${chat.rows[0].n})`);

const pres = await c.query(`SELECT user_email FROM staff_presence WHERE tenant_id=$1`, [T]);
ok(pres.rows.length === 1 && pres.rows[0].user_email === 'qrowner@qrflowcafe.in',
  `D3: presence owner-only (${pres.rows.map(r => r.user_email).join(', ') || 'empty'})`);

const so = await c.query(`SELECT count(*)::int n FROM storage.objects WHERE bucket_id='menu-photos'`);
ok(so.rows[0].n === 0, `D4: menu-photos holds zero objects (${so.rows[0].n})`);

const cols = await c.query(
  `SELECT count(*)::int n FROM information_schema.columns WHERE table_schema='public' AND table_name='tenants'`);
ok(cols.rows[0].n === 20, `D5: tenants column count unchanged at 20 (${cols.rows[0].n})`);

const pol = await c.query(
  `SELECT count(*)::int n FROM pg_policies WHERE schemaname='public' AND tablename='tenants' AND cmd='UPDATE' AND policyname='Tenant owner update access on own tenant'`);
ok(pol.rows[0].n === 1, `D6: owner UPDATE policy on tenants intact (${pol.rows[0].n})`);

console.log(fails === 0 ? 'TRUTH OK' : `TRUTH FAILED (${fails})`);
await c.end();
process.exit(fails === 0 ? 0 : 1);
