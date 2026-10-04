/* Task 210 — v5.171.0 unit suite: the house catalog (the menu's private
 * voice).
 * Covers the new pure voices in MenuScreen:
 *   catalogRows — the screen's menu state projected as rows: costs, kept
 *     margins, options, add-ons, availability, mover ranks. An unpriced
 *     dish leaves its cost cells null (the sheet prints EMPTY — never ₹0);
 *     a non-mover leaves its rank cells null (silence, not a dash).
 *   catalogCsvRows — the owner's spreadsheet: masthead + meta + 12-column
 *     header + data; keptPct prints as percent rounded to one decimal.
 *   menuHealth — the header strip's math: the same kept% bands the price
 *     chips speak (≥50 healthy, 25–50 thin, <25 priced under its own
 *     kitchen), plus the two silences: sold out, no recipe. A zero price
 *     with a recipe is neither thin nor under — it is skipped, not judged.
 * Run: bunx vite-node scripts/unit210.mjs
 */
import assert from 'node:assert/strict';

const {
  catalogRows,
  catalogCsvRows,
  menuHealth,
} = await import('/src/components/menu/MenuScreen.tsx');

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const item = (id, name, price, extra = {}) => ({
  id,
  tenant_id: 't1',
  category_id: 'c1',
  name,
  description: null,
  price,
  is_veg: true,
  is_available: true,
  ...extra,
});

const cats = [
  { name: 'Coffee', items: [] },
  { name: 'Bakes', items: [] },
];

const items = [
  item('i1', 'Latte', 180, { category_id: 'c1' }),
  item('i2', 'Chai', 50, { category_id: 'c1', is_available: false }),
  item('i3', 'Muffin', 60, { category_id: 'c2' }),
  item('i4', 'Fries', 100, { category_id: 'c2' }),
  item('i5', 'Soup', 90, { category_id: 'c2' }),
  item('i6', 'Toastie', 100, { category_id: 'c2' }),
  item('i7', 'Plain Rice', 80, { category_id: 'cX' }),
];

const variants = [
  { id: 'v1', menu_item_id: 'i1', name: 'Large', price_delta: 30 },
  { id: 'v2', menu_item_id: 'i1', name: 'Small', price_delta: -20 },
  { id: 'v3', menu_item_id: 'i3', name: 'Double', price_delta: 25 },
];

const links = new Map([['i1', new Set(['a2', 'a1'])]]);
const addonNames = new Map([
  ['a1', 'Extra shot'],
  ['a2', 'Oat milk'],
]);
const unitCosts = new Map([
  ['i1', 68],
  ['i2', 20],
  ['i3', 18],
  ['i4', 82],
  ['i6', 60],
  ['i7', 10],
]);
const moverInfo = new Map([
  ['i2', { rank: 1, units: 40, tickets: 31 }],
  ['i1', { rank: 2, units: 22, tickets: 19 }],
]);

const opts = (extra = {}) => ({
  cats: [
    { name: 'Coffee', items: items.filter((i) => i.category_id === 'c1') },
    { name: 'Bakes', items: items.filter((i) => i.category_id === 'c2') },
    { name: 'Uncategorised', items: items.filter((i) => i.category_id === 'cX') },
  ],
  variants,
  links,
  addonNames,
  unitCosts,
  moverInfo,
  ...extra,
});

/* ── catalogRows ─────────────────────────────────────────────────────── */

const rows = catalogRows(opts());
assert.equal(rows.length, 7);
ok('catalogRows: every item rides out, uncategorised included');

assert.equal(rows[0].name, 'Latte');
assert.equal(rows[1].name, 'Chai');
assert.equal(rows[6].name, 'Plain Rice');
assert.equal(rows[6].category, 'Uncategorised');
ok('order mirrors the screen: category array order, orphans last');

const latte = rows[0];
assert.equal(latte.cost, 68);
assert.equal(latte.kept, 112);
assert.ok(Math.abs(latte.keptPct - 112 / 180) < 1e-12);
ok('priced row: cost, kept and keptPct computed from the recipe truth');

const chai = rows[1];
assert.equal(chai.available, false);
ok('sold-out item reads unavailable');

