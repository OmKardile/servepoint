// Task 73 QA fixture — Close-out day-ledger CSV export.
// The live ledger has NO tickets today (post-midnight IST), so the CSV button
// would sit honestly disabled. Stages TWO honestly-tagged tickets to prove the
// export's join paths end-to-end:
//   #1 dine_in paid cash — single payments row (join path, single method)
//   #2 takeaway paid     — order.payment_method set AND two split payment rows
//                          (cash + upi) → the join must win with "cash + upi"
// COGS stays empty on purpose: these items carry no recipe mapping, and the
// export must honestly leave the column blank rather than invent numbers.
//
//   node scripts/qa73-eod-fixture.mjs stage|clean
import pg from 'pg';
import { dbConfig } from './db-creds.mjs';

const TID = 'd207be19-e86f-4780-befb-3968831a38fe';
const LOC = '5dd11592-2c9e-4bcf-b589-585d3270ab16';
const T1 = '2550d42e-ab95-4a91-ae61-50d377176d33'; // Main Floor1

const mode = process.argv[2];
if (mode !== 'stage' && mode !== 'clean') {
  console.error('Usage: qa73-eod-fixture.mjs stage|clean');
  process.exit(1);
}

const client = new pg.Client(dbConfig());
await client.connect();

if (mode === 'clean') {
  const del = await client.query(
    `DELETE FROM orders WHERE tenant_id = $1 AND notes = 'eod-fixture' RETURNING order_number`,
    [TID],
  );
  console.log(`cleaned ${del.rowCount} fixture orders: ${del.rows.map((r) => '#' + r.order_number).join(', ') || '(none)'}`);
  const orphan = await client.query(
    `SELECT count(*)::int AS n FROM payments p LEFT JOIN orders o ON o.id = p.order_id WHERE o.id IS NULL`,
  );
  console.log(`orphan payments: ${orphan.rows[0].n}`);
  await client.end();
  process.exit(0);
}

// IST calendar "today" (UTC+5:30 — advance the clock before slicing the date).
const todayIso = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const GST = 0.05;

// [istTime, order_type, status, customer, payStatus, payMethod, [[name, qty, unit]], splits]
const TICKETS = [
  ['00:10', 'dine_in', 'completed', 'EOD Fixture Cash', 'completed', 'cash', [['Flat White', 1, 220]], [['cash', 231]]],
  ['00:35', 'takeaway', 'completed', 'EOD Fixture Split', 'completed', 'upi', [['Cappuccino', 2, 220]], [['cash', 100], ['upi', 362]]],
];

for (const [tm, otype, status, cust, pay, method, lines, splits] of TICKETS) {
  const created = new Date(`${todayIso}T${tm}:00+05:30`);
  const sub = lines.reduce((s, [, qty, unit]) => s + qty * unit, 0);
  const tax = Math.round(sub * GST * 100) / 100;
  const total = Math.round((sub + tax) * 100) / 100;
  const ord = await client.query(
    `INSERT INTO orders (tenant_id, location_id, table_id, order_type, status, customer_name, subtotal, tax_amount, total, payment_status, payment_method, notes, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'eod-fixture',$12) RETURNING id, order_number`,
    [TID, LOC, otype === 'dine_in' ? T1 : null, otype, status, cust, sub, tax, total, pay, method, created.toISOString()],
  );
  const oid = ord.rows[0].id;
  for (const [name, qty, unit] of lines) {
    await client.query(
      `INSERT INTO order_items (tenant_id, order_id, name, qty, unit_price, item_total)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [TID, oid, name, qty, unit, qty * unit],
    );
  }
  for (const [m, amt] of splits) {
    await client.query(
      `INSERT INTO payments (tenant_id, order_id, method, amount, created_at)
       VALUES ($1,$2,$3,$4,$5)`,
      [TID, oid, m, amt, created.toISOString()],
    );
  }
  console.log(`staged #${ord.rows[0].order_number} — ${todayIso} ${tm} IST · ${otype} · ${cust} · total ${total}`);
}

await client.end();
console.log(`today (IST) = ${todayIso}; stage complete`);
