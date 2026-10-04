/* Task 219 — v5.180.0 unit suite: the day's shifts.
 * Covers buildZDrawerRows (EodScreen, exported pure) — the Z-report's
 * drawer block now speaks EVERY shift the day closed instead of the one
 * .find() returned, and an open shift no longer erases the sealed ones.
 * Asserted: empty silence; single-sealed byte-compat with the .find()
 * era (title, 'Closed' label order, rows, strongLast, no strongRows);
 * open-only byte-compat (payouts row present only when moveSum > 0,
 * IN DRAWER math); multi-shift chronological order from a DESC ledger,
 * per-shift 'Shift N · closed' headers, DAY TOTAL COUNTED/VARIANCE over
 * sealed shifts only, strongRows on the last two; sealed+open mixed day
 * (the open group's expected money never enters the day totals); signed
 * variance; '—' for an unreadable close; 'counter' fallback.
 * Run: bunx vite-node scripts/unit219.mjs
 */
import assert from 'node:assert/strict';

const { buildZDrawerRows } = await import('/src/components/eod/EodScreen.tsx');

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const fmt = (v) => `₹${v.toFixed(2)}`;
const stamp = (iso) => `${iso.slice(11, 16)} IST`;

const sealed = (closedAt, counted, variance, expected, floatV = 500, by = 'closer@cafe.in') => ({
  closed_at: closedAt,
  closed_by_email: by,
  opening_float: floatV,
  expected_cash: expected,
  counted_cash: counted,
  variance,
});

/* 1 — empty silence: nothing touches the day, the block stays off */
assert.equal(buildZDrawerRows([], null, fmt, stamp), null);
ok('empty day + no open shift → null (block off, silence)');

/* 2 — single sealed shift: BYTE-IDENTICAL with the .find() era shape */
const one = buildZDrawerRows(
  [sealed('2026-09-30T13:40:00+00:00', 955, -7, 962)],
  null,
  fmt,
  stamp,
);
assert.equal(one.title, 'CASH DRAWER · LAST SHIFT');
assert.deepEqual(one.rows[0], ['Closed 13:40 IST', 'closer@cafe.in']);
assert.deepEqual(one.rows[1], ['Float', '₹500.00']);
assert.deepEqual(one.rows[2], ['Net cash (in − out)', '+₹462.00']);
assert.deepEqual(one.rows[3], ['Counted', '₹955.00']);
assert.deepEqual(one.rows[4], ['VARIANCE', '-₹7.00']);
assert.equal(one.strongLast, true);
assert.equal(one.strongRows, undefined);
assert.equal(one.rows.length, 5);
ok('single sealed → byte-identical .find()-era shape (title, Closed label, rows, strongLast)');

/* 3 — net is expected − float (021 convention), negative signed */
const negNet = buildZDrawerRows(
  [sealed('2026-09-30T13:40:00+00:00', 400, -100, 450, 550)],
  null,
  fmt,
  stamp,
);
assert.deepEqual(negNet.rows[2], ['Net cash (in − out)', '-₹100.00']);
ok('net cash = expected − float, signed');

/* 4 — open-only: byte-identical OPEN SHIFT shape */
const openOnly = buildZDrawerRows(
  [],
  { opened_at: '2026-10-04T10:20:00+00:00', opened_by_email: 'op@cafe.in', opening_float: 500, cashIn: 462, moveSum: 38 },
  fmt,
  stamp,
);
assert.equal(openOnly.title, 'CASH DRAWER · OPEN SHIFT');
assert.deepEqual(openOnly.rows[0], ['Opened 10:20 IST', 'op@cafe.in']);
assert.deepEqual(openOnly.rows[1], ['Float', '₹500.00']);
assert.deepEqual(openOnly.rows[2], ['Cash in (ledger)', '₹462.00']);
assert.deepEqual(openOnly.rows[3], ['Payouts/drops', '-₹38.00']);
assert.deepEqual(openOnly.rows[4], ['IN DRAWER (expected)', '₹924.00']);
assert.equal(openOnly.strongLast, true);
ok('open-only → byte-identical OPEN SHIFT shape with the expected math');

/* 5 — open-only, no payouts: the row is absent, never a fake -₹0.00 */
const openClean = buildZDrawerRows(
  [],
  { opened_at: '2026-10-04T10:20:00+00:00', opened_by_email: null, opening_float: 500, cashIn: 120, moveSum: 0 },
  fmt,
  stamp,
);
assert.equal(openClean.rows.some(([l]) => l === 'Payouts/drops'), false);
assert.deepEqual(openClean.rows[0], ['Opened 10:20 IST', 'counter']);
ok('no payouts → row absent; null email falls back to counter');

