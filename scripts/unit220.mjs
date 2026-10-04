/* Task 220 — v5.181.0 unit suite: the held time.
 * Covers the floor's turn census (FloorScreen, exported pure):
 *   computeTurnCensus(orders, settleByOrder, turnAfterMin, startMs, endMs)
 * measures every FINISHED seat the way the live camping clock does —
 * created → freed, freed = the payments ledger's LAST settle — and sums
 * median + breaches across the floor and per table. Plus seatLabelFor,
 * the ONE duration register the tile's live clock and the census's
 * median now share.
 * Asserted: label grammar; clock/census byte-consistency; span + breach
 * math at the exact line (>=, matching the camping clock); split-settle
 * (newest wins); unpaid counted-not-measured; cancelled / counter /
 * out-of-window exclusions; odd+even medians; per-table aggregation;
 * null settle map silence; unreadable settle skip; clamped pre-seat
 * settle; label export seam (seatClockFor delegates).
 * Run: bunx vite-node scripts/unit220.mjs
 */
import assert from 'node:assert/strict';

const { computeTurnCensus, seatLabelFor, seatSpanLabel, seatClockFor } = await import(
  '/src/components/floor/FloorScreen.tsx'
);

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

/* Window: 7 days ending 2026-10-04T18:30Z. Fixtures live inside it. */
const END = Date.UTC(2026, 9, 4, 18, 30);
const START = END - 7 * 24 * 3600 * 1000;
const iso = (dayOffset, h, m) => new Date(START + dayOffset * 24 * 3600 * 1000 + h * 3600 * 1000 + m * 60000).toISOString();

const order = (id, tableId, createdDay, createdH, createdM, opts = {}) => ({
  id,
  table_id: tableId,
  table_label: opts.label ?? (tableId ? `T${tableId}` : null),
  status: opts.status ?? 'paid',
  created_at: iso(createdDay, createdH, createdM),
});

/* 1 — the label registers: durations vs the live clock's state word */
assert.equal(seatLabelFor(0), 'just sat');
assert.equal(seatLabelFor(45), '45m');
assert.equal(seatLabelFor(65), '1h 5m');
assert.equal(seatLabelFor(150), '2h 30m');
assert.equal(seatSpanLabel(0), '<1m'); // a FINISHED sub-minute hold is a duration, not a state
assert.equal(seatSpanLabel(45), '45m');
assert.equal(seatSpanLabel(65), '1h 5m');
assert.equal(seatSpanLabel(150), '2h 30m');
ok('registers: live clock keeps just-sat, the census durations read <1m; ≥1m byte-identical');

/* 2 — ONE grammar: the live clock's label IS seatLabelFor's */
const placed = iso(0, 9, 0);
const clock = seatClockFor(placed, Date.parse(placed) + 65 * 60000, 90);
assert.equal(clock.label, seatLabelFor(65));
assert.equal(clock.label, '1h 5m');
ok('seatClockFor delegates its label to seatLabelFor (tile and census never disagree on words)');

/* 3 — basic span + breach: 90m seat at the 90 line breaches (>=, as the
 *      live clock compares), an 89m seat does not */
const c90 = computeTurnCensus(
  [order('a', '1', 1, 10, 0)],
  new Map([['a', iso(1, 11, 30)]]),
  90,
  START,
  END,
);
assert.equal(c90.rounds, 1);
assert.equal(c90.spans, 1);
assert.equal(c90.medianMin, 90);
assert.equal(c90.breaches, 1);
const c89 = computeTurnCensus(
  [order('b', '1', 1, 10, 0)],
  new Map([['b', iso(1, 11, 29)]]),
  90,
  START,
  END,
);
assert.equal(c89.breaches, 0);
assert.equal(c89.medianMin, 89);
ok('breach at the exact line: 90m breaches the 90 line (>=), 89m does not — the camping clock comparison');

/* 4 — split settle: the map carries the LAST settle; the census reads it
 *      as the seat's end (a split frees the table when the final part lands) */
const split = computeTurnCensus(
  [order('c', '2', 1, 10, 0)],
  new Map([['c', iso(1, 11, 10)]]), // fetchPaymentMoments hands back the newest row only
  90,
  START,
  END,
);
assert.equal(split.medianMin, 70);
assert.equal(split.breaches, 0);
ok('split ticket: the newest settle is the seat end (70m)');

