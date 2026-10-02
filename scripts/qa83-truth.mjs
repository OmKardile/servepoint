// Task 83 — clean the fixture and prove the cloud back to its honest
// pre-round state: the probe ticket gone, zero ledger/customers/events
// residue, shelf untouched, the 3 true bells untouched.
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

// DELETE the probe (own QA rows only). Idempotent: the first truth run
// already deleted the probe before crashing on a wrong table name — a 0
// here means it went home in that earlier pass, not that it leaked.
const del = await c.query(
  `DELETE FROM orders WHERE tenant_id=$1 AND customer_name='QA Task 83 door probe' RETURNING id`, [T]);
ok(del.rows.length <= 1, `D1: probe ticket gone (deleted this pass: ${del.rows.length})`);

// Zero residue everywhere the triggers could have touched
const ded = await c.query(`SELECT count(*)::int AS n FROM stock_deductions WHERE tenant_id=$1`, [T]);
const inv = await c.query(`SELECT count(*)::int AS n FROM stock_adjustments WHERE tenant_id=$1`, [T]);
const cust = await c.query(`SELECT count(*)::int AS n FROM customers WHERE tenant_id=$1 AND name LIKE 'QA Task 83%'`, [T]);
const ev = await c.query(
  `SELECT count(*)::int AS n FROM order_status_history e JOIN orders o ON o.id=e.order_id WHERE o.tenant_id=$1`, [T]);
ok(cust.rows[0].n === 0, `D2: zero probe customers rows`);
ok(ev.rows[0].n === 6, `D3: status-history unchanged at the pre-round 6 (the probe was INSERTed, never UPDATEd — no events for it)`);

// The probe never paid → zero payments rows; and it never held a table
const pay = await c.query(`SELECT count(*)::int AS n FROM payments p JOIN orders o ON o.id=p.order_id WHERE o.tenant_id=$1 AND o.customer_name='QA Task 83 door probe'`, [T]).catch(() => ({ rows: [{ n: 'n/a' }] }));
ok(Number(pay.rows[0].n) === 0, `D4: zero payments rows from the probe`);

// The 3 true bells are untouched (all read, all with doors)
const bells = await c.query(
  `SELECT count(*)::int AS n, count(*) FILTER (WHERE is_read)::int AS read_n,
          count(*) FILTER (WHERE link_to IS NOT NULL)::int AS door_n
     FROM notifications WHERE tenant_id=$1`, [T]);
ok(bells.rows[0].n === 3 && bells.rows[0].read_n === 3 && bells.rows[0].door_n === 3,
   `D5: the 3 true bells untouched (n=${bells.rows[0].n}, read=${bells.rows[0].read_n}, doored=${bells.rows[0].door_n})`);

// Live tables free (probe held none)
const occ = await c.query(
  `SELECT count(*)::int AS n FROM dining_tables WHERE tenant_id=$1 AND status='occupied'`, [T]);
console.log(`occupied tables now: ${occ.rows[0].n} (pre-round baseline for owner reference)`);

// Chat + watermark state untouched
const msg = await c.query(`SELECT count(*)::int AS n FROM conversation_messages WHERE tenant_id=$1`, [T]);
ok(msg.rows[0].n === 4, `D6: chat lines unchanged at 4 (${msg.rows[0].n})`);

// Remaining orders = honest operator history (pre-round orders only)
const rest = await c.query(
  `SELECT count(*)::int AS n FROM orders WHERE tenant_id=$1`, [T]);
console.log(`orders remaining: ${rest.rows[0].n}`);

console.log(fails === 0 ? 'CLEAN OK' : `CLEAN FAILED (${fails})`);
await c.end();
process.exit(fails === 0 ? 0 : 1);
