/* Task 215 — v5.176.0 unit suite: the bin's days.
 * Covers the new pure voices:
 *   src/lib/shelf.ts — computeBurnByIngredient: the weekly burn per
 *   ingredient (Σ recipe line qty × the dish's paid pace) reading the
 *   SAME pace ledger the rail ranks — silence rules inherited (no pace →
 *   nothing, noise skipped, unread ledger → no burn anywhere); and the
 *   bin's clause: shelfDaysClause's optional noun ("at this burn") —
 *   the family's every rule, the default byte-identical for every
 *   existing caller.
 * Run: bunx vite-node scripts/unit215.mjs
 */
import assert from 'node:assert/strict';

const { computeBurnByIngredient, shelfDays, shelfDaysClause, counterShelfLine } = await import(
  '/src/lib/shelf.ts'
);

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const line = (menu_item_id, inventory_item_id, qty_per_serve) => ({ menu_item_id, inventory_item_id, qty_per_serve });

/* ── computeBurnByIngredient — the bin's weekly burn ── */

/* 1 — Σ (qty × pace) across dishes sharing one bin. */
const pace = new Map([
  ['fw', 34],
  ['muf', 1],
]);
const burn = computeBurnByIngredient(
  [
    line('fw', 'beans', 18),
    line('muf', 'beans', 30),
    line('fw', 'milk', 40),
  ],
  pace,
);
assert.equal(burn.get('beans'), 18 * 34 + 30 * 1);
ok('burn sums across dishes sharing a bin (612 + 30 = 642)');
assert.equal(burn.get('milk'), 40 * 34);
ok('separate SKUs land in separate bins');

/* 2 — a dish with no pace (nobody bought it) contributes nothing. */
const burn2 = computeBurnByIngredient([line('ghost', 'beans', 18)], pace);
assert.ok(!burn2.has('beans'));
ok('zero-pace dish contributes nothing (silence, not zero)');

/* 3 — pace 0 is no pace either (the > 0 guard). */
const burn3 = computeBurnByIngredient([line('dead', 'beans', 5)], new Map([['dead', 0]]));
assert.ok(!burn3.has('beans'));
ok('pace 0 contributes nothing');

/* 4 — noise lines (qty ≤ 0 / NaN) are skipped, never a fake zero. */
const burn4 = computeBurnByIngredient(
  [line('fw', 'beans', 0), line('fw', 'milk', -4), line('fw', 'cocoa', NaN)],
  pace,
);
assert.ok(!burn4.has('beans') && !burn4.has('milk') && !burn4.has('cocoa'));
ok('noise qty lines skipped');

/* 5 — unread ledger (pace null) → no burn anywhere. */
assert.equal(computeBurnByIngredient([line('fw', 'beans', 18)], null).size, 0);
ok('pace null → empty burn map (the bin stays silent)');

/* 6 — no recipe lines → empty. */
assert.equal(computeBurnByIngredient([], pace).size, 0);
ok('no recipe lines → empty burn map');

/* ── the bin's days — THE SAME division ── */

/* 7 — join arithmetic: 5000 g at 612 g/week → 57.19 days (raw). */
const d = shelfDays(5000, 612);
assert.ok(Math.abs(d - 35000 / 612) < 1e-9);
ok('shelfDays(stock, burn) = stock × 7 ÷ burn (5000g @ 612g/wk ≈ 57.19d)');

/* 8-10 — silence guards hold for the bin exactly as for the dish. */
assert.equal(shelfDays(5000, 0), null);
ok('burn 0 → silence (the bin never says forever)');
assert.equal(shelfDays(0, 612), null);
ok('stock 0 → silence (the level tone already said "Out")');
assert.equal(shelfDays(5000, null), null);
ok('burn null → silence');

/* ── the bin's clause — the family's rules, the bin's noun ── */

/* 11 — default noun byte-compat: existing callers' text unchanged. */
assert.equal(shelfDaysClause(10, 10), '~7 days at this pace');
ok('default noun keeps "at this pace" (byte-compat)');

/* 12 — burn noun, weeks branch: 5000 @ 612 → ~8 weeks. */
assert.equal(shelfDaysClause(5000, 612, 'burn'), '~8 weeks at this burn');
ok('burn clause: ~8 weeks at this burn');

/* 13 — burn noun, days branch: 10 @ 10 → 7 days. */
assert.equal(shelfDaysClause(10, 10, 'burn'), '~7 days at this burn');
ok('burn clause: ~7 days at this burn');

/* 14 — singular boundary: 5 @ 35 → 1 day. */
assert.equal(shelfDaysClause(5, 35, 'burn'), '~1 day at this burn');
ok('singular boundary: ~1 day at this burn');

/* 15 — under a day speaks honestly. */
assert.equal(shelfDaysClause(3, 34, 'burn'), 'less than a day at this burn');
ok('less than a day at this burn');

/* 16 — the fortnight switch holds for the bin too. */
assert.equal(shelfDaysClause(100, 7, 'burn'), '~14 weeks at this burn');
assert.equal(shelfDaysClause(13, 7, 'burn'), '~13 days at this burn');
ok('14-day weeks switch holds under the burn noun');

/* 17 — the counter's line is untouched by the noun work (regression). */
const cl = counterShelfLine({ coverage: 59, thin: null, unknown: false }, 34);
assert.equal(cl.text, '~59 more on the shelf — ~12 days at this pace');
ok("counterShelfLine unchanged: '~12 days at this pace'");

console.log(`\nunit215 — ${n} asserts born (the bin's days)`);
