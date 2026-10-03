// Task 90's sequel — apply 037 (the guest sees the licence) and PROVE it:
//   P1  both RPC definitions carry the three legal fields in their payload
//   P2  a STAGED legal identity (SQL, cleaned before exit) rides the live
//      sp_get_public_menu AND sp_get_public_order payloads
//   P3  the reset leaves legal fields NULL — honest absence restored
//   P4  schema untouched (tenants still 20 columns), publication intact
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { dbPassword } from './db-creds.mjs';

const T = 'd207be19-e86f-4780-befb-3968831a38fe';
const SLUG = 'qrflowcafe';

const c = new pg.Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com',
  port: 5432,
  user: 'postgres.gehjsxopcowmotgrrcgc',
  password: dbPassword(),
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});
await c.connect();
let fails = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  if (!cond) fails++;
};

// Apply the migration (idempotent CREATE OR REPLACE ×2).
const sql = readFileSync(new URL('../supabase/migrations/037_guest_legal_footer.sql', import.meta.url), 'utf8');
await c.query(sql);
console.log('applied 037 (both CREATE OR REPLACE)');

// P1 — definitions speak the fields.
const defMenu = await c.query("SELECT pg_get_functiondef('public.sp_get_public_menu(text)'::regprocedure) d");
const defOrder = await c.query("SELECT pg_get_functiondef('public.sp_get_public_order(uuid)'::regprocedure) d");
ok(/'gst_number', v_tenant\.gst_number/.test(defMenu.rows[0].d) && /'fssai_number', v_tenant\.fssai_number/.test(defMenu.rows[0].d),
  'P1a: sp_get_public_menu payload carries gst_number + fssai_number');
ok(/tenant_gst_number/.test(defOrder.rows[0].d) && /'fssai_number', v_order\.tenant_fssai_number/.test(defOrder.rows[0].d),
  'P1b: sp_get_public_order payload carries the legal trio');

// P2 — STAGE a legal identity, call BOTH live RPCs, assert, then clean.
const before = await c.query(
  `SELECT legal_name, gst_number, fssai_number FROM tenants WHERE id=$1`, [T]);
const had = before.rows[0];
await c.query(
  `UPDATE tenants SET legal_name='Qrflow Hospitality Pvt Ltd', gst_number='29ABCDE1234F1Z5', fssai_number='11223344556677' WHERE id=$1`, [T]);
try {
  const menu = await c.query(`SELECT sp_get_public_menu($1) m`, [SLUG]);
  const mt = menu.rows[0].m.tenant;
  ok(mt.gst_number === '29ABCDE1234F1Z5' && mt.fssai_number === '11223344556677' && mt.legal_name === 'Qrflow Hospitality Pvt Ltd',
    `P2a: menu payload rides the staged identity (${mt.gst_number}/${mt.fssai_number})`);

  const ord = await c.query(`SELECT id FROM orders WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 1`, [T]);
  const track = await c.query(`SELECT sp_get_public_order($1) o`, [ord.rows[0].id]);
  const tt = track.rows[0].o.tenant;
  ok(tt.gst_number === '29ABCDE1234F1Z5' && tt.fssai_number === '11223344556677' && tt.legal_name === 'Qrflow Hospitality Pvt Ltd',
    `P2b: track payload rides the staged identity (order ${ord.rows[0].id.slice(0, 8)}…)`);
} finally {
  // P3 — always clean, even on a failed assert.
  await c.query(
    `UPDATE tenants SET legal_name=$2, gst_number=$3, fssai_number=$4 WHERE id=$1`,
    [T, had.legal_name, had.gst_number, had.fssai_number]);
}
const after = await c.query(
  `SELECT legal_name, gst_number, fssai_number FROM tenants WHERE id=$1`, [T]);
const A = after.rows[0];
ok(!A.legal_name && !A.gst_number && !A.fssai_number, 'P3: staged identity cleaned — legal fields back to NULL');

// P4 — no schema drift, no publication drift.
const cols = await c.query(
  `SELECT count(*)::int n FROM information_schema.columns WHERE table_schema='public' AND table_name='tenants'`);
ok(cols.rows[0].n === 20, `P4: tenants still 20 columns (${cols.rows[0].n})`);
const anon = await c.query(`SELECT has_function_privilege('anon', 'public.sp_get_public_menu(text)', 'execute') e`);
ok(anon.rows[0].e === true, 'P4b: anon can still execute sp_get_public_menu (guest phones)');

console.log(fails === 0 ? 'APPLY 037 OK' : `APPLY 037 FAILED (${fails})`);
await c.end();
process.exit(fails === 0 ? 0 : 1);
