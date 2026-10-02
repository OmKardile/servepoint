// Task 70 QA fixture — KDS brand tile + ready-stage tint + rhythm per-hour delta.
// The live ledger has NO tickets today yet (post-midnight IST) and the prior-7d
// table-bound window is empty again after qa68's clean, so three paths can't
// fire on real data alone:
//   1. the KDS header logo tile needs the tenant (has logo_url) — fine, but a
//      READY card today is needed to verify the green wash,
//   2. the READY tint itself needs a today order in 'ready',
//   3. the compare tooltip's per-hour delta needs both windows populated at a
//      shared hour-of-day (hour 00 IST chosen: today's fixtures land there by
//      construction; the prior-week fixture is placed at 00:15 IST too).
// Stages THREE honestly-tagged table-bound dine_in tickets, the UI gets
// verified, then `clean` removes them — same stage→verify→clean convention as
// qa68-rhythm-fixture.mjs (which this mirrors).
//
//   node scripts/qa70-kds-fixture.mjs stage|clean
import pg from 'pg';
import { dbConfig } from './db-creds.mjs';

const TID = 'd207be19-e86f-4780-befb-3968831a38fe';
const LOC = '5dd11592-2c9e-4bcf-b589-585d3270ab16';
const T1 = '2550d42e-ab95-4a91-ae61-50d377176d33'; // Main Floor1

const mode = process.argv[2];
if (mode !== 'stage' && mode !== 'clean') {
  console.error('Usage: qa70-kds-fixture.mjs stage|clean');
  process.exit(1);
}

const client = new pg.Client(dbConfig());
await client.connect();

if (mode === 'clean') {
  const del = await client.query(
    `DELETE FROM orders WHERE tenant_id = $1 AND notes = 'kds-fixture' RETURNING order_number`,
    [TID],
  );
  console.log(`cleaned ${del.rowCount} fixture orders: ${del.rows.map((r) => '#' + r.order_number).join(', ') || '(none)'}`);
  await client.end();
  process.exit(0);
}

// IST calendar "today" (UTC+5:30 — advance the clock before slicing the date).
const todayIso = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

// [istDate, istTime, status, customer, payStatus, [[name, variant, qty, unit]]]
const TICKETS = [
  [todayIso, '00:15', 'ready', 'KDS Fixture Ready', 'pending', [['Flat White', null, 1, 220]]],
  [todayIso, '00:40', 'completed', 'KDS Fixture Done', 'completed', [['Cappuccino', null, 1, 220]]],
  ['2026-09-26', '00:15', 'completed', 'KDS Fixture Prior', 'completed', [['Latte', null, 1, 260]]],
];
const GST = 0.05;

for (const [day, tm, status, cust, pay, lines] of TICKETS) {
  const created = new Date(`${day}T${tm}:00+05:30`);
  const sub = lines.reduce((s, [, , qty, unit]) => s + qty * unit, 0);
  const tax = Math.round(sub * GST * 100) / 100;
  const total = Math.round((sub + tax) * 100) / 100;
  const ord = await client.query(
    `INSERT INTO orders (tenant_id, location_id, table_id, order_type, status, customer_name, subtotal, tax_amount, total, payment_status, payment_method, notes, created_at)
     VALUES ($1,$2,$3,'dine_in',$4,$5,$6,$7,$8,$9,'upi','kds-fixture',$10) RETURNING id, order_number`,
    [TID, LOC, T1, status, cust, sub, tax, total, pay, created.toISOString()],
  );
  const oid = ord.rows[0].id;
  for (const [name, variant, qty, unit] of lines) {
    await client.query(
      `INSERT INTO order_items (tenant_id, order_id, name, variant_name, qty, unit_price, item_total)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [TID, oid, name, variant, qty, unit, qty * unit],
    );
  }
  console.log(`staged #${ord.rows[0].order_number} — ${day} ${tm} IST · ${status} · ${cust}`);
}

await client.end();
console.log(`today (IST) = ${todayIso}; stage complete`);
