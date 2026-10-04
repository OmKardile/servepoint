/* Task 237 — v5.198.0 unit suite: the best sellers bank on paid.
 * Reports' Top items ranked every non-cancelled ticket — unpaid
 * included — while the Menu's mover medallion spoke the paid ledger
 * only: two rankers answering "what sells this week" with two
 * populations, and a keep-rank claiming margins the till never
 * collected beside a margin card that banks on collected money only.
 * rankTopItems is the ONE exported reducer: isPaidTicket in the loop
 * (the family's own truth from lib/usual), cancelled/refunded/unpaid
 * out, revenue and recipe cost summed per dish, sorted by revenue.
 * The sub-line and the chat paper speak the list's own unit sum
 * (topUnits), the billed ITEMS SOLD tile names its own register
 * ("unpaid tickets included"), the paper's top-3 section says PAID,
 * and buildTopText grows the optional unitsVoice line — absent keeps
 * the paper byte-identical (the absent-field doctrine).
 * Asserted: the population (paid in; unpaid, cancelled, refunded
 * out); revenue/cost math incl. the item_total-vs-unit_price fallback
 * and the priced flag; the revenue sort; THE SCREEN WIRING GUARD
 * (comment-blind live copy: memo rides rankTopItems, sub-line speaks
 * "units on paid tickets", tile names "unpaid tickets included",
 * paper section says PAID, opts pass topUnits + unitsVoice);
 * buildTopText absent-unitsVoice byte-identity and the present-
 * unitsVoice subtitle line.
 * Run: bunx vite-node scripts/unit237.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rep = await import('/src/components/reports/ReportsScreen.tsx');
const { rankTopItems, buildTopText } = rep;

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

/* ── fixtures: one dish sold on three kinds of ticket ────────────── */
const FW = 'fw-id';
const MUFFIN = 'muffin-id';
const unitCosts = new Map([[FW, 36], [MUFFIN, 34]]);
const line = (menu_item_id, name, qty, unit_price, item_total) => ({
  menu_item_id, name, qty, unit_price, item_total,
});
const ticket = (id, payment_status, status, items) => ({
  id, payment_status, status, items,
});
/* paid: 2× FW @220 (item_total wins) · unpaid: 3× FW @220 ·
 * refunded: 1× Muffin @180 · cancelled: 5× Muffin @180 */
const rows = [
  ticket('o1', 'completed', 'ready', [line(FW, 'Flat White', 2, 220, 440)]),
  ticket('o2', 'pending', 'preparing', [line(FW, 'Flat White', 3, 220, null)]),
  ticket('o3', 'refunded', 'completed', [line(MUFFIN, 'Blueberry Muffin', 1, 180, 180)]),
  ticket('o4', 'completed', 'cancelled', [line(MUFFIN, 'Blueberry Muffin', 5, 180, 900)]),
];

/* 1 — the population: only the paid ticket's units and rupees count. */
{
  const out = rankTopItems(rows, unitCosts);
  assert.equal(out.length, 1, 'unpaid/refunded/cancelled tickets stay out');
  assert.equal(out[0].name, 'Flat White');
  assert.equal(out[0].units, 2, 'only the paid ticket\'s 2 units');
  assert.equal(out[0].revenue, 440, 'item_total rides when present');
  ok('rankTopItems counts the paid ledger only (2 units, ₹440)');
}

/* 2 — item_total null falls back to unit_price × qty (the o2 line shape,
 *    proven here on a PAID ticket so the fallback is observable). */
{
  const out = rankTopItems(
    [ticket('p1', 'completed', 'completed', [line(FW, 'Flat White', 3, 220, null)])],
    unitCosts,
  );
  assert.equal(out[0].revenue, 660, 'unit_price × qty fallback');
  ok('item_total fallback = unit_price × qty');
}

/* 3 — the priced flag and the recipe cost ride the map; unpriced = no
 *    cost claimed. */
{
  const out = rankTopItems(rows, new Map([[FW, 36]]));
  assert.equal(out[0].cost, 72, '36 × 2 paid units');
  assert.equal(out[0].priced, true);
  const out2 = rankTopItems(rows, new Map());
  assert.equal(out2[0].cost, 0, 'no recipe on file → cost 0');
  assert.equal(out2[0].priced, false, 'priced flag false → no margin claimed');
  ok('recipe cost sums on paid units; unpriced stays unpriced');
}

