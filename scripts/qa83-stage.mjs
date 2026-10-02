// Task 83 — stage the door-round fixture: ONE today ticket that lights all
// three "Right now" doors honestly.
//   status='preparing'        → In the kitchen = 1
//   payment_status='pending'  → Unpaid right now = 1 · ₹210.00
//   created_at = now()-12min  → Late prep = 1 (≥10 min KDS SLA)
// Zero side effects by design (verified below):
//   - INSERT does NOT fire trg_orders_deduct_stock (AFTER UPDATE OF status) →
//     zero stock_deductions, zero inventory moves.
//   - table_id IS NULL → sp_sync_table_on_order returns early → zero table hold.
//   - customer_phone IS NULL → sp_touch_customer_from_order returns early →
//     zero customers rows.
//   - INSERT does NOT fire trg_orders_status_history (UPDATE-only) → zero
//     order_status_history.
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
const L = '5dd11592-2c9e-4bcf-b589-585d3270ab16';
let fails = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  if (!cond) fails++;
};

// Baselines BEFORE staging
const before = {
  ded: await c.query(`SELECT count(*)::int AS n FROM stock_deductions WHERE tenant_id=$1`, [T]),
  cust: await c.query(`SELECT count(*)::int AS n FROM customers WHERE tenant_id=$1`, [T]),
  ev: await c.query(
    `SELECT count(*)::int AS n FROM order_status_history e JOIN orders o ON o.id=e.order_id WHERE o.tenant_id=$1`, [T]),
};

const ins = await c.query(
  `INSERT INTO orders
     (tenant_id, location_id, table_id, order_type, status, customer_name,
      subtotal, tax_amount, total, payment_status, created_at)
   VALUES ($1,$2,NULL,'dine_in','preparing','QA Task 83 door probe',
           200.00,10.00,210.00,'pending', now() - interval '12 minutes')
   RETURNING id, order_number, created_at`,
  [T, L],
);
const ord = ins.rows[0];
console.log(`staged order ${ord.id} (#${ord.order_number}) at ${ord.created_at}`);

// Zero-side-effect proofs
const after = {
  ded: await c.query(`SELECT count(*)::int AS n FROM stock_deductions WHERE tenant_id=$1`, [T]),
  cust: await c.query(`SELECT count(*)::int AS n FROM customers WHERE tenant_id=$1`, [T]),
  ev: await c.query(
    `SELECT count(*)::int AS n FROM order_status_history e JOIN orders o ON o.id=e.order_id WHERE o.tenant_id=$1`, [T]),
};
ok(after.ded.rows[0].n === before.ded.rows[0].n, `P1: zero stock deductions (deductions ${before.ded.rows[0].n} → ${after.ded.rows[0].n})`);
ok(after.cust.rows[0].n === before.cust.rows[0].n, `P2: zero customers rows (customers ${before.cust.rows[0].n} → ${after.cust.rows[0].n})`);
ok(after.ev.rows[0].n === before.ev.rows[0].n, `P3: zero status-history events (events ${before.ev.rows[0].n} → ${after.ev.rows[0].n})`);

const shelf = await c.query(
  `SELECT name, current_stock, reorder_point FROM inventory_items WHERE tenant_id=$1 ORDER BY name LIMIT 3`, [T]);
console.log('shelf unchanged sample:', shelf.rows.map(r => `${r.name}=${r.current_stock}`).join(', '));

console.log(`STAGE_ID=${ord.id}`);
console.log(fails === 0 ? 'STAGE OK' : `STAGE FAILED (${fails})`);
await c.end();
process.exit(fails === 0 ? 0 : 1);
