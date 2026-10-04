/* Task 212 — v5.173.0 unit suite: the menu's expiry dates.
 * Covers the days-of-cover adoption on MenuScreen (the voices themselves
 * — shelfDays/shelfDaysClause/computePaceByItem — are unit211's ground):
 *   catalogRows / catalogCsvRows — the optional daysByItem map rides the
 *     CatalogOpts; the sheet prints the floored number or EMPTY (never a
 *     dash); absent map = the 5.171.0 file, byte for byte.
 *   menuHealth — dryWeek: dishes the shelf runs dry on WITHIN THE WEEK
 *     (days ≤ 7, the family's cover horizon); null stays silent; the old
 *     signature (no days map) keeps dryWeek empty and everything else
 *     identical.
 * Run: bunx vite-node scripts/unit212.mjs
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

const items = [
  item('i1', 'Latte', 180),
  item('i2', 'Chai', 50, { is_available: false }),
  item('i3', 'Muffin', 60),
  item('i4', 'Fries', 100),
];

const unitCosts = new Map([
  ['i1', 68],
  ['i2', 20],
  ['i3', 18],
  ['i4', 82],
]);
const moverInfo = new Map([['i1', { rank: 1, units: 34, tickets: 24 }]]);

/* daysByItem as the screen's memo builds it: floored days or null for
 * silence. i1 = 48 days (comfortable), i2 = 6 (within the week),
 * i3 = 0 (less than a day), i4 = null (no pace this week). */
const daysByItem = new Map([
  ['i1', 48],
  ['i2', 6],
  ['i3', 0],
  ['i4', null],
]);

const opts = (extra = {}) => ({
  cats: [{ name: 'Coffee', items }],
  variants: [],
  links: new Map(),
  addonNames: new Map(),
  unitCosts,
  moverInfo,
  ...extra,
});

/* ── catalogRows — the days ride the rows ── */

/* 1 — the map's number lands on the row. */
const rows = catalogRows(opts({ daysByItem }));
assert.equal(rows[0].days, 48);
assert.equal(rows[1].days, 6);
ok('catalogRows: days ride from the daysByItem map');

/* 2 — null in the map stays null on the row (silence, not zero). */
assert.equal(rows[3].days, null);
ok('no pace this week → days null — EMPTY on the sheet, never a fake 0');

/* 3 — zero IS a number here: the shelf answers "under a day". */
assert.equal(rows[2].days, 0);
ok('days 0 is a truthful answer ("dry within a day"), not a fabrication');

/* 4 — backward compat: no daysByItem → every row silent, rest unchanged. */
const bare = catalogRows(opts());
assert.equal(bare[0].days, null);
assert.equal(bare[2].days, null);
assert.equal(bare[0].cost, 68);
assert.equal(bare[0].rank, 1);
ok('absent map = the 5.171.0 rows exactly (cost and rank untouched)');

/* ── catalogCsvRows — the sheet's 13th column ── */

/* 5 — header gains 'Days of cover'; meta names the division. */
const csv = catalogCsvRows(opts({ daysByItem }));
const header = csv[3];
assert.equal(header.length, 13);
assert.equal(header[12], 'Days of cover');
assert.ok(String(csv[1][0]).includes('days of cover divide the shelf'));
ok('sheet: 13th column "Days of cover", meta names the pace division');

/* 6 — data rows: number where the shelf answers, EMPTY (null) where not. */
assert.equal(csv[4][12], 48);
assert.equal(csv[6][12], 0);
assert.equal(csv[7][12], null);
ok('data rows print the floored days or EMPTY — silence preserved');

/* 7 — the sheet's SHAPE is fixed (13 columns by design); without the map
 * the days CELLS go empty, never the column. */
const bareCsv = catalogCsvRows(opts());
assert.equal(bareCsv[3].length, 13);
assert.equal(bareCsv[3][12], 'Days of cover');
assert.equal(bareCsv[4].length, 13);
assert.equal(bareCsv[4][12], null);
ok('absent map: same 13-column sheet, days cells print EMPTY');

/* ── menuHealth — the dryWeek forecast ── */

/* 8 — dishes at or under the week's horizon are named; 8 stays out. */
const h = menuHealth({ items, unitCosts, daysByItem });
assert.deepEqual(h.dryWeek, ['Chai', 'Muffin']);
ok('dryWeek names the ≤7-day dishes (6 and 0), not the comfortable 48');

/* 9 — the boundary: exactly 7 is IN the week, 8 is out. */
const boundaryDays = new Map([['i1', 7], ['i2', 8], ['i3', null], ['i4', null]]);
const hb = menuHealth({ items, unitCosts, daysByItem: boundaryDays });
assert.deepEqual(hb.dryWeek, ['Latte']);
ok('boundary: days 7 counts, days 8 does not');

/* 10 — silence rides: null days never forecast, and a sold-out dish can
 * wear two conditions (the lists are independent truths). */
const soldOut = item('i5', 'Toastie', 100, { is_available: false });
const hBoth = menuHealth({
  items: [...items, soldOut],
  unitCosts: new Map([...unitCosts, ['i5', 60]]),
  daysByItem: new Map([['i5', 3]]),
});
assert.ok(hBoth.soldOut.includes('Toastie'));
assert.ok(hBoth.dryWeek.includes('Toastie'));
ok('a sold-out dish with 3 days wears both chips — conditions are independent');

/* 11 — the old signature keeps its shape: dryWeek empty, bands intact. */
const hOld = menuHealth({ items, unitCosts });
assert.deepEqual(hOld.dryWeek, []);
assert.deepEqual(hOld.underCost, ['Fries']);
ok('no days map → dryWeek silent, the 5.171.0 health unchanged');

/* 12 — zero days is IN the forecast (the most urgent voice of all). */
const hZero = menuHealth({ items: [items[2]], unitCosts, daysByItem: new Map([['i3', 0]]) });
assert.deepEqual(hZero.dryWeek, ['Muffin']);
ok('days 0 forecasts loudest — dry within a day is inside the week');

console.log(`\nunit212: ${n} asserts PASS`);
