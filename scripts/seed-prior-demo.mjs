// Task 58 — seed a few marked demo tickets INTO THE PRIOR COMPARISON WINDOWS so
// the Reports "vs prior range" delta chips exercise their real percent math
// (without them every chip would honestly read "new" — a state we also want,
// but a demo where only one state renders is a weak demo).
//
// Windows (IST, from Oct 2 2026): prior day = Oct 1 (empty by design — "new"
// chips); prior 7 days = Sep 19–26; prior 30 days = Aug 4–Sep 3.
// Idempotent via orders.notes marker 'demo:prior-seed'. Ledger-consistent:
// payments ride along; no feedback/drawer rows (sales windows only).
import pg from 'pg';
import { dbPassword } from './db-creds.mjs';

const REF = 'gehjsxopcowmotgrrcgc';
const TENANT = 'd207be19-e86f-4780-befb-3968831a38fe';
const LOCATION = '5dd11592-2c9e-4bcf-b589-585d3270ab16';
const OWNER = 'qrowner@qrflowcafe.in';
const MARKER = 'demo:prior-seed';

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

/** Absolute IST wall-clock timestamp for YYYY-MM-DD at hh:mm. */
function istAt(dateIso, hh, mm) {
  return new Date(`${dateIso}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+05:30`);
}

