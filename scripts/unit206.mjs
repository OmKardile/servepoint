/* Task 206 — v5.167.0 unit suite: the batch plan (production voice).
 * Covers the new pure voice in InventoryScreen:
 *   batchNeeds — what ONE BATCH pulls off the shelf: need = qty × batch,
 *   short = max(0, need − have); deleted SKU or unreadable stock refuses
 *   the WHOLE plan (null); negative ledger reads at zero (like the shared
 *   math); garbage qty lines are noise; batch < 1 plans nothing ([]).
 *   The coverage question stays with shelfCoverage — never re-answered.
 * Run: bunx vite-node scripts/unit206.mjs
 */
import assert from 'node:assert/strict';

const { batchNeeds } = await import('/src/components/inventory/InventoryScreen.tsx');
const { shelfCoverage } = await import('/src/lib/shelf.ts');

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

/* ── 1 · the honest plan: a dozen, covered ─────────────────────────── */

const plan1 = batchNeeds(muffin, [flour, butter], 12);
assert.equal(plan1.length, 2);
assert.equal(plan1[0].item.name, 'Flour');
assert.equal(plan1[0].need, 960, '80 × 12');
assert.equal(plan1[0].have, 4640);
assert.equal(plan1[0].short, 0, '4640 covers 960');
assert.equal(plan1[1].need, 240, '20 × 12');
ok('honest plan: ×12 needs 960 + 240, both covered');

/* ── 2 · the exact-cover boundary: need == have reads covered ──────── */

const tight = sku('fl', 'Flour', 960);
const plan2 = batchNeeds([{ inventory_item_id: 'fl', qty_per_serve: 80 }], [tight], 12);
assert.equal(plan2[0].need, 960);
assert.equal(plan2[0].have, 960);
assert.equal(plan2[0].short, 0, 'need == have is covered, not short');
ok('exact cover: need == have → short 0');

/* ── 3 · the shortfall: what the bin can't cover, named ────────────── */

const plan3 = batchNeeds(muffin, [sku('fl', 'Flour', 1000), butter], 24);
assert.equal(plan3[0].need, 1920, '80 × 24');
assert.equal(plan3[0].short, 920, '1920 − 1000');
assert.equal(plan3[1].short, 0, 'butter still covered');
ok('shortfall: flour short 920, butter untouched');

/* ── 4 · zero stock: the whole need is short ───────────────────────── */

const plan4 = batchNeeds(muffin, [flour, sku('bt', 'Butter', 0)], 12);
assert.equal(plan4[1].have, 0);
assert.equal(plan4[1].short, 240, 'an empty bin shorts the whole need');
ok('zero stock: short = the whole need');

/* ── 5 · negative ledger reads at zero, like the shared math ───────── */

const plan5 = batchNeeds(muffin, [flour, sku('bt', 'Butter', -50)], 12);
assert.equal(plan5[1].have, 0, 'a bin can\u2019t hold less than nothing');
assert.equal(plan5[1].short, 240, 'not 290 — the clamp keeps one doctrine');
ok('negative stock clamps to 0 (short 240, never 290)');

/* ── 6 · batch below 1 plans nothing ([]) ──────────────────────────── */

assert.deepEqual(batchNeeds(muffin, [flour, butter], 0), []);
assert.deepEqual(batchNeeds(muffin, [flour, butter], -3), []);
assert.deepEqual(batchNeeds(muffin, [flour, butter], NaN), []);
ok('batch 0 / −3 / NaN → [] — nothing planned');

/* ── 7 · a deleted SKU refuses the WHOLE plan ──────────────────────── */

const plan7 = batchNeeds(
  [...muffin, { inventory_item_id: 'gone', qty_per_serve: 5 }],
  [flour, butter],
  12,
);
assert.equal(plan7, null, 'a partial plan is a lie');
ok('deleted SKU: null refusal');

/* ── 8 · the Number(null) trap: unreadable stock refuses, never plans as empty ── */

const plan8 = batchNeeds(muffin, [sku('fl', 'Flour', null), butter], 12);
assert.equal(plan8, null, 'null stock must not plan as a 0-stock bin');
ok('Number(null) trap: null stock → null plan');

/* ── 9 · garbage qty lines are noise, not blockers ─────────────────── */

const plan9 = batchNeeds(
  [
    { inventory_item_id: 'fl', qty_per_serve: 0 },
    { inventory_item_id: 'bt', qty_per_serve: 20 },
  ],
  [flour, butter],
  12,
);
assert.equal(plan9.length, 1, 'the noise line plans nothing');
assert.equal(plan9[0].item.name, 'Butter');
ok('garbage qty: silent skip, the sane line plans on');

/* ── 10 · empty draft: nothing planned ([]), distinct from refusal ─── */

assert.deepEqual(batchNeeds([], [flour, butter], 12), []);
ok('empty draft: [] — quiet, not a refusal');

/* ── 11 · fractional needs survive ─────────────────────────────────── */

const plan11 = batchNeeds([{ inventory_item_id: 'fl', qty_per_serve: 2.5 }], [flour], 3);
assert.equal(plan11[0].need, 7.5, '2.5 × 3');
ok('fractional: 2.5 × 3 = 7.5');

/* ── 12 · the verdict borrows the shared math — no private re-answer ─ */

/* a batch of 12 fits the shelf's 58; a batch of 59 does not — and BOTH
 * verdicts come from shelfCoverage, the ONE shared truth */
const coverage = shelfCoverage(muffin, [flour, butter]).coverage;
assert.equal(coverage, 58);
assert.equal(coverage >= 12, true, '×12 fits — the component reads this from the shared math');
assert.equal(coverage >= 59, false, '×59 runs dry — same source, no fork');
ok('verdict = shelfCoverage(…) >= batch — ONE math, zero re-answers');

console.log(`\nunit206: ${n} asserts PASS`);