assert.equal(rows[2].options, 1);
assert.equal(latte.options, 2);
assert.equal(rows[5].options, 0);
ok('options counted from the variant rows');

assert.deepEqual(latte.addons, ['Extra shot', 'Oat milk']);
ok('add-ons ride as names, sorted');

assert.equal(chai.rank, 1);
assert.equal(chai.units, 40);
assert.equal(chai.tickets, 31);
const toastie = rows[5];
assert.equal(toastie.rank, null);
assert.equal(toastie.units, null);
assert.equal(toastie.tickets, null);
ok('mover ranks ride; a non-mover is silence, not a dash');

const soup = rows[4];
assert.equal(soup.cost, null);
assert.equal(soup.kept, null);
assert.equal(soup.keptPct, null);
ok('no recipe: cost cells null — EMPTY on the sheet, never ₹0');

/* ── catalogCsvRows ──────────────────────────────────────────────────── */

const csv = catalogCsvRows({ ...opts(), storeName: 'Test Cafe' });
assert.equal(csv[0][0], 'Test Cafe — menu catalog');
ok('masthead speaks the store name');

assert.ok(csv[1][0].startsWith('7 dishes · 6 priced from recipes'));
ok('meta counts dishes and the honestly-priced');

assert.equal(csv[2].length, 0);
ok('blank row separates masthead from the table');

/* 5.173.0 — the sheet gains its 13th column, "Days of cover" (the shelf's
 * answer ÷ the paid week's pace, EMPTY where silent). The twelve below are
 * unchanged; the days column is asserted in unit212. */
assert.deepEqual(
  csv[3],
  ['Category', 'Item', 'Price', 'Cost per serve', 'Kept', 'Kept %', 'Options', 'Add-ons', 'Availability', 'Week rank', 'Units (7d)', 'Tickets (7d)', 'Days of cover'],
);
ok('header row: the twelve columns, named (+ 5.173.0 days column)');

const latteRow = csv[4];
assert.equal(latteRow[3], 68);
assert.equal(latteRow[4], 112);
assert.equal(latteRow[5], 62.2);
assert.equal(latteRow[8], 'available');
assert.equal(latteRow[9], 2);
ok('data row: bare decimals; keptPct prints as percent, one decimal');

const soupRow = csv[8];
assert.equal(soupRow[3], null);
assert.equal(soupRow[4], null);
assert.equal(soupRow[5], null);
ok('unpriced row: cost/kept/pct cells null — downloadCsv prints EMPTY');

const chaiRow = csv[5];
assert.equal(chaiRow[8], 'SOLD OUT');
assert.equal(chaiRow[9], 1);
ok('sold-out row named on the sheet, mover rank riding beside it');

const empty = catalogCsvRows({ ...opts({ cats: [] }), storeName: 'Test Cafe' });
assert.equal(empty.length, 4);
assert.equal(catalogRows({ ...opts({ cats: [] }) }).length, 0);
ok('empty menu: masthead + meta + blank + header, no fabricated rows');

/* ── menuHealth ──────────────────────────────────────────────────────── */

const h = menuHealth({ items, unitCosts });
assert.deepEqual(h.soldOut, ['Chai']);
assert.deepEqual(h.noRecipe, ['Soup']);
assert.deepEqual(h.underCost, ['Fries']);
assert.deepEqual(h.thin, ['Toastie']);
ok('health strip: the four conditions read the same bands the chips speak');

const h2 = menuHealth({
  items: [item('z1', 'Freebie', 0)],
  unitCosts: new Map([['z1', 10]]),
});
assert.equal(h2.noRecipe.length, 0);
assert.equal(h2.underCost.length, 0);
assert.equal(h2.thin.length, 0);
assert.equal(h2.soldOut.length, 0);
ok('zero price with a recipe: skipped, never judged (no divide drama)');

const h3 = menuHealth({ items: [], unitCosts: new Map() });
/* 5.173.0 — the health object carries dryWeek too; an empty menu keeps every list empty. */
assert.deepEqual(h3, { soldOut: [], noRecipe: [], underCost: [], thin: [], dryWeek: [] });
ok('empty menu: total silence — the strip never congratulates');

console.log(`\nunit210 — ${n} asserts, the house catalog (v5.171.0)`);