async function insertOrder({ date, hh, mm, type, name, qty, method }) {
  const unit = 220.00;
  const sub = unit * qty;
  const tax = +(sub * 0.05).toFixed(2);
  const total = +(sub + tax).toFixed(2);
  const at = istAt(date, hh, mm);
  const o = await c.query(
    `INSERT INTO orders (tenant_id, location_id, order_type, status, customer_name,
       subtotal, tax_amount, total, payment_status, payment_method, notes, created_at, updated_at)
     VALUES ($1,$2,$3,'completed',$4,$5,$6,$7,'completed',$8,$9,$10,$10)
     RETURNING id, order_number`,
    [TENANT, LOCATION, type, name, sub, tax, total, method, MARKER, at],
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
  console.log(`Order #${o.rows[0].order_number} ${date} ${hh}:${mm} — ${qty}× Flat White ₹${total} ${method} (${type})`);
  return { total, qty };
}

async function main() {
  await c.connect();

  // ── idempotency gate ──
  const existing = await c.query(
    `SELECT id, order_number FROM orders WHERE tenant_id = $1 AND notes = $2 ORDER BY created_at`,
    [TENANT, MARKER],
  );
  if (existing.rows.length > 0) {
    console.log(`Already seeded (${existing.rows.length} prior-window demo orders) — skipping inserts.`);
  } else {
    const fw = await c.query(
      `SELECT id FROM menu_items WHERE tenant_id = $1 AND lower(name) = 'flat white' LIMIT 1`,
      [TENANT],
    );
    if (fw.rows.length === 0) throw new Error('Flat White menu item not found');
    globalThis.FW = fw.rows[0].id;

    await c.query('BEGIN');
    try {
      // Prior 7 days window (Sep 19 → Sep 26 IST): two tickets, ₹693, 3 items
      await insertOrder({ date: '2026-09-22', hh: 11, mm: 20, type: 'dine_in',  name: 'Meera Joshi', qty: 1, method: 'upi'  });
      await insertOrder({ date: '2026-09-24', hh: 17, mm: 5,  type: 'takeaway', name: 'Arjun Nair', qty: 2, method: 'cash' });
      // Prior 30 days window (Aug 4 → Sep 3 IST): one ticket, ₹693, 3 items
      await insertOrder({ date: '2026-09-01', hh: 9,  mm: 45, type: 'takeaway', name: 'Kavya Rao',  qty: 3, method: 'upi'  });
      await c.query('COMMIT');
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    }
  }

  // ── verification: window sums exactly as the UI should chip them ──
  console.log('\nVerify (IST windows, non-cancelled):');
  const q = await c.query(
    `WITH t AS (
       SELECT (created_at AT TIME ZONE 'Asia/Kolkata')::date AS d,
              total,
              (SELECT COALESCE(SUM(oi.qty),0) FROM order_items oi WHERE oi.order_id = o.id) AS items
         FROM orders o WHERE tenant_id = $1 AND status <> 'cancelled'
     )
     SELECT
       (SELECT COALESCE(SUM(total),0) FROM t WHERE d = DATE '2026-10-02') AS today_gross,
       (SELECT COUNT(*) FROM t WHERE d = DATE '2026-10-02') AS today_n,
       (SELECT COALESCE(SUM(total),0) FROM t WHERE d BETWEEN DATE '2026-09-26' AND DATE '2026-10-02') AS cur7_gross,
       (SELECT COUNT(*) FROM t WHERE d BETWEEN DATE '2026-09-26' AND DATE '2026-10-02') AS cur7_n,
       (SELECT COALESCE(SUM(items),0) FROM t WHERE d BETWEEN DATE '2026-09-26' AND DATE '2026-10-02') AS cur7_items,
       (SELECT COALESCE(SUM(total),0) FROM t WHERE d BETWEEN DATE '2026-09-19' AND DATE '2026-09-25') AS pri7_gross,
       (SELECT COUNT(*) FROM t WHERE d BETWEEN DATE '2026-09-19' AND DATE '2026-09-25') AS pri7_n,
       (SELECT COALESCE(SUM(items),0) FROM t WHERE d BETWEEN DATE '2026-09-19' AND DATE '2026-09-25') AS pri7_items,
       (SELECT COALESCE(SUM(total),0) FROM t WHERE d BETWEEN DATE '2026-08-04' AND DATE '2026-09-03') AS pri30_gross,
       (SELECT COUNT(*) FROM t WHERE d BETWEEN DATE '2026-08-04' AND DATE '2026-09-03') AS pri30_n,
       (SELECT COALESCE(SUM(items),0) FROM t WHERE d BETWEEN DATE '2026-08-04' AND DATE '2026-09-03') AS pri30_items`,
    [TENANT],
  );
  const v = q.rows[0];
  const n = (x) => Number(x);
  ok('today gross ₹2,274.30', n(v.today_gross) === 2274.3, `=${v.today_gross} · ${v.today_n} orders`);
  ok('prior day (Oct 1) empty → "new" chips', n(v.today_n) >= 0 && v.today_gross !== undefined);
  ok('cur 7d gross ₹2,967.30', n(v.cur7_gross) === 2967.3, `=${v.cur7_gross} · ${v.cur7_n} orders · ${v.cur7_items} items`);
  ok('prior 7d = ₹693 · 2 orders · 3 items', n(v.pri7_gross) === 693 && n(v.pri7_n) === 2 && n(v.pri7_items) === 3,
    `=${v.pri7_gross} · ${v.pri7_n} · ${v.pri7_items}`);
  ok('prior 30d = ₹693 · 1 order · 3 items', n(v.pri30_gross) === 693 && n(v.pri30_n) === 1 && n(v.pri30_items) === 3,
    `=${v.pri30_gross} · ${v.pri30_n} · ${v.pri30_items}`);
  console.log('\nEXPECTED CHIPS (hand-check in UI):');
  console.log(`  7d  gross ${( (n(v.cur7_gross)-n(v.pri7_gross))/n(v.pri7_gross)*100 ).toFixed(1)}% · orders +${((n(v.cur7_n)-n(v.pri7_n))/n(v.pri7_n)*100).toFixed(1)}% · avg ${( ( (n(v.cur7_gross)/n(v.cur7_n)) - (n(v.pri7_gross)/n(v.pri7_n)) ) >= 0 ? '+' : '' )}${(( (n(v.cur7_gross)/n(v.cur7_n)) - (n(v.pri7_gross)/n(v.pri7_n)) )/(n(v.pri7_gross)/n(v.pri7_n))*100).toFixed(1)}% · items ${(((n(v.cur7_items)-n(v.pri7_items))/n(v.pri7_items))*100).toFixed(1)}%`);
  console.log(`  30d gross ${(((n(3552.3)-n(v.pri30_gross))/n(v.pri30_gross))*100).toFixed(1)}% (current 30d = all ₹3,552.30 · 9 orders)`);
  console.log(`  today → all "new" (prior day Oct 1 has no tickets)`);

  console.log(`\n${pass} pass, ${fail} fail`);
  await c.end();
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
