// Task 60 — seed marked demo TABLE-BOUND tickets across hours of the last few
// prior days so the Floor "floor rhythm" strip (table tickets per IST hour,
// last 7 days) exercises a real cafe curve instead of two sparse buckets.
//
// Curve design (tickets): 8a×1 9a×2 11a×1 12p×2 1p×3 2p×1 4p×2 5p×1 7p×3 8p×4 9p×1
// = 21 tickets over Sep 27–30 + Oct 2 (Oct 1 deliberately LEFT EMPTY — it is the
// "prior day" window behind Reports' today chips, which must keep honestly
// reading "new").
//
// Idempotent via orders.notes marker 'demo:floor-rhythm'. Trigger safety
// (migration 011 sp_sync_table_on_order): these rows insert as status
// 'completed', so the trigger takes the release branch whose WHERE
// active_order_id = NEW.id matches 0 rows — live T1/T2 state is untouched
// (verified before/after below).
import pg from 'pg';
import { dbPassword } from './db-creds.mjs';

const REF = 'gehjsxopcowmotgrrcgc';
const TENANT = 'd207be19-e86f-4780-befb-3968831a38fe';
const LOCATION = '5dd11592-2c9e-4bcf-b589-585d3270ab16';
const OWNER = 'qrowner@qrflowcafe.in';
const MARKER = 'demo:floor-rhythm';

const c = new pg.Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com',
  port: 5432,
  user: `postgres.${REF}`,
  password: dbPassword(),
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; console.log(`  FAIL ${name}${extra ? ' — ' + extra : ''}`); }
};
const n = (x) => Number(x);

/** Absolute IST wall-clock timestamp for YYYY-MM-DD at hh:mm. */
function istAt(dateIso, hh, mm) {
  return new Date(`${dateIso}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+05:30`);
}

/** (date, hour, tableNumber, guests-note, qty, method) — one completed dine-in ticket. */
async function insertSeatTicket({ date, hh, mm, table, qty, method, name }) {
  const unit = 220.00;
  const sub = unit * qty;
  const tax = +(sub * 0.05).toFixed(2);
  const total = +(sub + tax).toFixed(2);
  const at = istAt(date, hh, mm);
  const o = await c.query(
    `INSERT INTO orders (tenant_id, location_id, order_type, status, customer_name,
       table_id, subtotal, tax_amount, total, payment_status, payment_method, notes, created_at, updated_at)
     VALUES ($1,$2,'dine_in','completed',$3,$4,$5,$6,$7,'completed',$8,$9,$10,$10)
     RETURNING id, order_number`,
    [TENANT, LOCATION, name, globalThis.TABLES[table], sub, tax, total, method, MARKER, at],
  );
  const id = o.rows[0].id;
  await c.query(
    `INSERT INTO order_items (tenant_id, order_id, menu_item_id, name, qty, unit_price, item_total, created_at)
     VALUES ($1,$2,$3,'Flat White',$4,$5,$6,$7)`,
    [TENANT, id, globalThis.FW, qty, unit, sub, at],
  );
  await c.query(
    `INSERT INTO payments (tenant_id, order_id, method, amount, status, confirmed_by_email, created_at)
     VALUES ($1,$2,$3,$4,'paid',$5,$6)`,
    [TENANT, id, method, total, OWNER, at],
  );
  console.log(`Order #${o.rows[0].order_number} ${date} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} — Table ${table} · ${qty}× Flat White ₹${total} ${method}`);
}

