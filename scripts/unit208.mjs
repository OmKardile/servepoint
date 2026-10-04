/* Task 208 — v5.169.0 unit suite: the production sheet (the batch plan's
 * paper voice).
 * Covers the new pure voices in InventoryScreen:
 *   batchVerdictText — THE verdict sentence: the screen strip and the
 *   sheet speak one function (forSheet swaps the Cover pointer for the
 *   paper's restock line); money scales as plain data; null stays honest.
 *   buildProductionSheetText — the house's 32-column register (the
 *   shopping-list family): masthead, rows with shelf/covered/SHORT,
 *   prose NEVER truncated by regTwo, honest end marker.
 *   productionSheetRows — the spreadsheet projection of the SAME
 *   assembly: bare-decimal numbers, unpriced SKUs leave cost cells
 *   EMPTY (a missing cost never prints as ₹0).
 * Run: bunx vite-node scripts/unit208.mjs
 */
import assert from 'node:assert/strict';

const {
  batchVerdictText,
  buildProductionSheetText,
  productionSheetRows,
} = await import('/src/components/inventory/InventoryScreen.tsx');

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const line = (name, need, have, short, perServe, costUnit = 0.3) => ({
  name,
  unit: 'g',
  perServe,
  need,
  have,
  short,
  costUnit,
});

/* live-shaped fixture: Blueberry Muffin ×12 — Flour 960/4,720, Butter 240/4,970 */
const covered = {
  storeName: 'CheeseBurg',
  dish: 'Blueberry Muffin',
  batch: 12,
  lines: [line('Flour', 960, 4720, 0, 80), line('Butter', 240, 4970, 0, 20)],
  fits: true,
  coverage: 58,
  serveCost: 34,
  unpriced: 0,
};

/* ── batchVerdictText: ONE sentence, two surfaces ── */
const vScreen = batchVerdictText({ batch: 12, fits: true, coverage: 58, serveCost: 34 }, false);
assert.equal(
  vScreen,
  'The shelf covers a batch of 12 — about ₹408.00 in ingredients at the costs on file.'
);
ok('verdict fits + money: the same words the strip has spoken since 5.167.0');
assert.equal(batchVerdictText({ batch: 59, fits: true, coverage: 59, serveCost: 34 }, false), batchVerdictText({ batch: 59, fits: true, coverage: 59, serveCost: 34 }, true));
ok('fits ending is surface-independent (no Cover pointer in the green line)');

const dryScreen = batchVerdictText({ batch: 59, fits: false, coverage: 58, serveCost: 34 }, false);
const drySheet = batchVerdictText({ batch: 59, fits: false, coverage: 58, serveCost: 34 }, true);
assert.ok(dryScreen.includes('Cover on a shortfall row'));
assert.ok(!drySheet.includes('Cover'), 'paper cannot click a button');
assert.ok(drySheet.includes('the shortfalls above need a restock first'));
assert.ok(dryScreen.startsWith('A batch of 59 runs the shelf dry at ~58'));
ok('dry verdict: screen points at Cover, the sheet asks for a restock');

const vNull = batchVerdictText({ batch: 12, fits: null, coverage: null, serveCost: null }, false);
assert.ok(vNull.includes("can't answer"));
ok('verdict null stays honest (the shelf can\'t answer)');

const vNoCost = batchVerdictText({ batch: 12, fits: true, coverage: 58, serveCost: null }, false);
assert.ok(vNoCost.endsWith('.') && !vNoCost.includes('₹'));
ok('unpriced serve: the money clause waits, never ₹0');

