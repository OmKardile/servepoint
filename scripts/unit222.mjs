/* Task 222 — v5.183.0 unit suite: who held past the line.
 * The named breach list — the seam 5.181/5.182 unsealed, now spoken: the
 * census counted breaches but never NAMED them ("2 of 14 past the 90-min
 * line" — which tables?). 5.183 grows src/lib/turn.ts:
 *   TableTurnStats.worstMin / TurnCensus.worstMin — the longest MEASURED
 *   span (breach or not), 0 when nothing settled; the floor's number and
 *   every table's own.
 *   namedBreachList(census) — the breaching tables only, worst span
 *   first, label as the stable tiebreak; empty census → empty list.
 * Asserted: floor worst = max of spans; per-table worst; empty census →
 *   0 (silence, never invented); only breaching tables named; worst-first
 *   order; label tiebreak on equal worsts; no breaches → empty list; the
 *   >= boundary held (worst of a listed table is >= line); noise settles
 *   (settle ≤ creation) never inflate worst; the register reads the worst
 *   (seatSpanLabel 140 → "2h 20m").
 * Run: bunx vite-node scripts/unit222.mjs
 */
import assert from 'node:assert/strict';

const { computeTurnCensus, namedBreachList, seatSpanLabel } = await import('/src/lib/turn.ts');

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const LINE = 90;
const START = Date.parse('2026-10-01T00:00:00Z');
const END = Date.parse('2026-10-08T00:00:00Z');

/* The week's ledger: five real seats across three tables, one cancelled,
 * one unpaid, one noise settle. Spans: tabA 120m + 30m, tabB 50m,
 * tabC 140m. At a 90-minute line: breaches = tabA×1, tabC×1. */
const orders = [
  { id: 't1', table_id: 'a', table_label: 'T1', status: 'completed', created_at: '2026-10-02T10:00:00Z' },
  { id: 't2', table_id: 'a', table_label: 'T1', status: 'completed', created_at: '2026-10-02T13:00:00Z' },
  { id: 't3', table_id: 'b', table_label: 'T2', status: 'completed', created_at: '2026-10-03T10:00:00Z' },
  { id: 't4', table_id: 'c', table_label: 'T3', status: 'completed', created_at: '2026-10-04T11:00:00Z' },
  { id: 't5', table_id: 'a', table_label: 'T1', status: 'cancelled', created_at: '2026-10-05T10:00:00Z' },
  { id: 't6', table_id: 'b', table_label: 'T2', status: 'completed', created_at: '2026-10-05T12:00:00Z' },
  { id: 't7', table_id: 'c', table_label: 'T3', status: 'completed', created_at: '2026-10-06T09:00:00Z' },
];
const settles = new Map(Object.entries({
  t1: '2026-10-02T12:00:00Z', // 120m — breach
  t2: '2026-10-02T13:30:00Z', // 30m
  t3: '2026-10-03T10:50:00Z', // 50m
  t4: '2026-10-04T13:20:00Z', // 140m — breach, the floor's worst
  t7: '2026-10-06T08:30:00Z', // noise: settle BEFORE creation — skipped
}));

const census = computeTurnCensus(orders, settles, LINE, START, END);

/* 1 — the floor's worst is the max measured span, the 140m seat */
assert.equal(census.worstMin, 140);
ok('census.worstMin: the floor\'s longest measured span (140m), noise never inflates it');

/* 2 — per-table worst: tabA speaks its own 120, not the floor's 140 */
assert.equal(census.byTable.get('a').worstMin, 120);
assert.equal(census.byTable.get('a').breaches, 1);
ok('per-table worstMin: T1 carries its own 120m worst and 1 breach');

/* 3 — a table with spans but no breaches keeps worstMin measured honestly */
assert.equal(census.byTable.get('b').worstMin, 50);
assert.equal(census.byTable.get('b').breaches, 0);
ok('T2: spans measured (50m worst) with zero breaches — honest, not named');

/* 4 — the named list: only breaching tables, worst-first */
const list = namedBreachList(census);
assert.deepEqual(list.map((b) => b.id), ['c', 'a']);
assert.equal(list[0].worstMin, 140);
assert.equal(list[0].breaches, 1);
ok('namedBreachList: breaching tables only, worst span first (T3 before T1)');

/* 5 — the tie: equal worsts break on the label, stably */
const tieOrders = [
  { id: 'x1', table_id: 'b2', table_label: 'T2', status: 'completed', created_at: '2026-10-02T10:00:00Z' },
  { id: 'x2', table_id: 'a1', table_label: 'T1', status: 'completed', created_at: '2026-10-02T11:00:00Z' },
];
const tieMap = new Map(Object.entries({
  x1: '2026-10-02T11:30:00Z', // 90m
  x2: '2026-10-02T12:30:00Z', // 90m
}));
const tieList = namedBreachList(computeTurnCensus(tieOrders, tieMap, LINE, START, END));
assert.deepEqual(tieList.map((b) => b.label), ['T1', 'T2']);
ok('namedBreachList: equal worsts tiebreak alphabetically by label');

/* 6 — no breaches anywhere → an empty list, silence not invention */
const calm = computeTurnCensus(orders.slice(0, 3), new Map(Object.entries({
  t1: '2026-10-02T10:20:00Z',
  t2: '2026-10-02T13:15:00Z',
})), LINE, START, END);
assert.equal(calm.breaches, 0);
assert.deepEqual(namedBreachList(calm), []);
ok('no breaches → empty list (the strip stays silent)');

/* 7 — the empty census: worstMin 0 and an empty list, never NaN */
const empty = computeTurnCensus([], settles, LINE, START, END);
assert.equal(empty.worstMin, 0);
assert.equal(empty.spans, 0);
assert.deepEqual(namedBreachList(empty), []);
ok('empty census: worstMin 0, empty list — silence never invented');

/* 8 — the boundary: a span EXACTLY at the line is a breach and owns the worst */
const edgeOrders = [{ id: 'e1', table_id: 'a', table_label: 'T1', status: 'completed', created_at: '2026-10-02T10:00:00Z' }];
const edgeMap = new Map([['e1', '2026-10-02T11:30:00Z']]); // exactly 90m
const edge = computeTurnCensus(edgeOrders, edgeMap, LINE, START, END);
assert.equal(edge.breaches, 1);
assert.equal(edge.worstMin, 90);
assert.equal(namedBreachList(edge).length, 1);
ok('>= boundary held: the 90m seat breaches and names itself (camping clock parity)');

/* 9 — unpaid seats are counted-not-measured: they never set worstMin */
assert.equal(census.byTable.get('b').spans, 1); // t6 unpaid — only t3 measured
assert.equal(census.worstMin, 140);
ok('unpaid counted-not-measured: t6 never touches T2\'s worst or the floor\'s');

/* 10 — the register: the worst speaks the duration register, not minutes */
assert.equal(seatSpanLabel(census.worstMin), '2h 20m');
assert.equal(seatSpanLabel(0), '<1m');
ok('register: worstMin rides seatSpanLabel (140 → "2h 20m"); zero speaks <1m, never 0m');

console.log(`\nunit222: ${n} asserts born — the named breach list, worst-first, silence where no breach lives.`);
