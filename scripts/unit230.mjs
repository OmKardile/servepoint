/* Task 230 — v5.191.0 unit suite: the band names the loss.
 * The menu's health strip lumped everything under 25% kept into one chip
 * labelled "priced under cost" — but a dish keeping 12% (price ₹340, cost
 * ₹300) is NOT priced under cost: its price beats its kitchen every sale.
 * The plain reading of the chip's words was a lie the house's own doctrine
 * forbids ("the sentence is a lie" — 5.89's law; "a count you can't date"
 * — 5.187's family). The band splits: price ≤ cost keeps the literal loss
 * words; 0 < kept% < 25% wears its own honest words ("keeps under 25%").
 * Asserted: the four-way boundary truth table (loss −20% and breakeven 0
 * → underCost; squeeze 12% → keepsUnder25; the exact 25% edge starts thin;
 * the exact 50% edge is healthy), a disjointness sweep (no dish wears two
 * bands), the no-recipe and zero-price silences riding the new field, and
 * the forecast's independence (a squeeze with 3 days of cover wears both
 * chips — conditions don't collapse).
 * Run: bunx vite-node scripts/unit230.mjs
 */
import assert from 'node:assert/strict';

const menuM = await import('/src/components/menu/MenuScreen.tsx');
const { menuHealth } = menuM;

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const item = (id, name, price, extra = {}) => ({
  id,
  category_id: 'c1',
  name,
  description: null,
  price,
  is_veg: true,
  is_available: true,
  ...extra,
});

/* ── 1–4. the boundary truth table ──────────────────────────────────── */
const H = menuHealth({
  items: [
    item('b1', 'Loss Leader', 100), // cost 120 → kept −20%: every sale loses money
    item('b2', 'Breakeven', 100),   // cost 100 → kept exactly 0: the kitchen not beaten
    item('b3', 'Squeeze', 100),     // cost 88  → kept 12%: covers, barely
    item('b4', 'Edge', 100),        // cost 75  → kept exactly 25%: thin's floor
    item('b5', 'Healthy', 100),     // cost 50  → kept exactly 50%: the healthy floor
  ],
  unitCosts: new Map([
    ['b1', 120],
    ['b2', 100],
    ['b3', 88],
    ['b4', 75],
    ['b5', 50],
  ]),
});
assert.deepEqual(H.underCost, ['Loss Leader', 'Breakeven'],
  'kept ≤ 0 wears the literal loss words (breakeven included — the price does not BEAT the kitchen)');
assert.deepEqual(H.keepsUnder25, ['Squeeze'],
  'kept 12% is a squeeze — no longer announced as a loss-maker');
assert.deepEqual(H.thin, ['Edge'],
  'kept exactly 25% starts thin — the squeeze band is open below');
assert.equal(H.thin.includes('Healthy') || H.keepsUnder25.includes('Healthy'), false,
  'kept exactly 50% is healthy — no band swallows it');
ok('boundary table: loss ≤ 0 < squeeze < 25 ≤ thin < 50 ≤ healthy');

/* ── 5. the disjointness sweep: no dish wears two bands ─────────────── */
const costs = [40, 55, 70, 76, 80, 88, 95, 100, 110, 130];
let sweep = 0;
for (const c of costs) {
  const h = menuHealth({
    items: [item('s1', 'Dish', 100)],
    unitCosts: new Map([['s1', c]]),
  });
  const worn = ['underCost', 'keepsUnder25', 'thin'].filter((k) => h[k].length > 0);
  assert.ok(worn.length <= 1, `cost ${c} lands in at most one band (got ${worn.join(',')})`);
  /* healthy dishes (kept ≥ 50%, e.g. cost 40 → 60%) wear none — the strip
   * never congratulates; every Judged dish wears exactly one */
  if (100 - c < 50) assert.equal(worn.length, 1, `cost ${c} keeps < 50% — judged, one band`);
  sweep++;
}
ok(`sweep ${sweep} costs 40–130: judged dishes wear exactly one band, healthy wears none`);

/* ── 6. the silences ride the new field ─────────────────────────────── */
const hNoRecipe = menuHealth({
  items: [item('r1', 'Mystery', 100)],
  unitCosts: new Map(),
});
assert.deepEqual(hNoRecipe, { soldOut: [], noRecipe: ['Mystery'], underCost: [], keepsUnder25: [], thin: [], dryWeek: [] },
  'no recipe: the margin stays silent — no band invents a cost');
const hZero = menuHealth({
  items: [item('z1', 'Freebie', 0)],
  unitCosts: new Map([['z1', 10]]),
});
assert.equal(hZero.underCost.length + hZero.keepsUnder25.length + hZero.thin.length, 0,
  'zero price: skipped, never judged (no divide drama)');
ok('silences intact: no-recipe and zero-price stay out of every band');

/* ── 7. the forecast is independent of the bands ────────────────────── */
const hBoth = menuHealth({
  items: [item('d1', 'Dry Squeeze', 100)],
  unitCosts: new Map([['d1', 92]]), // kept 8% → squeeze
  daysByItem: new Map([['d1', 3]]), // 3 days of cover → within the week
});
assert.ok(hBoth.keepsUnder25.includes('Dry Squeeze'), 'the squeeze band speaks');
assert.ok(hBoth.dryWeek.includes('Dry Squeeze'), 'the forecast speaks');
ok('a squeeze with 3 days wears both chips — conditions are independent');

/* ── 8. the old shape still opens: no days map → dryWeek silent ─────── */
const hOld = menuHealth({
  items: [item('o1', 'Squeeze', 100)],
  unitCosts: new Map([['o1', 88]]),
});
assert.deepEqual(hOld.dryWeek, []);
assert.deepEqual(hOld.keepsUnder25, ['Squeeze']);
ok('the 5.171.0 signature keeps its shape — dryWeek silent, bands spoken');

console.log(`\nunit230 — ${n} asserts, all green.`);