/* 5 — unpaid: counted as a seated round, never measured */
const unpaid = computeTurnCensus(
  [order('d', '3', 1, 10, 0, { status: 'pending' }), order('e', '3', 1, 12, 0)],
  new Map([['e', iso(1, 12, 40)]]),
  90,
  START,
  END,
);
assert.equal(unpaid.rounds, 2);
assert.equal(unpaid.spans, 1);
assert.equal(unpaid.medianMin, 40);
ok('unpaid ticket: counted (round 2), never measured (span stays 1)');

/* 6 — cancelled / counter / out-of-window exclusions */
const excluded = computeTurnCensus(
  [
    order('f', '4', 1, 10, 0, { status: 'cancelled' }),
    order('g', null, 1, 10, 0),
    order('h', '4', -9, 10, 0), // before the window
    order('i', '4', 8, 10, 0), // after the window (dayOffset 8 > 7)
  ],
  new Map([
    ['f', iso(1, 11, 0)],
    ['g', iso(1, 11, 0)],
    ['h', iso(-8, 11, 0)],
    ['i', iso(9, 11, 0)],
  ]),
  90,
  START,
  END,
);
assert.equal(excluded.rounds, 0);
assert.equal(excluded.spans, 0);
ok('cancelled never happened, counter holds no table, outside the window stays out');

/* 7 — medians: odd takes the middle, even rounds the mean */
const odd = computeTurnCensus(
  [
    order('j', '5', 1, 9, 0),
    order('k', '5', 2, 9, 0),
    order('l', '5', 3, 9, 0),
  ],
  new Map([
    ['j', iso(1, 10, 0)], // 60
    ['k', iso(2, 10, 45)], // 105
    ['l', iso(3, 10, 20)], // 80
  ]),
  200,
  START,
  END,
);
assert.equal(odd.medianMin, 80);
const even = computeTurnCensus(
  [order('m', '6', 1, 9, 0), order('n2', '6', 2, 9, 0)],
  new Map([
    ['m', iso(1, 10, 0)], // 60
    ['n2', iso(2, 10, 1)], // 61
  ]),
  200,
  START,
  END,
);
assert.equal(even.medianMin, 61); // (60+61)/2 = 60.5 → 61
ok('medians: odd middle, even mean rounded');

/* 8 — per-table aggregation + labels */
const byT = computeTurnCensus(
  [
    order('p', '7', 1, 9, 0, { label: 'Patio 1' }),
    order('q', '7', 2, 9, 0, { label: 'Patio 1' }),
    order('r', '8', 3, 9, 0, { label: 'Main 3' }),
  ],
  new Map([
    ['p', iso(1, 10, 0)], // 60 — under the line
    ['q', iso(2, 10, 40)], // 100 — over
    ['r', iso(3, 9, 30)], // 30 — under
  ]),
  90,
  START,
  END,
);
assert.equal(byT.byTable.size, 2);
const t7 = byT.byTable.get('7');
assert.equal(t7.label, 'Patio 1');
assert.equal(t7.rounds, 2);
assert.equal(t7.spans, 2);
assert.equal(t7.medianMin, 80); // (60+100)/2
assert.equal(t7.breaches, 1);
const t8 = byT.byTable.get('8');
assert.equal(t8.label, 'Main 3');
assert.equal(t8.spans, 1);
assert.equal(t8.breaches, 0);
ok('per-table census: rounds, median, breaches and the table label ride table_id');

/* 9 — unread ledger: rounds counted, nothing measured (honest silence shape) */
const unread = computeTurnCensus(
  [order('s', '9', 1, 9, 0), order('t', '9', 2, 9, 0)],
  null,
  90,
  START,
  END,
);
assert.equal(unread.rounds, 2);
assert.equal(unread.spans, 0);
assert.equal(unread.medianMin, 0);
assert.equal(unread.breaches, 0);
ok('null settle map: the census counts rounds and measures nothing (silence, never an invented median)');

/* 10 — garbage settle iso skipped; pre-seat settle clamps to 0 */
const weird = computeTurnCensus(
  [order('u', '10', 1, 9, 0), order('v', '10', 2, 9, 0)],
  new Map([
    ['u', 'not-a-date'],
    ['v', iso(1, 20, 0)], // settle BEFORE created (day 2 9:00 vs day 1 20:00 → −780)
  ]),
  90,
  START,
  END,
);
assert.equal(weird.spans, 1);
assert.equal(weird.medianMin, 0);
assert.equal(weird.breaches, 0);
ok('unreadable settle skipped; a pre-seat settle clamps to 0 minutes, never negative');

console.log(`\nunit220 — ${n} asserts born (the held time)`);
