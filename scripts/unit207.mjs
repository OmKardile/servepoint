/* Task 207 — v5.168.0 unit suite: the cover plan (the shortfall's honest
 * arithmetic).
 * Covers the new pure voice in InventoryScreen:
 *   coverPlan — gap = what covers THIS batch exactly; pull = the batch's
 *   full draw; afterGap = where the bin ends if you deliver the gap
 *   (0 on a short bin — it empties as the batch bakes); afterPull = where
 *   the bin ends if you deliver the full pull (the shelf on file — parity).
 *   Built ON batchNeeds (the 5.167.0 voice) — never re-answers coverage.
 * Run: bunx vite-node scripts/unit207.mjs
 */
import assert from 'node:assert/strict';

const { batchNeeds, coverPlan } = await import('/src/components/inventory/InventoryScreen.tsx');

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

/* live-shaped fixture: Flour 4,680 g ÷ 80 g/serve, Butter 4,970 g ÷ 20 g/serve */
const FLOUR = sku('f1', 'Flour', 4680);
const BUTTER = sku('b1', 'Butter', 4970);
const items = [FLOUR, BUTTER];

/* 1 — the short bin: gap is the exact shortfall, pull the full draw.
 * batch of 59: Flour need 4,720 vs shelf 4,680 → gap 40, pull 4,720. */
const plan = batchNeeds(
  [
    { inventory_item_id: 'f1', qty_per_serve: 80 },
    { inventory_item_id: 'b1', qty_per_serve: 20 },
  ],
  items,
  59
);
const flour = coverPlan(plan[0]);
assert.equal(flour.gap, 40);
ok('short bin: gap = need − have (4,720 − 4,680 = 40)');
assert.equal(flour.pull, 4720);
ok('short bin: pull = the batch\u2019s full draw (80 × 59 = 4,720)');

/* 2 — delivering exactly the gap empties the bin as the batch bakes. */
assert.equal(flour.afterGap, 0);
ok('afterGap = 0 on a short bin: deliver the gap, the bin ends empty');

/* 3 — delivering the full pull keeps the shelf where it stands (parity). */
assert.equal(flour.afterPull, 4680);
ok('afterPull = the shelf on file: deliver the pull, parity kept');

/* 4 — the covered bin: gap 0, and the gap-path leftover is honest.
 * Butter for ×59: need 1,180 vs shelf 4,970 → covered; afterGap = 3,790. */
const butter = coverPlan(plan[1]);
assert.equal(butter.gap, 0);
ok('covered bin: gap = 0 — nothing to deliver');
assert.equal(butter.afterGap, 4970 - 1180);
ok('covered bin: afterGap = the leftover after the bake (3,790)');
assert.equal(butter.afterPull, 4970);
ok('covered bin: afterPull = the shelf on file');

/* 5 — zero stock: gap and pull agree, and both paths end at zero-baked
 * parity (bin at 0, deliver the whole pull, bake empties it again). */
const out = batchNeeds([{ inventory_item_id: 'f1', qty_per_serve: 80 }], [sku('f1', 'Flour', 0)], 12);
const zero = coverPlan(out[0]);
assert.equal(zero.gap, 960);
assert.equal(zero.pull, 960);
ok('zero bin: gap = pull — the whole draw must arrive');
assert.equal(zero.afterGap, 0);
ok('zero bin: afterGap = 0 — exact-cover boundary holds at zero stock');

/* 6 — a negative ledger reads at zero (the shared clamp), so gap = pull. */
const neg = batchNeeds([{ inventory_item_id: 'f1', qty_per_serve: 80 }], [sku('f1', 'Flour', -50)], 12);
const clamp = coverPlan(neg[0]);
assert.equal(clamp.gap, 960);
assert.equal(clamp.afterGap, 0);
ok('negative ledger clamps to zero: gap 960, afterGap 0');

/* 7 — exact-cover boundary (the unit206 doctrine, re-asserted through the
 * cover voice): deliver the gap and the bin covers the batch EXACTLY. */
const boundary = batchNeeds([{ inventory_item_id: 'f1', qty_per_serve: 80 }], [sku('f1', 'Flour', 4600)], 58);
const edge = coverPlan(boundary[0]);
assert.equal(edge.gap, 40);
const afterDeliver = 4600 + edge.gap;
assert.equal(afterDeliver, 4640);
assert.ok(afterDeliver / 80 >= 58);
ok('exact-cover boundary: shelf + gap covers the batch precisely (4,640 ÷ 80 = 58)');

/* 8 — fractional qty survives the plan honestly (7.5 stays 7.5). */
const frac = batchNeeds([{ inventory_item_id: 'f1', qty_per_serve: 2.5 }], items, 3);
const fr = coverPlan(frac[0]);
assert.equal(fr.pull, 7.5);
assert.equal(fr.gap, 0);
ok('fractional pull: 2.5 × 3 = 7.5, no rounding in the money-adjacent voice');

/* 9 — the plan refuses the unknown (deleted SKU → batchNeeds null); the
 * cover voice never invents numbers from a partial plan. */
const unknown = batchNeeds([{ inventory_item_id: 'ghost', qty_per_serve: 10 }], items, 12);
assert.equal(unknown, null);
ok('deleted SKU: batchNeeds refuses the plan — coverPlan never sees it');

/* 10 — the gap is monotone in the batch: bigger batch, bigger-or-equal gap. */
const b12 = coverPlan(batchNeeds([{ inventory_item_id: 'f1', qty_per_serve: 80 }], items, 12)[0]);
const b120 = coverPlan(batchNeeds([{ inventory_item_id: 'f1', qty_per_serve: 80 }], items, 120)[0]);
assert.equal(b12.gap, 0);
assert.equal(b120.gap, 9600 - 4680);
assert.ok(b120.gap >= b12.gap);
ok('monotone: ×12 covered (gap 0), ×120 gaps 4,920 — the plan scales honestly');

console.log(`\nunit207 — ${n} asserts, cover plan over batchNeeds (v5.168.0)`);
