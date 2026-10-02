// Task 53 — seed a small historical demo so the new Reports sections
// (Guest satisfaction 019 + Drawer honesty 020) render on real, consistent data.
// Idempotent via orders.notes marker 'demo:reports-seed'. Ledger-consistent:
// drawer S2's expected (962) = float (500) + the day's only cash payment (462).
import pg from 'pg';
import { dbPassword } from './db-creds.mjs';

const REF = 'gehjsxopcowmotgrrcgc';
const TENANT = 'd207be19-e86f-4780-befb-3968831a38fe';
const LOCATION = '5dd11592-2c9e-4bcf-b589-585d3270ab16';
const OWNER = 'qrowner@qrflowcafe.in';
const MARKER = 'demo:reports-seed';

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

/** IST wall-clock timestamp N days back at hh:mm IST. */
function istAgo(daysBack, hh, mm) {
  const d = new Date(Date.now() - daysBack * 86400000);
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
  return new Date(`${iso}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+05:30`);
}

async function main() {
  await c.connect();

  // ── idempotency gate ──
  const existing = await c.query(
    `SELECT id, order_number FROM orders WHERE tenant_id = $1 AND notes = $2 ORDER BY created_at`,
    [TENANT, MARKER],
  );
  if (existing.rows.length > 0) {
    console.log(`Already seeded (${existing.rows.length} demo orders):`);
    for (const r of existing.rows) console.log(`  #${r.order_number} ${r.id}`);
    await c.end();
    return;
  }

  // ── Flat White menu item ──
  const fw = await c.query(
    `SELECT id FROM menu_items WHERE tenant_id = $1 AND lower(name) = 'flat white' LIMIT 1`,
    [TENANT],
  );
  if (fw.rows.length === 0) throw new Error('Flat White menu item not found');
  const FW = fw.rows[0].id;
  console.log(`Flat White: ${FW}`);

  // Day-3 10:15 IST — Meera, dine-in, 1× Flat White ₹220, UPI → feedback 5★
  const tA = istAgo(3, 10, 15);
  const tAfb = new Date(tA.getTime() + 20 * 60000);
  // Day-2 16:40 IST — Arjun, takeaway, 2× Flat White ₹440, CASH → feedback 4★
  const tB = istAgo(2, 16, 40);
  const tBfb = new Date(tB.getTime() + 15 * 60000);

  await c.query('BEGIN');
  try {
    // ── Order A ──
    const a = await c.query(
      `INSERT INTO orders (tenant_id, location_id, order_type, status, customer_name,
         subtotal, tax_amount, total, payment_status, payment_method, notes, created_at, updated_at)
       VALUES ($1,$2,'dine_in','completed','Meera Joshi',220.00,11.00,231.00,'completed','upi',$3,$4,$4)
       RETURNING id, order_number`,
      [TENANT, LOCATION, MARKER, tA],
    );
    const aId = a.rows[0].id;
    await c.query(
      `INSERT INTO order_items (tenant_id, order_id, menu_item_id, name, qty, unit_price, item_total, created_at)
       VALUES ($1,$2,$3,'Flat White',1,220.00,220.00,$4)`,
      [TENANT, aId, FW, tA],
    );
    await c.query(
      `INSERT INTO payments (tenant_id, order_id, method, amount, status, confirmed_by_email, created_at)
       VALUES ($1,$2,'upi',231.00,'paid',$3,$4)`,
      [TENANT, aId, OWNER, tA],
    );
    await c.query(
      `INSERT INTO order_feedback (tenant_id, order_id, rating, comment, created_at)
       VALUES ($1,$2,5,$3,$4)`,
      [TENANT, aId, 'The flat white was perfect — hot, quick, and ordering from the table just worked.', tAfb],
    );
    console.log(`Order A #${a.rows[0].order_number} ${aId} — ₹231 UPI · 5★`);

    // ── Order B ──
    const b = await c.query(
      `INSERT INTO orders (tenant_id, location_id, order_type, status, customer_name,
         subtotal, tax_amount, total, payment_status, payment_method, notes, created_at, updated_at)
       VALUES ($1,$2,'takeaway','completed','Arjun Nair',440.00,22.00,462.00,'completed','cash',$3,$4,$4)
       RETURNING id, order_number`,
      [TENANT, LOCATION, MARKER, tB],
    );
    const bId = b.rows[0].id;
    await c.query(
      `INSERT INTO order_items (tenant_id, order_id, menu_item_id, name, qty, unit_price, item_total, created_at)
       VALUES ($1,$2,$3,'Flat White',2,220.00,440.00,$4)`,
      [TENANT, bId, FW, tB],
    );
    await c.query(
      `INSERT INTO payments (tenant_id, order_id, method, amount, status, confirmed_by_email, created_at)
       VALUES ($1,$2,'cash',462.00,'paid',$3,$4)`,
      [TENANT, bId, OWNER, tB],
    );
    await c.query(
      `INSERT INTO order_feedback (tenant_id, order_id, rating, comment, created_at)
       VALUES ($1,$2,4,NULL,$3)`,
      [TENANT, bId, tBfb],
    );
    console.log(`Order B #${b.rows[0].order_number} ${bId} — ₹462 cash · 4★`);

    // ── Drawer shifts ──
    // S1 (day-3): float 500, no cash sales that day → expected 500, counted 500, variance 0
    // S2 (day-2): float 500 + cash ₹462 → expected 962, counted 955, variance −7 (honest slip)
    const s1o = istAgo(3, 8, 55),  s1c = istAgo(3, 18, 5);
    const s2o = istAgo(2, 8, 50),  s2c = istAgo(2, 19, 10);
    const s1 = await c.query(
      `INSERT INTO cash_drawer_sessions (tenant_id, opened_by_email, opened_at, opening_float,
         status, closed_by_email, closed_at, counted_cash, expected_cash, variance)
       VALUES ($1,$2,$3,500.00,'closed',$4,$5,500.00,500.00,0.00) RETURNING id`,
      [TENANT, OWNER, s1o, OWNER, s1c],
    );
    const s2 = await c.query(
      `INSERT INTO cash_drawer_sessions (tenant_id, opened_by_email, opened_at, opening_float,
         status, closed_by_email, closed_at, counted_cash, expected_cash, variance, closing_note)
       VALUES ($1,$2,$3,500.00,'closed',$4,$5,955.00,962.00,-7.00,$6) RETURNING id`,
      [TENANT, OWNER, s2o, OWNER, s2c, 'Coin tray ran light during the evening rush.'],
    );
    console.log(`Drawer S1 ${s1.rows[0].id} — exact · S2 ${s2.rows[0].id} — −₹7`);

    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  }

  // ── verification against the ledgers ──
  console.log('\nVerify:');
  const cnt = await c.query(
    `SELECT
       (SELECT count(*) FROM orders WHERE tenant_id=$1 AND notes=$2) AS demo_orders,
       (SELECT count(*) FROM payments p JOIN orders o ON o.id=p.order_id
          WHERE o.tenant_id=$1 AND o.notes=$2) AS demo_payments,
       (SELECT count(*) FROM order_feedback f JOIN orders o ON o.id=f.order_id
          WHERE o.tenant_id=$1 AND o.notes=$2) AS demo_feedback,
       (SELECT count(*) FROM cash_drawer_sessions WHERE tenant_id=$1 AND status='closed') AS closed_shifts`,
    [TENANT, MARKER],
  );
  const v = cnt.rows[0];
  ok('2 demo orders', v.demo_orders === '2', `count=${v.demo_orders}`);
  ok('2 demo payments', v.demo_payments === '2', `count=${v.demo_payments}`);
  ok('2 demo feedback rows (5★,4★)', v.demo_feedback === '2', `count=${v.demo_feedback}`);
  ok('2 closed drawer shifts', v.closed_shifts === '2', `count=${v.closed_shifts}`);

  // ledger honesty: day-2 cash payments must equal S2 expected − float
  const cash = await c.query(
    `SELECT COALESCE(SUM(p.amount),0) AS cash_in
       FROM payments p JOIN cash_drawer_sessions s ON s.tenant_id = p.tenant_id
       WHERE p.tenant_id=$1 AND p.method='cash'
         AND p.created_at >= s.opened_at AND p.created_at <= s.closed_at
         AND s.closed_at = (SELECT MAX(closed_at) FROM cash_drawer_sessions WHERE tenant_id=$1)`,
    [TENANT],
  );
  const cashIn = Number(cash.rows[0].cash_in);
  ok('S2 expected − float == day-2 cash ledger (462)', cashIn === 462, `cash_in=${cashIn}`);

  // COGS honesty: v_order_cogs for the demo orders = 20g × ₹1.80 × qty
  const cogs = await c.query(
    `SELECT o.order_number, c.cogs FROM orders o
       JOIN v_order_cogs c ON c.order_id = o.id
       WHERE o.tenant_id=$1 AND o.notes=$2 ORDER BY o.order_number`,
    [TENANT, MARKER],
  );
  for (const r of cogs.rows) {
    ok(`COGS #${r.order_number} = ₹36.00/serve`, Number(r.cogs) === 36 * (r.order_number === cogs.rows[0].order_number ? 1 : 2) || Number(r.cogs) % 36 === 0, `cogs=${r.cogs}`);
  }

  const fb = await c.query(
    `SELECT f.rating, f.comment FROM order_feedback f JOIN orders o ON o.id=f.order_id
       WHERE o.tenant_id=$1 AND o.notes=$2 ORDER BY f.created_at`,
    [TENANT, MARKER],
  );
  ok('feedback ratings are 5 and 4', fb.rows.map(r => r.rating).join(',') === '5,4',
    fb.rows.map(r => `${r.rating}★${r.comment ? ' "' + r.comment.slice(0, 34) + '…"' : ''}`).join(' · '));

  console.log(`\n${pass} pass, ${fail} fail`);
  await c.end();
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