// The curve: [date, hour, minute, table, qty, method, name]
const SEATS = [
  // 8a ×1
  ['2026-09-30', 8, 10, 'T1', 1, 'upi', 'Rhea Kapadia'],
  // 9a ×2
  ['2026-09-28', 9, 5,  'T2', 1, 'cash', 'Dev Patel'],
  ['2026-10-02', 9, 40, 'T1', 2, 'upi', 'Ishaan Verma'],
  // 11a ×1
  ['2026-09-29', 11, 25, 'T2', 1, 'upi', 'Naina Iyer'],
  // 12p ×2
  ['2026-09-27', 12, 15, 'T1', 2, 'cash', 'Kabir Shah'],
  ['2026-10-02', 12, 50, 'T2', 1, 'upi', 'Tara Menon'],
  // 1p ×3 — lunch peak
  ['2026-09-28', 13, 10, 'T1', 2, 'upi', 'Aditya Rao'],
  ['2026-09-30', 13, 35, 'T2', 1, 'cash', 'Meher Doshi'],
  ['2026-10-02', 13, 55, 'T1', 1, 'upi', 'Zoya Rahman'],
  // 2p ×1
  ['2026-09-29', 14, 20, 'T2', 2, 'upi', 'Vikram Bose'],
  // 4p ×2 — coffee break
  ['2026-09-27', 16, 5,  'T2', 1, 'cash', 'Sana Qureshi'],
  ['2026-09-30', 16, 45, 'T1', 1, 'upi', 'Om Kardile'],
  // 5p ×1
  ['2026-10-02', 17, 30, 'T2', 2, 'upi', 'Lata Pillai'],
  // 7p ×3
  ['2026-09-27', 19, 15, 'T1', 2, 'cash', 'Arnav Sinha'],
  ['2026-09-29', 19, 50, 'T2', 1, 'upi', 'Diya Chandra'],
  ['2026-10-02', 19, 40, 'T1', 2, 'upi', 'Farhan Ali'],
  // 8p ×4 — dinner peak
  ['2026-09-28', 20, 10, 'T1', 2, 'upi', 'Gauri Nene'],
  ['2026-09-30', 20, 25, 'T2', 1, 'cash', 'Harsh Tandon'],
  ['2026-10-02', 20, 5,  'T1', 1, 'upi', 'Imran Shaikh'],
  ['2026-09-27', 20, 55, 'T2', 2, 'upi', 'Jharna Roy'],
  // 9p ×1
  ['2026-09-30', 21, 15, 'T1', 1, 'cash', 'Kiran Bhatt'],
];

const EXPECT_HOURS = SEATS.reduce((m, s) => { m[s[1]] = (m[s[1]] || 0) + 1; return m; }, {});

