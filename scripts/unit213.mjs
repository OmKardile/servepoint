/* Task 213 — v5.174.0 unit suite: the pace reaches the back office.
 * Covers the new pure voice in InventoryScreen:
 *   weekBatch(pace, menuItemId) — the planner's preset, set by the room:
 *   the dish's paid units over the movers' window; null when nobody
 *   bought it (or the pace hasn't landed) — the planner never invents
 *   demand. Composition asserts ride the real chain: computePaceByItem
 *   (movers.ts) → weekBatch → batchNeeds → coverPlan, the same math the
 *   screen wires, so the preset N plans the week and Cover prices it.
 * Run: bunx vite-node scripts/unit213.mjs
 */
import assert from 'node:assert/strict';

const { weekBatch, batchNeeds, coverPlan } = await import(
  '/src/components/inventory/InventoryScreen.tsx'
);
const { computePaceByItem } = await import('/src/lib/movers.ts');

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const sku = (id, name, stock) => ({
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

const FLOUR = sku('f1', 'Flour', 4680);
const BUTTER = sku('b1', 'Butter', 4970);
const items = [FLOUR, BUTTER];
const draft = [
  { inventory_item_id: 'f1', qty_per_serve: 80 },
  { inventory_item_id: 'b1', qty_per_serve: 20 },
];

/* ── weekBatch — the room's answer to "how big?" ── */

/* 1 — the units the dish sold ride straight onto the stepper. */
const pace = new Map([
  ['m1', 34],
  ['m2', 1],
]);
assert.equal(weekBatch(pace, 'm1'), 34);
assert.equal(weekBatch(pace, 'm2'), 1);
ok('weekBatch = the dish\u2019s paid units over the window');

/* 2 — a dish nobody bought gets NO preset (silence, never invented demand). */
assert.equal(weekBatch(pace, 'm3'), null);
assert.equal(weekBatch(new Map([['m1', 0]]), 'm1'), null);
ok('zero sales or absent dish \u2192 null \u2014 the planner never invents demand');

/* 3 — unread pace or no dish selected: silent too. */
assert.equal(weekBatch(null, 'm1'), null);
assert.equal(weekBatch(pace, null), null);
ok('no pace map / no dish \u2192 the preset stays home');

/* ── the real chain: ledger rows \u2192 pace \u2192 preset \u2192 plan \u2192 cover ── */

/* 4 — the same rows the counter's rail ranks feed the preset. */
const rows = [
  { order_id: 'o1', menu_item_id: 'm1', name: 'Latte', qty: 30, unit_price: 220 },
  { order_id: 'o2', menu_item_id: 'm1', name: 'Latte', qty: 4, unit_price: 220 },
  { order_id: 'o3', menu_item_id: 'm2', name: 'Muffin', qty: 1, unit_price: 180 },
];
const paceFromLedger = computePaceByItem(rows);
assert.equal(weekBatch(paceFromLedger, 'm1'), 34);
ok('computePaceByItem \u2192 weekBatch: one ledger, the preset reads it whole');

/* 5 — the preset N plans the WEEK: batchNeeds at the paid pace. A week of
 * 34 lattes needs 2,720 g — the live 4,680 g shelf COVERS it (short 0). */
const weekPlan = batchNeeds(draft, items, weekBatch(paceFromLedger, 'm1'));
assert.equal(weekPlan[0].need, 80 * 34);
assert.equal(weekPlan[0].have, 4680);
assert.equal(weekPlan[0].short, 0);
ok('preset N \u2192 batchNeeds: the week\u2019s pull is priced (80 \u00d7 34 = 2,720, covered)');

/* 6 — a hot week (the ledger could say 120) goes short, and Cover prices
 * the shortfall through the same plan the preset produced. */
const hotPlan = batchNeeds(draft, items, 120);
assert.equal(hotPlan[0].short, 80 * 120 - 4680);
const weekCover = coverPlan(hotPlan[0]);
assert.equal(weekCover.gap, 80 * 120 - 4680);
assert.equal(weekCover.afterGap, 0);
assert.equal(weekCover.afterPull, 4680);
ok('coverPlan over a short week: gap empties the bin, pull keeps parity');

/* 7 — a covered shelf at the week's pace: no shortfall, verdict fits. */
const fatShelf = [sku('f1', 'Flour', 99999), sku('b1', 'Butter', 99999)];
const comfyPlan = batchNeeds(draft, fatShelf, weekBatch(paceFromLedger, 'm1'));
assert.equal(comfyPlan[0].short, 0);
ok('a fat shelf at the week\u2019s pace: the plan reads covered, no Cover chip');

/* 8 — the preset survives a week of exactly one dish (muffin's live 1). */
assert.equal(weekBatch(paceFromLedger, 'm2'), 1);
const muffinPlan = batchNeeds(draft, items, 1);
assert.equal(muffinPlan[0].need, 80);
ok('a week of 1 is a truthful preset \u2014 the plan scales down honestly');

console.log(`\nunit213: ${n} asserts PASS`);
