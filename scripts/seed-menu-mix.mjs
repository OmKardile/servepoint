// Task 59 — give the live cafe a REAL menu mix so the new per-section
// Z-report / Close-out block ships on honest, multi-section data (the live
// menu was exactly one item — Flat White under one "Coffee" category — a
// provisioning gap, not a product truth).
//
// Idempotent via menu_items.description marker? No — config rows have no
// notes column; the gate is the Bakery category + the two menu items by
// name. Orders carry orders.notes marker 'demo:menu-mix'. Ledger-consistent:
// recipe_lines price every new item through v_item_unit_cost → v_order_cogs,
// so COGS & margin keep working everywhere.
import pg from 'pg';
import { dbPassword } from './db-creds.mjs';

const REF = 'gehjsxopcowmotgrrcgc';
const TENANT = 'd207be19-e86f-4780-befb-3968831a38fe';
const LOCATION = '5dd11592-2c9e-4bcf-b589-585d3270ab16';
const OWNER = 'qrowner@qrflowcafe.in';
const MARKER = 'demo:menu-mix';

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

function istAt(dateIso, hh, mm) {
  return new Date(`${dateIso}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+05:30`);
}

async function main() {
  await c.connect();
  const todayIso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

  // ── gate: Bakery category + the two items exist? ──
  const bakery = await c.query(
    `SELECT id FROM categories WHERE tenant_id = $1 AND name = 'Bakery' LIMIT 1`, [TENANT]);
  let BAKERY = bakery.rows[0]?.id;
  let MUFFIN, SANDWICH;

  if (!BAKERY) {
    await c.query('BEGIN');
    try {
      // ── categories (Coffee already exists at sort 1) ──
      BAKERY = (await c.query(
        `INSERT INTO categories (tenant_id, location_id, name, sort_order) VALUES ($1,$2,'Bakery',2) RETURNING id`,
        [TENANT, LOCATION],
      )).rows[0].id;
      const FOOD = (await c.query(
        `INSERT INTO categories (tenant_id, location_id, name, sort_order) VALUES ($1,$2,'Food',3) RETURNING id`,
        [TENANT, LOCATION],
      )).rows[0].id;
      console.log(`Categories: Bakery ${BAKERY} · Food ${FOOD}`);

      // ── inventory (grams, like Coffee beans) ──
      const ing = async (name, cost) => (await c.query(
        `INSERT INTO inventory_items (tenant_id, location_id, name, current_stock, unit, reorder_point, cost_per_unit)
         VALUES ($1,$2,$3,5000,'g',500,$4) RETURNING id`,
        [TENANT, LOCATION, name, cost],
      )).rows[0].id;
      const FLOUR = await ing('Flour', 0.30);
      const BUTTER = await ing('Butter', 0.50);
      const CHEESE = await ing('Cheese', 1.20);
      console.log(`Inventory: Flour ${FLOUR} · Butter ${BUTTER} · Cheese ${CHEESE}`);

      // ── menu items (5% GST like Flat White; veg; available) ──
      MUFFIN = (await c.query(
        `INSERT INTO menu_items (tenant_id, location_id, category_id, name, description, price, is_veg, is_available, tax_rate_pct)
         VALUES ($1,$2,$3,'Blueberry Muffin','Oven-warm, loaded with wild blueberries',180.00,true,true,5.00) RETURNING id`,
        [TENANT, LOCATION, BAKERY],
      )).rows[0].id;
      SANDWICH = (await c.query(
        `INSERT INTO menu_items (tenant_id, location_id, category_id, name, description, price, is_veg, is_available, tax_rate_pct)
         VALUES ($1,$2,$3,'Veg Grilled Sandwich','Triple-decker grill, mint chutney, melted cheese',260.00,true,true,5.00) RETURNING id`,
        [TENANT, LOCATION, FOOD],
      )).rows[0].id;
      console.log(`Menu: Muffin ${MUFFIN} · Sandwich ${SANDWICH}`);

      // ── recipes (v_item_unit_cost: 80×0.30+20×0.50 = ₹34 · 60×1.20+10×0.50 = ₹77) ──
      for (const [mi, ii, q] of [[MUFFIN, FLOUR, 80], [MUFFIN, BUTTER, 20], [SANDWICH, CHEESE, 60], [SANDWICH, BUTTER, 10]]) {
        await c.query(
          `INSERT INTO recipe_lines (tenant_id, menu_item_id, inventory_item_id, qty_per_serve) VALUES ($1,$2,$3,$4)`,
          [TENANT, mi, ii, q],
        );
      }
      console.log('Recipes: muffin 80g flour + 20g butter (₹34) · sandwich 60g cheese + 10g butter (₹77)');
      await c.query('COMMIT');
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    }
  } else {
    const items = await c.query(
      `SELECT id, name FROM menu_items WHERE tenant_id = $1 AND name IN ('Blueberry Muffin','Veg Grilled Sandwich')`,
      [TENANT],
    );
    MUFFIN = items.rows.find((r) => r.name === 'Blueberry Muffin')?.id;
    SANDWICH = items.rows.find((r) => r.name === 'Veg Grilled Sandwich')?.id;
    console.log('Config already seeded — skipping inserts.');
  }

  // ── day orders: gate on the orders marker ──
  const existing = await c.query(
    `SELECT id, order_number FROM orders WHERE tenant_id = $1 AND notes = $2 ORDER BY created_at`,
    [TENANT, MARKER],
  );
  if (existing.rows.length === 0) {
    await c.query('BEGIN');
    try {
      // 08:40 IST — takeaway, 1× Muffin ₹180 + 5% = ₹189, UPI
      const tA = istAt(todayIso, 8, 40);
      const a = await c.query(
        `INSERT INTO orders (tenant_id, location_id, order_type, status, customer_name,
           subtotal, tax_amount, total, payment_status, payment_method, notes, created_at, updated_at)
         VALUES ($1,$2,'takeaway','completed','Kabir Shah',180.00,9.00,189.00,'completed','upi',$3,$4,$4)
         RETURNING id, order_number`,
        [TENANT, LOCATION, MARKER, tA],
      );
      await c.query(
        `INSERT INTO order_items (tenant_id, order_id, menu_item_id, name, qty, unit_price, item_total, created_at)
         VALUES ($1,$2,$3,'Blueberry Muffin',1,180.00,180.00,$4)`,
        [TENANT, a.rows[0].id, MUFFIN, tA],
      );
      await c.query(
        `INSERT INTO payments (tenant_id, order_id, method, amount, status, confirmed_by_email, created_at)
         VALUES ($1,$2,'upi',189.00,'paid',$3,$4)`,
        [TENANT, a.rows[0].id, OWNER, tA],
      );
      console.log(`Order #${a.rows[0].order_number} ${todayIso} 08:40 — 1× Muffin ₹189 UPI (Bakery)`);

      // 13:15 IST — dine-in, 1× Sandwich ₹260 + 5% = ₹273, cash
      const tB = istAt(todayIso, 13, 15);
      const b = await c.query(
        `INSERT INTO orders (tenant_id, location_id, order_type, status, customer_name,
           subtotal, tax_amount, total, payment_status, payment_method, notes, created_at, updated_at)
         VALUES ($1,$2,'dine_in','completed','Sana Kapoor',260.00,13.00,273.00,'completed','cash',$3,$4,$4)
         RETURNING id, order_number`,
        [TENANT, LOCATION, MARKER, tB],
      );
      await c.query(
        `INSERT INTO order_items (tenant_id, order_id, menu_item_id, name, qty, unit_price, item_total, created_at)
         VALUES ($1,$2,$3,'Veg Grilled Sandwich',1,260.00,260.00,$4)`,
        [TENANT, b.rows[0].id, SANDWICH, tB],
      );
      await c.query(
        `INSERT INTO payments (tenant_id, order_id, method, amount, status, confirmed_by_email, created_at)
         VALUES ($1,$2,'cash',273.00,'paid',$3,$4)`,
        [TENANT, b.rows[0].id, OWNER, tB],
      );
      console.log(`Order #${b.rows[0].order_number} ${todayIso} 13:15 — 1× Sandwich ₹273 cash (Food)`);
      await c.query('COMMIT');
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    }
  } else {
    console.log(`Day orders already seeded (${existing.rows.length}) — skipping.`);
  }

  // ── verification ──
  console.log('\nVerify:');
  const sec = await c.query(
    `SELECT COALESCE(cat.name,'(orphan)') section, SUM(oi.qty) units, SUM(oi.item_total) amount
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN menu_items m ON m.id = oi.menu_item_id
       LEFT JOIN categories cat ON cat.id = m.category_id
      WHERE oi.tenant_id = $1
        AND o.created_at >= ($2 || 'T00:00:00+05:30')::timestamptz
        AND o.created_at <  ($2 || 'T00:00:00+05:30')::timestamptz + interval '1 day'
        AND o.status <> 'cancelled'
      GROUP BY 1 ORDER BY amount DESC`,
    [TENANT, todayIso],
  );
  const s = Object.fromEntries(sec.rows.map((r) => [r.section, { u: Number(r.units), a: Number(r.amount) }]));
  ok('Coffee section ₹2,310 · 9 units (ex-GST item base)', s['Coffee'] && s['Coffee'].a === 2310 && s['Coffee'].u === 9,
    `=${s['Coffee']?.a} · ${s['Coffee']?.u}u`);
  ok('Bakery section ₹180 · 1 unit', s['Bakery'] && s['Bakery'].a === 180 && s['Bakery'].u === 1,
    `=${s['Bakery']?.a} · ${s['Bakery']?.u}u`);
  ok('Food section ₹260 · 1 unit', s['Food'] && s['Food'].a === 260 && s['Food'].u === 1,
    `=${s['Food']?.a} · ${s['Food']?.u}u`);
  const day = await c.query(
    `SELECT count(*) n, COALESCE(SUM(total),0) gross FROM orders
      WHERE tenant_id = $1 AND status <> 'cancelled'
        AND created_at >= ($2 || 'T00:00:00+05:30')::timestamptz
        AND created_at <  ($2 || 'T00:00:00+05:30')::timestamptz + interval '1 day'`,
    [TENANT, todayIso],
  );
  ok('today = 8 live tickets · gross ₹2,736.30', Number(day.rows[0].n) === 8 && Number(day.rows[0].gross) === 2736.3,
    `n=${day.rows[0].n} gross=${day.rows[0].gross}`);
  const cogs = await c.query(
    `SELECT o.notes, c.cogs FROM orders o JOIN v_order_cogs c ON c.order_id = o.id
      WHERE o.tenant_id = $1 AND o.notes = $2 ORDER BY o.created_at`,
    [TENANT, MARKER],
  );
  ok('muffin COGS ₹34 · sandwich COGS ₹77', Number(cogs.rows[0]?.cogs) === 34 && Number(cogs.rows[1]?.cogs) === 77,
    cogs.rows.map((r) => r.cogs).join(' · '));
  console.log('\nEXPECTED SECTION MIX (today, hand-check in UI):');
  for (const r of sec.rows) console.log(`  ${r.section}: ₹${r.amount} · ${r.units}u · ${Math.round((Number(r.amount) / 2606.0) * 100)}% of item base (₹2,606 = gross ₹2,736.30 − GST ₹130.30)`);

  console.log(`\n${pass} pass, ${fail} fail`);
  await c.end();
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