/* ── buildProductionSheetText: the house register ── */
const sheet = buildProductionSheetText(covered);
const rows = sheet.split('\n');
assert.ok(rows.some((r) => r.trim() === 'PRODUCTION SHEET'));
ok('masthead: PRODUCTION SHEET centered');
assert.ok(rows.some((r) => r.includes('Blueberry Muffin') && r.includes('batch of 12')));
ok('dish + batch on the title line');
const flourRow = rows.findIndex((r) => r.includes('1. Flour'));
assert.ok(flourRow >= 0 && rows[flourRow].includes('960 g'));
assert.ok(rows[flourRow + 1].includes('shelf 4,720 g') && rows[flourRow + 1].includes('covered'));
ok('covered line: need on the register row, shelf+covered beneath');
assert.ok(rows.some((r) => r.includes('The shelf covers a batch of 12 — about ₹408.00')));
ok('verdict rides the sheet VERBATIM (one assembly, no fork)');
assert.ok(rows.some((r) => r.includes('· · · end of sheet · · ·')));
ok('honest end marker (the family rhythm)');

/* the short sheet: SHORT named, paper ending */
const shortSheet = buildProductionSheetText({
  ...covered,
  batch: 59,
  lines: [line('Flour', 4720, 4680, 40, 80), line('Butter', 1180, 4970, 0, 20)],
  fits: false,
});
assert.ok(shortSheet.includes('SHORT 40 g'));
assert.ok(shortSheet.includes('the shortfalls above need a restock first'));
ok('short sheet: shortfall named in the register, paper verdict');

/* prose never rides regTwo: a long dish name truncates on the TITLE (a
 * title may ellipsize), but the VERDICT sentence survives verbatim */
const longDish = buildProductionSheetText({
  ...covered,
  dish: 'The Grand Double-Chocolate Hazelnut Praline Gateau Royale',
});
assert.ok(longDish.includes('The shelf covers a batch of 12 — about ₹408.00 in ingredients at the costs on file.'));
ok('long dish: the verdict prose is NEVER truncated (two() guard)');

/* unpriced note on the sheet */
const unpricedSheet = buildProductionSheetText({ ...covered, serveCost: null, unpriced: 1 });
assert.ok(unpricedSheet.includes('Some ingredients have no cost on file — the rupees wait on the Stock tab.'));
ok('unpriced sheet: the honest note prints beneath the verdict');

/* empty plan: the builder says so instead of printing an empty register */
assert.ok(buildProductionSheetText({ ...covered, lines: [] }).includes('NOTHING TO PULL'));
ok('empty plan: NOTHING TO PULL, never a silent sheet');

/* ── productionSheetRows: the spreadsheet projection ── */
const csv = productionSheetRows(covered);
assert.equal(csv[0][0], 'CheeseBurg — production sheet');
assert.deepEqual(csv[1], ['Blueberry Muffin', 'batch of 12']);
ok('title + meta rows carry the masthead');
assert.equal(csv[3].length, 9);
ok('header row: 9 columns');
const fRow = csv[4];
assert.equal(fRow[0], 'Flour');
assert.equal(fRow[1], 80);
assert.equal(fRow[3], 960);
assert.equal(fRow[4], 4720);
assert.equal(fRow[5], 'covered');
assert.equal(fRow[6], '');
assert.equal(fRow[7], 0.3);
assert.equal(fRow[8], '288.00');
ok('covered row: per-serve 80, bare decimals, line cost 960 × 0.30 = 288.00');
const csvShort = productionSheetRows({
  ...covered,
  batch: 59,
  lines: [line('Flour', 4720, 4680, 40, 80)],
  fits: false,
});
const sRow = csvShort[4];
assert.equal(sRow[5], 'short');
assert.equal(sRow[6], 40);
assert.equal(sRow[8], '1416.00');
ok('short row: shortfall 40 bare, line cost prices the FULL pull (4,720 × 0.30)');
const csvUnpriced = productionSheetRows({ ...covered, lines: [line('Butter', 240, 4970, 0, 20, null)] });
assert.equal(csvUnpriced[4][7], '');
assert.equal(csvUnpriced[4][8], '');
ok('unpriced row: cost cells EMPTY — a missing cost never prints as ₹0');
assert.deepEqual(productionSheetRows({ ...covered, lines: [] }).length, 4);
ok('empty plan: masthead + header only, no fabricated rows');

console.log(`\nunit208 — ${n} asserts, the production sheet (v5.169.0)`);
