// Task 68 QA fixture — floor-rhythm "vs prior wk" gray-line path verification.
// The live ledger has ZERO table-bound tickets in the prior 7d window (the two
// Sep 22/24 orders are counter tickets, honestly excluded by the rhythm rule),
// so the compare Line path can't fire on real data alone. This stages TWO
// honestly-tagged table-bound dine_in tickets inside the prior window
// ([Sep 20, Sep 27) IST), the UI gets verified, then `clean` removes them —
// same stage→verify→clean convention as qa-reports-fixtures.mjs.
//
//   SUPABASE_DB_PASSWORD='…' node scripts/qa68-rhythm-fixture.mjs stage|clean
import pg from 'pg';
import { dbConfig } from './db-creds.mjs';

const TID = 'd207be19-e86f-4780-befb-3968831a38fe';
const LOC = '5dd11592-2c9e-4bcf-b589-585d3270ab16';
const T1 = '2550d42e-ab95-4a91-ae61-50d377176d33'; // Main Floor1

const mode = process.argv[2];
if (mode !== 'stage' && mode !== 'clean') {
  console.error("Usage: qa68-rhythm-fixture.mjs stage|clean");
  process.exit(1);
}

const client = new pg.Client(dbConfig());
await client.connect();

if (mode === 'clean') {
  const del = await client.query(
    `DELETE FROM orders WHERE tenant_id = $1 AND notes = 'rhy-fixture' RETURNING order_number`,
    [TID],
  );
  console.log(`cleaned ${del.rowCount} fixture orders: ${del.rows.map((r) => '#' + r.order_number).join(', ') || '(none)'}`);
  await client.end();
  process.exit(0);
}

// [istDate, istHour, customer, [[name, variant, qty, unit]]]
const TICKETS = [
  ['2026-09-25', 20, 'Prior-Week Fixture A', [['Flat White', null, 2, 440]]],
  ['2026-09-26', 10, 'Prior-Week Fixture B', [['Cappuccino', null, 1, 220]]],
];
const GST = 0.05;

for (const [day, h, cust, lines] of TICKETS) {
  const created = new Date(`${day}T${String(h).padStart(2, '0')}:15:00+05:30`);
  const sub = lines.reduce((s, [, , qty, unit]) => s + qty * unit, 0);
  const tax = Math.round(sub * GST * 100) / 100;
  const total = Math.round((sub + tax) * 100) / 100;
  const ord = await client.query(
    `INSERT INTO orders (tenant_id, location_id, table_id, order_type, status, customer_name, subtotal, tax_amount, total, payment_status, payment_method, notes, created_at)
     VALUES ($1,$2,$3,'dine_in','completed',$4,$5,$6,$7,'completed','upi','rhy-fixture',$8) RETURNING id, order_number`,
    [TID, LOC, T1, cust, sub, tax, total, created.toISOString()],
  );
  const oid = ord.rows[0].id;
  for (const [name, variant, qty, unit] of lines) {
    await client.query(
      `INSERT INTO order_items (tenant_id, order_id, name, variant_name, qty, unit_price, item_total)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [TID, oid, name, variant, qty, unit, qty * unit],
    );
  }
  console.log(`#${ord.rows[0].order_number} dine_in ${cust} ₹${total} @IST ${day} ${h}:15 (prior window)`);
}

await client.end();
