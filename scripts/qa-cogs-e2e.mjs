// Task 47 — COGS view math E2E on the live cloud (migration 018).
// Verifies v_order_cogs + v_item_unit_cost against first-principles math
// computed from recipe_lines × order_items × cost_per_unit.
// Run: node scripts/qa-cogs-e2e.mjs
import pg from 'pg';
import { dbPassword } from './db-creds.mjs';

const REF = 'gehjsxopcowmotgrrcgc';
const c = new pg.Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com',
  port: 5432,
  user: `postgres.${REF}`,
  password: dbPassword(),
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});

let pass = 0;
let fail = 0;
const ok = (cond, label, detail = '') => {
  if (cond) {
    pass += 1;
    console.log(`  PASS ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
};
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;

try {
  await c.connect();

  // The demo tenant (QR Flow Cafe)
  const T = 'd207be19-e86f-4780-befb-3968831a38fe';

  // ── 1. v_item_unit_cost matches recipe math per menu item ────────────────
  console.log('1) v_item_unit_cost vs recipe math');
  const items = await c.query(
    `SELECT mi.id, mi.name, COALESCE(SUM(rl.qty_per_serve * ii.cost_per_unit), 0) AS expected
       FROM menu_items mi
       LEFT JOIN recipe_lines rl ON rl.menu_item_id = mi.id
       LEFT JOIN inventory_items ii ON ii.id = rl.inventory_item_id
      WHERE mi.tenant_id = $1
      GROUP BY mi.id, mi.name`,
    [T],
  );
  const view = await c.query(
    `SELECT menu_item_id, unit_cost FROM v_item_unit_cost WHERE tenant_id = $1`,
    [T],
  );
  const costMap = new Map(view.rows.map((r) => [r.menu_item_id, Number(r.unit_cost)]));
  let itemOk = true;
  for (const r of items.rows) {
    const got = costMap.get(r.id) ?? 0;
    const exp = Number(r.expected);
    if (!near(got, exp)) {
      itemOk = false;
      console.log(`    mismatch ${r.name}: view=${got} expected=${exp}`);
    }
  }
  ok(itemOk, 'all menu items priced consistently', `${items.rows.length} items checked`);
  const withCost = items.rows.filter((r) => Number(r.expected) > 0);
  ok(withCost.length > 0, 'at least one item has a recipe cost', withCost.map((r) => r.name).join(', '));

  // ── 2. v_order_cogs matches order-line math for every tenant order ───────
  console.log('2) v_order_cogs vs order-line math');
  const expected = await c.query(
    `SELECT o.id, o.order_number, o.status, o.payment_status, o.total,
            COALESCE(SUM(rl.qty_per_serve * oi.qty * ii.cost_per_unit), 0) AS exp_cogs,
            COUNT(oi.id) FILTER (WHERE oi.menu_item_id IS NOT NULL) AS recipe_lines_n
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN recipe_lines rl ON rl.menu_item_id = oi.menu_item_id
       LEFT JOIN inventory_items ii ON ii.id = rl.inventory_item_id
      WHERE o.tenant_id = $1
      GROUP BY o.id
      ORDER BY o.order_number`,
    [T],
  );
  const got = await c.query(`SELECT order_id, cogs FROM v_order_cogs WHERE tenant_id = $1`, [T]);
  const gotMap = new Map(got.rows.map((r) => [r.order_id, Number(r.cogs)]));
  ok(got.rows.length === expected.rows.length, 'one view row per order', `${got.rows.length}/${expected.rows.length}`);
  let orderOk = true;
  for (const r of expected.rows) {
    const g = gotMap.get(r.id);
    if (g === undefined || !near(g, Number(r.exp_cogs))) {
      orderOk = false;
      console.log(`    mismatch #${r.order_number}: view=${g} expected=${r.exp_cogs}`);
    }
  }
  ok(orderOk, 'every order COGS matches Σ qty_per_serve×qty×cost', `${expected.rows.length} orders`);

  // ── 3. the known demo tickets carry real, non-zero COGS ──────────────────
  console.log('3) demo tickets carry real COGS');
  const paid = expected.rows.filter((r) => r.payment_status === 'completed' && r.status !== 'cancelled');
  const paidWithCogs = paid.filter((r) => Number(r.exp_cogs) > 0);
  ok(paid.length > 0, 'paid tickets exist in range', `${paid.length} paid`);
  ok(
    paidWithCogs.length > 0,
    'paid tickets with recipe-priced items',
    paidWithCogs.map((r) => `#${r.order_number} ₹${Number(r.exp_cogs).toFixed(2)}`).join(', '),
  );

  // ── 4. margin math sanity on the biggest paid ticket ─────────────────────
  if (paidWithCogs.length > 0) {
    const top = paidWithCogs[paidWithCogs.length - 1];
    const netRev = Number(top.total) - Number(top.tax_amount ?? 0);
    const margin = netRev - Number(top.exp_cogs);
    const pct = netRev > 0 ? (margin / netRev) * 100 : 0;
    ok(margin > 0 && pct > 0 && pct < 100, 'margin positive & sane on demo ticket',
      `#${top.order_number}: net ₹${netRev.toFixed(2)} − cogs ₹${Number(top.exp_cogs).toFixed(2)} = ₹${margin.toFixed(2)} (${pct.toFixed(0)}%)`);
  }

  // ── 5. items WITHOUT recipes cost 0 (honest zero, not NULL) ──────────────
  console.log('4) recipe-less items price honestly at 0');
  const noRecipe = expected.rows.filter((r) => Number(r.recipe_lines_n) === 0);
  if (noRecipe.length === 0) {
    // fixture: a temp item with NO recipe + a temp order selling it once.
    // BOTH inserts inside the guard — a mid-fixture failure must not leak rows.
    let itemId = null;
    let orderId = null;
    try {
      const mi = await c.query(
        `INSERT INTO menu_items (tenant_id, category_id, name, price)
         VALUES ($1, (SELECT id FROM categories WHERE tenant_id = $1 LIMIT 1), 'zz-cogs-fixture (no recipe)', 100)
         RETURNING id`,
        [T],
      );
      itemId = mi.rows[0].id;
      const fo = await c.query(
        `INSERT INTO orders (tenant_id, location_id, order_type, status, payment_status, subtotal, tax_amount, total)
         VALUES ($1, (SELECT id FROM locations WHERE tenant_id = $1 LIMIT 1),
                 'dine_in', 'completed', 'pending', 100, 5, 105)
         RETURNING id`,
        [T],
      );
      orderId = fo.rows[0].id;
      await c.query(
        `INSERT INTO order_items (tenant_id, order_id, menu_item_id, name, qty, unit_price, item_total)
         VALUES ($1, $2, $3, 'zz-cogs-fixture (no recipe)', 3, 100, 300)`,
        [T, orderId, itemId],
      );
      const f = await c.query(`SELECT cogs FROM v_order_cogs WHERE order_id = $1`, [orderId]);
      ok(f.rows.length === 1 && Number(f.rows[0].cogs) === 0, 'fixture order with recipe-less item prices 0.00',
        `cogs=${f.rows[0]?.cogs}`);
    } finally {
      if (orderId) await c.query(`DELETE FROM orders WHERE id = $1`, [orderId]);
      if (itemId) await c.query(`DELETE FROM menu_items WHERE id = $1`, [itemId]);
      const residue = await c.query(
        `SELECT (SELECT count(*) FROM orders WHERE id = $1) +
                (SELECT count(*) FROM menu_items WHERE id = $2) AS n`,
        [orderId ?? '00000000-0000-0000-0000-000000000000', itemId ?? '00000000-0000-0000-0000-000000000000'],
      );
      ok(Number(residue.rows[0].n) === 0, 'fixture fully cleaned (cascade)');
    }
  } else {
    const zeroOk = noRecipe.every((r) => Number(gotMap.get(r.id) ?? -1) === 0);
    ok(zeroOk, 'their COGS reads 0.00 (not null)');
  }
} catch (e) {
  console.error('FAILED:', e.message);
  fail += 1;
} finally {
  await c.end().catch(() => {});
  console.log(`\n${pass} PASS / ${fail} FAIL`);
  process.exitCode = fail > 0 ? 1 : 0;
}
