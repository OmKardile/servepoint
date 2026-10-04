/* Task 216 — v5.177.0 unit suite: one burn.
 * Covers the shopping list's new source of truth:
 *   InventoryScreen — buildReorderRows(items, burnWeekly): the list's
 *   rows read the ONE burn (computeBurnByIngredient — recipe lines ×
 *   the dishes' paid pace) instead of the sparse stock_deductions
 *   ledger (trg_orders_deduct_stock fires only at `preparing`, so
 *   quick-paid tickets never moved stock and the old ledger read
 *   beans at 274d while the pace said ~6 weeks). The chain
 *   recipes+pace → computeBurnByIngredient → buildReorderRows is
 *   asserted end to end, plus the clause seam (the row's days and the
 *   shelfDaysClause 'burn' words are the SAME shelfDays number) and
 *   buildReorderText's floored register days.
 * Run: bunx vite-node scripts/unit216.mjs
 */
import assert from 'node:assert/strict';

const { buildReorderRows, buildReorderText } = await import(
  '/src/components/inventory/InventoryScreen.tsx'
);
const { computeBurnByIngredient, shelfDaysClause } = await import('/src/lib/shelf.ts');

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const item = (id, name, current_stock, reorder_point, cost_per_unit = 0.5) => ({
  id, name, tenant_id: 't', location_id: null, unit: 'g',
  current_stock, reorder_point, cost_per_unit,
  created_at: '', updated_at: '',
});

const beans = item('beans', 'Coffee beans', 4230, 500, 1.8);
const flour = item('flour', 'Flour', 100, 500, 0.3);

/* 1 — the chain: recipes × pace → the ONE burn → the list's rows. */
const pace = new Map([
  ['fw', 34],
  ['muf', 1],
]);
const recipes = [
  { menu_item_id: 'fw', inventory_item_id: 'beans', qty_per_serve: 18 },
  { menu_item_id: 'muf', inventory_item_id: 'flour', qty_per_serve: 60 },
];
const burn = computeBurnByIngredient(recipes, pace);
assert.equal(burn.get('beans'), 612);
assert.equal(burn.get('flour'), 60);
ok('chain: computeBurnByIngredient(recipe lines × pace) = 612 / 60 g per week');

const rows = buildReorderRows([beans, flour], burn);
const rBeans = rows.find((r) => r.item.id === 'beans');
const rFlour = rows.find((r) => r.item.id === 'flour');

/* 2 — watching row: fat shelf, honest days (4230×7÷612 = 48.38). */
assert.equal(rBeans.burnWeekly, 612);
assert.ok(Math.abs(rBeans.daysLeft - (4230 * 7) / 612) < 1e-9);
assert.equal(rBeans.suggested, 0);
assert.equal(rBeans.needsBuy, false);
ok('beans: 48.38 days left, no buy — the watching row the clause speaks');

/* 3 — the clause seam: the row's days and the family's words are ONE number. */
assert.equal(shelfDaysClause(4230, rBeans.burnWeekly, 'burn'), '~6 weeks at this burn');
ok("clause seam: '~6 weeks at this burn' — the Stock tab's exact words");

/* 4 — flour row: days 100×7÷60 = 11.67 (past cover) but stock 100 sits
 * below the 500 reorder line — the escape hatch buys it a place with a
 * zero suggested (its burn is light; the operator keeps the last word). */
assert.ok(Math.abs(rFlour.daysLeft - (100 * 7) / 60) < 1e-9);
assert.equal(rFlour.needsBuy, true);
assert.equal(rFlour.suggested, 0);
ok('flour: 11.67d left, below reorder line → needsBuy true, suggested 0');

/* 4b — the actual suggested math: ceil(60 − 100) clamps to 0? No — the
 * cover buy is burn×cover − stock = 60 − 100 → 0. A thin bin with a
 * light burn needs nothing; build a REAL buy case. */
const thin = item('cheese', 'Cheese', 100, 500, 1.2);
const burn2 = new Map([['cheese', 612]]);
const rows2 = buildReorderRows([thin], burn2);
assert.equal(rows2[0].suggested, 512); /* ceil(612 − 100) */
assert.equal(rows2[0].estCost, Math.ceil(612 - 100) * 1.2);
assert.equal(rows2[0].needsBuy, true);
ok('buy row: suggested ceil(612−100)=512, est = 512 × ₹1.20');

/* 5 — the reorder-point escape: stock below the line buys a place even
 * when the days are long (pre-existing predicate, now on the ONE burn). */
const lowButSlow = item('cocoa', 'Cocoa', 200, 500, 2);
const rows3 = buildReorderRows([lowButSlow], new Map([['cocoa', 7]]));
assert.equal(rows3[0].needsBuy, true); /* 200 ≤ 500 */
assert.equal(rows3[0].suggested, 0); /* 7 − 200 → nothing to buy yet */
ok('reorder-point escape holds: needsBuy true, suggested 0');

/* 6 — no burn → silence everywhere. */
const silent = buildReorderRows([beans], new Map());
assert.equal(silent[0].burnPerDay, 0);
assert.equal(silent[0].daysLeft, null);
assert.equal(silent[0].needsBuy, false);
ok('no burn → burnPerDay 0, daysLeft null, never on the list');

/* 7 — unread pace (null) → the burn map is empty → the list goes quiet. */
const burnNull = computeBurnByIngredient(recipes, null);
assert.equal(burnNull.size, 0);
assert.equal(buildReorderRows([beans], burnNull)[0].needsBuy, false);
ok('pace null → empty burn → the list never invents');

/* 8 — sort: buying rows first, then soonest-to-dry, then heaviest burn. */
const a = item('a', 'A', 700, 500, 1); /* needsBuy via days 7? 700/(14/7)=350d no; via reorder 700>500 no → watching, days 350 */
const b = item('b', 'B', 100, 500, 1); /* needsBuy: days 1 */
const c = item('c', 'C', 300, 500, 1); /* needsBuy: days 3 */
const rows4 = buildReorderRows([a, b, c], new Map([['a', 14], ['b', 700], ['c', 700]]));
assert.deepEqual(rows4.map((r) => r.item.id), ['b', 'c', 'a']);
ok('sort: buys first by days-left asc, watchers last');

/* 9 — the register's watching line floors (47.6 → "47d cover"), and the
 * covered verdict stays prose. */
const text = buildReorderText({
  storeName: 'QR Flow Cafe',
  coverDays: 7,
  buys: [],
  estTotal: 0,
  watching: [{ name: 'Coffee beans', daysLeft: 47.6 }],
});
assert.ok(text.includes('THE SHELF COVERS THE WEEK'));
assert.ok(text.includes('Every burning SKU has 7+ days.'));
assert.ok(text.includes('Coffee beans'));
assert.ok(text.includes('47d cover'));
ok('register: covered verdict prose + floored "47d cover"');

/* 10 — the register's buy lines carry qty + est (shape regression). */
const text2 = buildReorderText({
  storeName: 'QR Flow Cafe',
  coverDays: 7,
  buys: [{ name: 'Cheese', qty: '512', unit: 'g', est: 614.4 }],
  estTotal: 614.4,
  watching: [],
});
assert.ok(text2.includes('1. Cheese'));
assert.ok(text2.includes('614.40'));
assert.ok(text2.includes('× 512 g'));
ok('register: buy lines keep name, × qty unit, rupees');

console.log(`\nunit216 — ${n} asserts born (one burn)`);