async function main() {
  await c.connect();

  // ── capture live table state BEFORE (trigger no-harm proof) ──
  const before = await c.query(`SELECT id, table_number, status, active_order_id FROM dining_tables WHERE tenant_id = $1 ORDER BY table_number`, [TENANT]);
  const beforeMap = Object.fromEntries(before.rows.map((r) => [r.table_number, { status: r.status, active: r.active_order_id }]));

  // ── idempotency gate ──
  const existing = await c.query(
    `SELECT id, order_number FROM orders WHERE tenant_id = $1 AND notes = $2 ORDER BY created_at`,
    [TENANT, MARKER],
  );
  if (existing.rows.length > 0) {
    console.log(`Already seeded (${existing.rows.length} floor-rhythm demo orders) — skipping inserts.`);
  } else {
    const fw = await c.query(
      `SELECT id FROM menu_items WHERE tenant_id = $1 AND lower(name) = 'flat white' LIMIT 1`,
      [TENANT],
    );
    if (fw.rows.length === 0) throw new Error('Flat White menu item not found');
    globalThis.FW = fw.rows[0].id;

    const tables = await c.query(
      `SELECT id, table_number FROM dining_tables WHERE tenant_id = $1`,
      [TENANT],
    );
    globalThis.TABLES = Object.fromEntries(tables.rows.map((r) => [r.table_number, r.id]));
    if (!globalThis.TABLES.T1 || !globalThis.TABLES.T2) throw new Error('T1/T2 not found');

    await c.query('BEGIN');
    try {
      for (const s of SEATS) await insertSeatTicket({ date: s[0], hh: s[1], mm: s[2], table: s[3], qty: s[4], method: s[5], name: s[6] });
      await c.query('COMMIT');
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    }
  }

  // ── verification ──
  console.log('\nVerify:');

  const cnt = await c.query(
    `SELECT count(*) n FROM orders WHERE tenant_id = $1 AND notes = $2`,
    [TENANT, MARKER],
  );
  ok('marker count = 21 (idempotent)', n(cnt.rows[0].n) === 21, `=${cnt.rows[0].n}`);

  const byHour = await c.query(
    `SELECT EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Asia/Kolkata'))::int AS h, count(*)::int AS n
       FROM orders WHERE tenant_id = $1 AND notes = $2 GROUP BY 1 ORDER BY 1`,
    [TENANT, MARKER],
  );
  const got = Object.fromEntries(byHour.rows.map((r) => [Number(r.h), Number(r.n)]));
  let hoursOk = true;
  for (const [h, want] of Object.entries(EXPECT_HOURS)) {
    if ((got[h] || 0) !== want) { hoursOk = false; console.log(`    hour ${h}: want ${want}, got ${got[h] || 0}`); }
  }
  ok('hour curve exact (8a×1 9a×2 11a×1 12p×2 1p×3 2p×1 4p×2 5p×1 7p×3 8p×4 9p×1)', hoursOk,
    JSON.stringify(got));

  const dayOk = await c.query(
    `SELECT to_char((created_at AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') d, count(*)::int n
       FROM orders WHERE tenant_id = $1 AND notes = $2 GROUP BY 1 ORDER BY 1`,
    [TENANT, MARKER],
  );
  const oct1 = dayOk.rows.find((r) => r.d === '2026-10-01');
  ok('Oct 1 left empty (prior-day window behind today chips stays "new")', !oct1,
    dayOk.rows.map((r) => `${r.d}:${r.n}`).join(' '));

  const allTableBound = await c.query(
    `SELECT count(*)::int n FROM orders WHERE tenant_id = $1 AND notes = $2 AND table_id IS NOT NULL AND order_type = 'dine_in' AND status = 'completed' AND payment_status = 'completed'`,
    [TENANT, MARKER],
  );
  ok('all seeded rows table-bound completed dine-ins with completed payment', n(allTableBound.rows[0].n) === 21, `=${allTableBound.rows[0].n}`);

  // ── trigger no-harm: live table state unchanged ──
  const after = await c.query(`SELECT id, table_number, status, active_order_id FROM dining_tables WHERE tenant_id = $1 ORDER BY table_number`, [TENANT]);
  const afterMap = Object.fromEntries(after.rows.map((r) => [r.table_number, { status: r.status, active: r.active_order_id }]));
  const untouched = before.rows.every((r) => {
    const a = afterMap[r.table_number];
    const b = beforeMap[r.table_number];
    return a && b && a.status === b.status && a.active === b.active;
  });
  ok('trigger no-harm: T1/T2 status + active_order_id unchanged', untouched,
    after.rows.map((r) => `${r.table_number}:${r.status}`).join(' '));

  // ── what the strip should draw (seeds + live ledger, last 7 IST days) ──
  const strip = await c.query(
    `SELECT EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Asia/Kolkata'))::int AS h, count(*)::int AS n
       FROM orders
      WHERE tenant_id = $1 AND status <> 'cancelled' AND table_id IS NOT NULL
        AND (created_at AT TIME ZONE 'Asia/Kolkata')::date >= (now() AT TIME ZONE 'Asia/Kolkata')::date - 6
      GROUP BY 1 ORDER BY 1`,
    [TENANT],
  );
  const stripMap = Object.fromEntries(strip.rows.map((r) => [Number(r.h), Number(r.n)]));
  const peakH = Object.entries(stripMap).sort((a, b) => b[1] - a[1])[0];
  const total = Object.values(stripMap).reduce((a, b) => a + b, 0);
  console.log('\nEXPECTED STRIP (table-bound, last 7 IST days incl. live):');
  console.log(`  hours: ${JSON.stringify(stripMap)}`);
  console.log(`  peak: ${peakH ? `${peakH[0]}h with ${peakH[1]} tickets` : 'none'} · total seated rounds: ${total}`);

  console.log(`\n${pass} pass, ${fail} fail`);
  await c.end();
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