/* 4 — the revenue sort (bigger rupees first), ties keep insertion order. */
{
  const out = rankTopItems(
    [
      ticket('a', 'completed', 'completed', [line(MUFFIN, 'Muffin', 1, 180, 180)]),
      ticket('b', 'completed', 'completed', [line(FW, 'Flat White', 4, 220, 880)]),
    ],
    unitCosts,
  );
  assert.deepEqual(out.map((r) => r.name), ['Flat White', 'Muffin']);
  ok('ranked by revenue');
}

/* 5 — the empty truth: nothing paid → empty list, never a fabricated row. */
assert.deepEqual(rankTopItems([rows[1]], unitCosts), [], 'unpaid-only range = empty list');
ok('silence, not zero: unpaid-only range returns []');

/* ── 6 — THE SCREEN WIRING GUARD (comment-blind, 233's lesson) ───── */
const live = readFileSync(
  new URL('../src/components/reports/ReportsScreen.tsx', import.meta.url),
  'utf8',
);
const code = live
  .split('\n')
  .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('/*') && !l.trim().startsWith('//'))
  .join('\n');

assert.ok(
  code.includes('const topItems = useMemo(() => rankTopItems(inRange, unitCosts)'),
  'the memo rides the exported reducer',
);
ok('screen memo calls rankTopItems');

assert.ok(code.includes('units on paid tickets'), 'the sub-line names the paid register');
assert.ok(
  !code.includes("} · {agg.items} units\n"),
  'the old billed sub-line is gone',
);
ok('sub-line speaks "units on paid tickets"');

assert.ok(
  code.includes("'unpaid tickets included'"),
  'the billed ITEMS SOLD tile names its own register',
);
ok('Items tile says "unpaid tickets included"');

assert.ok(code.includes("'WHAT SOLD · TOP 3 (PAID)'"), 'the report paper names the top-3 register');
assert.ok(code.includes('itemsSold: topUnits'), 'the chat paper footer sums the list itself');
assert.ok(code.includes("unitsVoice: 'paid tickets only'"), 'the chat paper wears the register line');
ok('chat + report papers speak the paid register');

/* ── 7 — buildTopText: absent unitsVoice keeps the old bytes ───────
 * Proven structurally (236's lesson — don't hand-compute the aligner):
 * the paper without unitsVoice must equal the paper WITH it minus the
 * single inserted voice line, and must carry no register line at all.
 * Whatever the padding, 195's no-unitsVoice call sites are untouched. */
{
  const opts = {
    storeName: 'CheeseBurg',
    rangeLabel: 'Last 7 days',
    items: [{ name: 'Flat White', units: 2, revenue: 440, sharePct: 100, marginPct: 84, kept: 368 }],
    earners: [{ name: 'Flat White', kept: 368, marginPct: 84, sellsRank: 1 }],
    itemsSold: 2,
  };
  const absent = buildTopText(opts).split('\n');
  const present = buildTopText({ ...opts, unitsVoice: 'paid tickets only' }).split('\n');
  assert.ok(!absent.join('\n').includes('paid tickets only'), 'absent paper stays silent about registers');
  assert.equal(absent.length + 1, present.length, 'the voice adds exactly one line');
  const hi = present.findIndex((l) => l.includes('BEST SELLERS'));
  assert.equal(present[hi + 1], '       paid tickets only', 'centered under the header');
  assert.ok(present[hi + 2].match(/^-+$/), 'the rule follows');
  assert.deepEqual(
    absent,
    [...present.slice(0, hi + 1), ...present.slice(hi + 2)],
    'absent = present minus the voice line, byte for byte',
  );
  assert.ok(present.every((l) => l.length <= 32), 'the paper keeps its 32-column frame');
  ok('buildTopText absent unitsVoice = old bytes; present rides centered');
}

console.log(`\nunit237 — ${n} asserts, ALL GREEN`);
