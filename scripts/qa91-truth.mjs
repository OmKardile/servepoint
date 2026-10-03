// Task 91 — truth script: "the guest sees the licence" leaves the cloud
// exactly as it found it. The RPC payloads were proven to carry the legal
// trio inside apply-037.mjs's self-cleaning probe; the browser E2E staged
// the identity through the OWNER UI (Settings → Business profile), saw the
// footer live on menu + track, then cleared through the same UI.
//   D1  tenants.legal_* back to NULL (honest absence restored)
//   D2  orders 36 / bells 3 / chat 5 / presence owner-only / bucket 0
//   D3  both RPC definitions still carry the payload fields (migration held)
//   D4  schema untouched: tenants 20 columns, no new objects
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
  `SELECT legal_name, gst_number, fssai_number FROM tenants WHERE id=$1`, [T]);
const L = legal.rows[0] || {};
ok(!L.legal_name && !L.gst_number && !L.fssai_number,
  `D1: tenants legal fields all NULL (${JSON.stringify(L)})`);

const orders = await c.query(`SELECT count(*)::int n FROM orders WHERE tenant_id=$1`, [T]);
const bells = await c.query(`SELECT count(*)::int n FROM notifications WHERE tenant_id=$1`, [T]);
const chat = await c.query(
  `SELECT count(*)::int n FROM conversation_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE tenant_id=$1)`, [T]);
const pres = await c.query(`SELECT count(*)::int n FROM staff_presence WHERE tenant_id=$1`, [T]);
const bucket = await c.query(`SELECT count(*)::int n FROM storage.objects WHERE bucket_id='menu-photos'`);
ok(orders.rows[0].n === 36 && bells.rows[0].n === 3 && chat.rows[0].n === 5 && pres.rows[0].n === 1 && bucket.rows[0].n === 0,
  `D2: orders 36, bells 3, chat 5, presence 1, bucket 0 (${orders.rows[0].n}/${bells.rows[0].n}/${chat.rows[0].n}/${pres.rows[0].n}/${bucket.rows[0].n})`);

const defMenu = await c.query("SELECT pg_get_functiondef('public.sp_get_public_menu(text)'::regprocedure) d");
const defOrder = await c.query("SELECT pg_get_functiondef('public.sp_get_public_order(uuid)'::regprocedure) d");
ok(/'gst_number', v_tenant\.gst_number/.test(defMenu.rows[0].d),
  'D3a: sp_get_public_menu still carries the legal trio in its payload');
ok(/'gst_number', v_order\.tenant_gst_number/.test(defOrder.rows[0].d),
  'D3b: sp_get_public_order still carries the legal trio in its payload');

const cols = await c.query(
  `SELECT count(*)::int n FROM information_schema.columns WHERE table_schema='public' AND table_name='tenants'`);
ok(cols.rows[0].n === 20, `D4: tenants still 20 columns (${cols.rows[0].n})`);

console.log(fails === 0 ? 'TRUTH OK' : `TRUTH FAILED (${fails})`);
await c.end();
process.exit(fails === 0 ? 0 : 1);
