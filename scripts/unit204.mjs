/* Task 204 — v5.165.0 unit suite: what a serve costs (recipe money voice).
 * Covers the new pure voice in InventoryScreen:
 *   recipeCost — sums one serve's lines at each SKU's cost on file;
 *   null when ANY ingredient lacks a price (a partial price is a lie),
 *   culprits named; garbage quantities contribute nothing, never negative.
 * Run: bunx vite-node scripts/unit204.mjs
 */
import assert from 'node:assert/strict';

const { recipeCost } = await import('/src/components/inventory/InventoryScreen.tsx');

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const sku = (id, name, cost) =>
  ({
    id,
    tenant_id: 't',
    location_id: null,
    name,
    unit: 'g',
    current_stock: 1000,
    reorder_point: 100,
    cost_per_unit: cost,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  });

const flour = sku('fl', 'Flour', 0.5);
const butter = sku('bt', 'Butter', 1.2);

/* ── 1 · the honest sum ─────────────────────────────────────────────── */

const read1 = recipeCost(
  [
    { inventory_item_id: 'fl', qty_per_serve: 80 },
    { inventory_item_id: 'bt', qty_per_serve: 20 },
  ],
  [flour, butter],
);
assert.equal(read1.cost, 64); // 80×0.5 + 20×1.2
assert.deepEqual(read1.unpriced, []);
ok('a fully priced serve sums its lines at the costs on file (80×0.5 + 20×1.2 = 64)');

/* ── 2 · the Number(null) trap ──────────────────────────────────────── */

// a null cost must read as NO cost — never as a free ingredient
const free = sku('fr', 'Freebie', null);
const read2 = recipeCost([{ inventory_item_id: 'fr', qty_per_serve: 10 }], [free]);
assert.equal(read2.cost, null);
assert.deepEqual(read2.unpriced, ['Freebie']);
ok('a null cost on file prices the serve as UNKNOWN, never as free');

/* ── 3 · a partial price is a lie ───────────────────────────────────── */

const read3 = recipeCost(
  [
    { inventory_item_id: 'fl', qty_per_serve: 80 },
    { inventory_item_id: 'bt', qty_per_serve: 20 },
  ],
  [flour, sku('bt', 'Butter', null)], // butter unpriced
);
assert.equal(read3.cost, null);
assert.deepEqual(read3.unpriced, ['Butter']);
ok('one unpriced ingredient makes the WHOLE serve unpriceable, culprit named');

/* ── 4 · an ingredient the shelf forgot ─────────────────────────────── */

const read4 = recipeCost(
  [{ inventory_item_id: 'ghost', qty_per_serve: 5 }],
  [flour, butter],
);
assert.equal(read4.cost, null);
assert.deepEqual(read4.unpriced, ['Unknown ingredient']);
ok('a line pointing at a deleted SKU blocks the price honestly');

/* ── 5 · garbage quantities stay sane ───────────────────────────────── */

const read5 = recipeCost(
  [
    { inventory_item_id: 'fl', qty_per_serve: NaN },
    { inventory_item_id: 'bt', qty_per_serve: 20 },
  ],
  [flour, butter],
);
assert.equal(read5.cost, 24); // only the butter line
assert.deepEqual(read5.unpriced, []);
ok('a NaN quantity mid-edit contributes nothing and is not an unpriced ingredient');

const read6 = recipeCost(
  [
    { inventory_item_id: 'fl', qty_per_serve: -5 },
    { inventory_item_id: 'bt', qty_per_serve: 0 },
  ],
  [flour, butter],
);
assert.equal(read6.cost, 0);
ok('a negative or zero quantity contributes nothing — the serve never pays YOU');

/* ── 6 · zero is a real price ───────────────────────────────────────── */

const donated = sku('dn', 'Donated garnish', 0);
const read7 = recipeCost([{ inventory_item_id: 'dn', qty_per_serve: 3 }], [donated]);
assert.equal(read7.cost, 0);
assert.deepEqual(read7.unpriced, []);
ok('a ₹0 cost on file is a REAL price (a donated garnish), not a missing one');

/* ── 7 · empty draft, fractional math ───────────────────────────────── */

const read8 = recipeCost([], [flour, butter]);
assert.equal(read8.cost, 0);
assert.deepEqual(read8.unpriced, []);
ok('an empty draft costs nothing and blocks nothing');

const read9 = recipeCost([{ inventory_item_id: 'fl', qty_per_serve: 2.5 }], [
  sku('fl', 'Flour', 3),
]);
assert.equal(read9.cost, 7.5);
ok('fractional quantities price to the paisa (2.5 × 3 = 7.5)');

/* ── 8 · multiple culprits, in order ────────────────────────────────── */

const read10 = recipeCost(
  [
    { inventory_item_id: 'bt', qty_per_serve: 20 },
    { inventory_item_id: 'ghost', qty_per_serve: 5 },
    { inventory_item_id: 'fl', qty_per_serve: 80 },
  ],
  [flour, sku('bt', 'Butter', null)],
);
assert.equal(read10.cost, null);
assert.deepEqual(read10.unpriced, ['Butter', 'Unknown ingredient']);
ok('multiple culprits are named in walk order — one trip, the whole truth');

console.log(`\n${n} asserts PASS`);
