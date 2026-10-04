/* Task 205 — v5.166.0 unit suite: the shelf's answer joins the editor.
 * Covers the ONE shared math (5.91.0, src/lib/shelf.ts) that the board,
 * the counter's rail, and now the Recipes tab's draft strip all read:
 *   shelfCoverage — min of floor(stock ÷ per-serve); deleted SKU or an
 *   unreadable stock (null/NaN) → unknown (the Number(null)=0 trap,
 *   guarded 5.166.0); zero stock is a real zero; garbage qty is noise;
 *   the draft's minimal lines satisfy the same signature as RecipeLine.
 * Run: bunx vite-node scripts/unit205.mjs
 */
import assert from 'node:assert/strict';

const { shelfCoverage, LOW_COVER, shelfVoice } = await import('/src/lib/shelf.ts');

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const sku = (id, name, stock) =>
  ({
    id,
    tenant_id: 't',
    location_id: null,
    name,
    unit: 'g',
    current_stock: stock,
    reorder_point: 100,
    cost_per_unit: 0.5,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  });

const flour = sku('fl', 'Flour', 4640);
const butter = sku('bt', 'Butter', 4960);

const muffin = [
  { inventory_item_id: 'fl', qty_per_serve: 80 },
  { inventory_item_id: 'bt', qty_per_serve: 20 },
];

/* ── 1 · the honest min: the thinnest SKU decides ──────────────────── */

const read1 = shelfCoverage(muffin, [flour, butter]);
assert.equal(read1.coverage, 58, 'flour 4640/80=58; butter 4960/20=248 — the min wins');
assert.equal(read1.thin?.name, 'Flour', 'the thinnest bin is named');
assert.equal(read1.unknown, false);
ok('honest min: flour 58 binds, butter 248 never leaks');

/* ── 2 · floor, never round up ─────────────────────────────────────── */

assert.equal(shelfCoverage([{ inventory_item_id: 'fl', qty_per_serve: 80 }], [flour]).coverage, 58,
  '4640/80 = 58 exact');
assert.equal(shelfCoverage([{ inventory_item_id: 'fl', qty_per_serve: 70 }], [flour]).coverage, 66,
  '4640/70 = 66.28 → 66 — a half serve is not a serve');
ok('floor: 4640/70=66.28 reads 66, never 67');

/* ── 3 · the Number(null) trap (5.166.0 guard): null stock is UNKNOWN ── */

const ghostFlour = sku('fl', 'Flour', null);
const read3 = shelfCoverage(muffin, [ghostFlour, butter]);
assert.equal(read3.coverage, null, 'null stock refuses the whole count');
assert.equal(read3.unknown, true, 'said honestly as unknowable');
ok('Number(null) trap: null stock reads unknown, never an empty bin');

/* ── 4 · NaN stock is unknown too ──────────────────────────────────── */

const nanFlour = { ...flour, current_stock: NaN };
const read4 = shelfCoverage(muffin, [nanFlour, butter]);
assert.equal(read4.coverage, null);
assert.equal(read4.unknown, true);
ok('NaN stock reads unknown, never a count');

/* ── 5 · zero stock IS a count — the shelf truthfully refuses ──────── */

const dryButter = sku('bt', 'Butter', 0);
const read5 = shelfCoverage(muffin, [flour, dryButter]);
assert.equal(read5.coverage, 0, 'zero stock is a real zero, not unknown');
assert.equal(read5.thin?.name, 'Butter');
assert.equal(shelfVoice(read5), "can't make another — Butter is out");
ok('zero stock: coverage 0 is a count, and the voice says "can\'t make another"');

/* ── 6 · negative stock clamps to the same real zero ───────────────── */

const bentButter = sku('bt', 'Butter', -50);
const read6 = shelfCoverage(muffin, [flour, bentButter]);
assert.equal(read6.coverage, 0, '-50/20 → clamped 0, never a negative serve');
assert.equal(read6.thin?.name, 'Butter');
ok('negative stock clamps to 0, never a negative serve');

/* ── 7 · a line pointing at a deleted SKU ──────────────────────────── */

const read7 = shelfCoverage(
  [...muffin, { inventory_item_id: 'gone', qty_per_serve: 5 }],
  [flour, butter],
);
assert.equal(read7.coverage, null);
assert.equal(read7.unknown, true);
ok('deleted SKU: unknown — coverage unknowable, said honestly');

/* ── 8 · garbage qty lines are noise: skipped, never a fake zero ───── */

const read8 = shelfCoverage(
  [
    { inventory_item_id: 'fl', qty_per_serve: 0 },   // the editor's garbage mid-edit
    { inventory_item_id: 'bt', qty_per_serve: 20 },
  ],
  [flour, butter],
);
assert.equal(read8.coverage, 248, 'butter still counts; the noise line is silent');
assert.equal(read8.thin?.name, 'Butter');
assert.equal(read8.unknown, false, 'noise is not unknown — it is nothing');
ok('garbage qty: silent skip, the sane line still speaks');

/* ── 9 · empty draft: a quiet read ─────────────────────────────────── */

const read9 = shelfCoverage([], [flour, butter]);
assert.equal(read9.coverage, null);
assert.equal(read9.thin, null);
assert.equal(read9.unknown, false, 'no recipe = can\'t answer, but NOT unknowable');
ok('empty draft: null / null / false — quiet, distinguishable from unknown');

/* ── 10 · tie on the min → first line in recipe order binds ────────── */

const tieFlour = sku('fl', 'Flour', 100);   // 100/50 = 2
const tieButter = sku('bt', 'Butter', 60);  // 60/30 = 2
const read10 = shelfCoverage(
  [
    { inventory_item_id: 'fl', qty_per_serve: 50 },
    { inventory_item_id: 'bt', qty_per_serve: 30 },
  ],
  [tieFlour, tieButter],
);
assert.equal(read10.coverage, 2);
assert.equal(read10.thin?.name, 'Flour', 'strict-less keeps the first line on a tie');
ok('tie: strict-less keeps Flour (first line) binding');

/* ── 11 · all-noise draft: no count and no unknown flag ────────────── */

const read11 = shelfCoverage(
  [
    { inventory_item_id: 'fl', qty_per_serve: -3 },
    { inventory_item_id: 'bt', qty_per_serve: NaN },
  ],
  [flour, butter],
);
assert.equal(read11.coverage, null);
assert.equal(read11.thin, null);
assert.equal(read11.unknown, false);
ok('all-noise: null with unknown false — the render\u2019s quiet path');

/* ── 12 · the draft's minimal lines share the RecipeLine signature ─── */

/* the editor's draft carries no id/menu_item_id — the widened ShelfLine
 * signature (5.166.0) takes it with no cast; assert the structural fact
 * through a full RecipeLine-shaped object reading identically */
const fullLine = {
  id: 'r1',
  menu_item_id: 'm1',
  inventory_item_id: 'fl',
  qty_per_serve: 80,
  created_at: '2026-10-01T00:00:00Z',
};
assert.deepEqual(
  shelfCoverage([fullLine], [flour]),
  shelfCoverage([{ inventory_item_id: 'fl', qty_per_serve: 80 }], [flour]),
  'a full RecipeLine and its minimal projection read identically',
);
assert.equal(LOW_COVER, 5, 'the family threshold stays shared');
ok('ShelfLine: draft and RecipeLine ride ONE signature; LOW_COVER shared');

console.log(`\nunit205: ${n} asserts PASS`);