/* 6 — TWO sealed shifts: chronological groups from a DESC-ordered ledger,
 *      per-shift headers, DAY TOTAL over sealed only, strongRows last two */
const two = buildZDrawerRows(
  [
    sealed('2026-09-30T16:40:00+00:00', 962, 0, 962), // newer, first in ledger (DESC)
    sealed('2026-09-30T08:35:00+00:00', 955, -7, 962), // older
  ],
  null,
  fmt,
  stamp,
);
assert.equal(two.title, 'CASH DRAWER · 2 SHIFTS CLOSED');
assert.deepEqual(two.rows[0], ['Shift 1 · closed 08:35 IST', 'closer@cafe.in']); // OLDEST first
assert.deepEqual(two.rows[5], ['Shift 2 · closed 16:40 IST', 'closer@cafe.in']);
assert.equal(two.rows.length, 12);
assert.deepEqual(two.rows[10], ['DAY TOTAL · COUNTED', `₹${(955 + 962).toFixed(2)}`]);
assert.deepEqual(two.rows[11], ['DAY TOTAL · VARIANCE', '-₹7.00']);
assert.deepEqual(two.strongRows, [10, 11]);
assert.equal(two.strongLast, undefined);
ok('two sealed → chronological Shift 1/2 groups, DAY TOTAL rows, strongRows [10,11]');

/* 7 — DAY TOTAL never mixes the open shift's EXPECTED money into counted */
const mixed = buildZDrawerRows(
  [sealed('2026-10-04T07:05:00+00:00', 900, 0, 900)],
  { opened_at: '2026-10-04T08:00:00+00:00', opened_by_email: 'op@cafe.in', opening_float: 500, cashIn: 700, moveSum: 0 },
  fmt,
  stamp,
);
assert.equal(mixed.title, 'CASH DRAWER · 1 CLOSED + OPEN');
assert.deepEqual(mixed.rows[0], ['Shift 1 · closed 07:05 IST', 'closer@cafe.in']);
assert.deepEqual(mixed.rows[5], ['Open shift · opened 08:00 IST', 'op@cafe.in']);
assert.deepEqual(mixed.rows[8], ['IN DRAWER (expected)', '₹1200.00']); // moveSum=0 → no payouts row
assert.equal(mixed.rows.some(([l]) => l.startsWith('DAY TOTAL')), false); // 1 sealed: its VARIANCE row IS the day's story
ok('sealed + open → mixed-day title, open group last, no DAY TOTAL for one sealed shift');

/* 8 — three sealed: totals hold, strongRows track the last two */
const three = buildZDrawerRows(
  [
    sealed('2026-09-30T17:40:00+00:00', 800, 5, 795),
    sealed('2026-09-30T12:40:00+00:00', 900, -10, 910),
    sealed('2026-09-30T07:40:00+00:00', 955, -7, 962),
  ],
  null,
  fmt,
  stamp,
);
assert.equal(three.title, 'CASH DRAWER · 3 SHIFTS CLOSED');
assert.deepEqual(three.rows[0], ['Shift 1 · closed 07:40 IST', 'closer@cafe.in']);
assert.deepEqual(three.rows[15], ['DAY TOTAL · COUNTED', `₹${(955 + 900 + 800).toFixed(2)}`]);
assert.deepEqual(three.rows[16], ['DAY TOTAL · VARIANCE', '-₹12.00']);
assert.deepEqual(three.strongRows, [15, 16]);
ok('three sealed → 17 rows, totals sum all sealed, strongRows last two');

/* 9 — unreadable close stamps '—', never a fake time */
const noClose = buildZDrawerRows(
  [sealed(null, 955, -7, 962)],
  null,
  fmt,
  stamp,
);
assert.deepEqual(noClose.rows[0], ['Closed —', 'closer@cafe.in']);
ok('closed_at null → Closed — (silence, never a fake time)');

/* 10 — zero variance reads bare, positive reads + */
const zeroVar = buildZDrawerRows(
  [sealed('2026-09-30T13:40:00+00:00', 962, 0, 962)],
  null,
  fmt,
  stamp,
);
assert.deepEqual(zeroVar.rows[4], ['VARIANCE', '₹0.00']);
const posVar = buildZDrawerRows(
  [sealed('2026-09-30T13:40:00+00:00', 970, 8, 962)],
  null,
  fmt,
  stamp,
);
assert.deepEqual(posVar.rows[4], ['VARIANCE', '+₹8.00']);
ok('variance sign convention: bare zero, + over, - under');

console.log(`\nunit219 — ${n} asserts born (the day's shifts)`);
