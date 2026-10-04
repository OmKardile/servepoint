/* Task 223 — v5.184.0 unit suite: the table's own worst.
 * Reports' per-table rows join the breach audit — the CSV has spoken each
 * table's "Longest span" since 5.161, but the screen never did, and no
 * surface counted a table's OWN breaches (5.183 named them on the floor
 * only). 5.184 grows tableTurnover's perTable:
 *   TurnoverTable.past — the table's own timed spans that ran past the
 *   house line, measured at the ONE boundary (>=) inside the ONE writer
 *   (the agg). A turn without a settle is never a breach.
 * Asserted: per-table past at the >= boundary (exactly 90m counts);
 *   worst rides seatSpanLabel (120 → "2h 0m", 90 → "1h 30m"); noise
 *   settles never inflate a worst or a past; turns without settles donate
 *   turns only (past 0, worst null, "no span yet" shape); the unpaid
 *   ticket counted-not-measured; per-table past <= timed everywhere; the
 *   tables' pasts sum to the floor-level line.past (ONE boundary, two
 *   scopes); the sort is unchanged (turns desc, avg desc, label).
 * Run: bunx vite-node scripts/unit223.mjs
 */
import assert from 'node:assert/strict';

const { seatSpanLabel } = await import('/src/lib/turn.ts');
const { tableTurnover } = await import('/src/components/reports/ReportsScreen.tsx');

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

/* The range's ledger: T1 breaches big (120m), T2 breaches at the EXACT
 * line (90m) plus one noise settle, T3 sits twice but never settles,
 * T4 is unpaid. At the 90-minute line: T1 past×1, T2 past×1, T3/T4 mute. */
const orders = [
  { id: 'a1', table_id: 'a', table_label: 'T1', status: 'completed', created_at: '2026-10-02T10:00:00Z' },
  { id: 'a2', table_id: 'a', table_label: 'T1', status: 'completed', created_at: '2026-10-02T14:00:00Z' },
  { id: 'b1', table_id: 'b', table_label: 'T2', status: 'completed', created_at: '2026-10-03T10:00:00Z' },
  { id: 'b2', table_id: 'b', table_label: 'T2', status: 'completed', created_at: '2026-10-03T15:00:00Z' },
  { id: 'c1', table_id: 'c', table_label: 'T3', status: 'completed', created_at: '2026-10-04T11:00:00Z' },
  { id: 'c2', table_id: 'c', table_label: 'T3', status: 'completed', created_at: '2026-10-04T16:00:00Z' },
  { id: 'd1', table_id: 'd', table_label: 'T4', status: 'completed', created_at: '2026-10-05T12:00:00Z' },
];
const settles = new Map(Object.entries({
  a1: '2026-10-02T12:00:00Z', // 120m — T1's breach, its own worst
  a2: '2026-10-02T14:30:00Z', // 30m
  b1: '2026-10-03T11:30:00Z', // 90m — exactly at the line, the >= boundary
  b2: '2026-10-03T14:50:00Z', // noise: settle BEFORE creation — skipped
  // d1: unpaid — counted, never measured
}));

const agg = tableTurnover(orders, settles, 90);
const byLabel = new Map(agg.perTable.map((t) => [t.tableLabel, t]));

/* 1 — T1 carries its own worst and its own breach count */
const t1 = byLabel.get('T1');
assert.equal(t1.turns, 2);
assert.equal(t1.timed, 2);
assert.equal(t1.longestSpanMin, 120);
assert.equal(t1.past, 1);
ok('T1: worst 120m, past 1 of 2 timed — the table speaks its own audit');

/* 2 — T2 breaches at the EXACT line (90 >= 90), noise never inflates */
const t2 = byLabel.get('T2');
assert.equal(t2.longestSpanMin, 90);
assert.equal(t2.past, 1);
ok('T2: the exactly-90m seat counts past (>= boundary), the noise settle is skipped');

/* 3 — turns without settles: counted, never measured, never breached */
const t3 = byLabel.get('T3');
assert.equal(t3.turns, 2);
assert.equal(t3.timed, 0);
assert.equal(t3.avgSpanMin, null);
assert.equal(t3.longestSpanMin, null);
assert.equal(t3.past, 0);
ok('T3: two turns, no spans — worst stays null, past stays silent 0');

/* 4 — the unpaid ticket: a turn, never a span, never a breach */
const t4 = byLabel.get('T4');
assert.equal(t4.turns, 1);
assert.equal(t4.timed, 0);
assert.equal(t4.past, 0);
ok('T4: unpaid — counted-not-measured, the clock never guesses');

/* 5 — the register: the worst speaks seatSpanLabel's words */
assert.equal(seatSpanLabel(t1.longestSpanMin), '2h 0m');
assert.equal(seatSpanLabel(t2.longestSpanMin), '1h 30m');
ok('the worst rides the ONE duration register (2h 0m · 1h 30m)');

/* 6 — per-table pasts reconcile with the floor-level line count */
assert.equal(agg.line.past, [...agg.perTable].reduce((s, t) => s + t.past, 0));
assert.equal(agg.line.past, 2);
ok('ONE boundary, two scopes: the tables\' pasts sum to line.past (2)');

/* 7 — past never exceeds timed anywhere */
for (const t of agg.perTable) {
  assert.ok(t.past <= t.timed, `${t.tableLabel} past ${t.past} > timed ${t.timed}`);
}
ok('every table: past <= timed — a breach needs a measured seat');

/* 8 — the sort is unchanged: turns desc, then avg desc, then label.
 *      T1 and T2 tie at 2 turns; T2's avg 90 outranks T1's 75 — the
 *      5.161 tiebreak doing exactly what it was born to do. */
assert.deepEqual(
  agg.perTable.map((t) => t.tableLabel),
  ['T2', 'T1', 'T3', 'T4'],
);
ok('the rows keep 5.161\'s sort (turns desc, avg desc): T2, T1, T3, T4');

/* 9 — a table whose avg lands past the line but no single span does */
const gentle = tableTurnover(
  [
    { id: 'g1', table_id: 'g', table_label: 'G', status: 'completed', created_at: '2026-10-06T10:00:00Z' },
    { id: 'g2', table_id: 'g', table_label: 'G', status: 'completed', created_at: '2026-10-06T14:00:00Z' },
  ],
  new Map(Object.entries({
    g1: '2026-10-06T11:10:00Z', // 70m
    g2: '2026-10-06T15:10:00Z', // 70m
  })),
  90,
);
const gt = gentle.perTable[0];
assert.equal(gt.avgSpanMin, 70);
assert.equal(gt.longestSpanMin, 70);
assert.equal(gt.past, 0);
ok('avg under the line can breach nothing: past 0 even at two 70m seats');

console.log(`\nunit223: ${n} asserts passed`);
