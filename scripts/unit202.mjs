/* Task 202 — v5.163.0 unit suite: when the room lets go (turnover day shape).
 * Covers the day-shape voice in ReportsScreen's tableTurnover:
 *   hours — 24 hour-of-day buckets of finished spans (the settle's hour,
 *           app clock), plus peakHour (ties to the earlier hour).
 * v5.182.0 migration: the finish line is the payments ledger's LAST settle
 * (buildSettleMap) — the 216-class reconciliation — so the fixtures ride
 * settle maps now. The honesty rules carry over intact: live seats donate
 * nothing to an hour; a split's early part can't re-bucket a ticket (the
 * LAST settle is the truth); a noise settle before the ticket never made a
 * span so it never lands in an hour; the bucket clock is the app's (IST),
 * never UTC.
 * Run: bunx vite-node scripts/unit202.mjs
 */
import assert from 'node:assert/strict';

const { tableTurnover } = await import('/src/components/reports/ReportsScreen.tsx');
const { buildSettleMap } = await import('/src/lib/turn.ts');

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const T0 = '2026-10-04T09:00:00+05:30'; // IST 09:00 = UTC 03:30
const mins = (m) => new Date(new Date(T0).getTime() + m * 60000).toISOString();

const ord = (id, num, tableId, tableLabel, createdAt, status = 'completed') =>
  ({
    id,
    tenant_id: 't',
    order_number: num,
    order_type: 'dine_in',
    status,
    table_id: tableId,
    table_label: tableLabel,
    total: 100,
    subtotal: 100,
    tax_amount: 0,
    created_at: createdAt,
    items: [],
  });

const settle = (orderId, atIso) => ({ orderId, paidAt: atIso });
const settles = (pairs) => buildSettleMap(pairs.map(([id, at]) => settle(id, at)));

const zeroHours = () => Array.from({ length: 24 }, (_, hour) => ({ hour, timed: 0, avgMin: null }));

/* ── 1 · shape ──────────────────────────────────────────────────────── */

const empty = tableTurnover([], null);
assert.equal(empty.hours.length, 24);
assert.deepEqual(empty.hours, zeroHours());
assert.equal(empty.peakHour, null);
ok('empty room: exactly 24 buckets, all silent, no peak invented');

/* ── 2 · one finished span lands in its paid hour ───────────────────── */

// placed IST 09:00, paid IST 18:30 → bucket 18 (span 570 min)
const t1 = ord('t1', 201, 'tb1', 'T1', T0);
const agg1 = tableTurnover([t1], settles([['t1', mins(570)]]));
assert.equal(agg1.hours[18].timed, 1);
assert.equal(agg1.hours[18].avgMin, 570);
assert.equal(agg1.peakHour, 18);
assert.equal(agg1.hours[17].timed, 0);
ok('a span buckets into the hour its table freed (18:30 IST → hour 18)');

/* ── 3 · the app clock, not UTC ─────────────────────────────────────── */

// paid UTC 17:30 = IST 23:00 → bucket 23 (UTC would say 17)
const t2 = ord('t2', 202, 'tb2', 'T2', T0);
const agg2 = tableTurnover([t2], settles([['t2', mins(840)]]));
assert.equal(agg2.hours[23].timed, 1);
assert.equal(agg2.hours[17].timed, 0);
assert.equal(agg2.peakHour, 23);
ok('the bucket clock is the house clock (UTC 17:30 reads as IST 23:00)');

/* ── 4 · live seats donate nothing ──────────────────────────────────── */

const t3 = ord('t3', 203, 'tb3', 'T3', T0); // no completed hop at all
const agg3 = tableTurnover([t3], null);
assert.equal(agg3.tickets, 1);
assert.deepEqual(agg3.hours, zeroHours());
assert.equal(agg3.peakHour, null);
ok('a live seat donates its turn but never an hour — no finish line, no bar');

/* ── 5 · takeaway and cancelled never enter the room ────────────────── */

const take = { ...ord('tk', 204, null, null, T0), order_type: 'takeaway' };
const cancelled = ord('cx', 205, 'tb4', 'T4', T0, 'cancelled');
const agg4 = tableTurnover(
  [take, cancelled],
  settles([['tk', mins(60)], ['cx', mins(60)]]),
);
assert.deepEqual(agg4.hours, zeroHours());
assert.equal(agg4.peakHour, null);
ok('takeaway and cancelled tickets stay out of the day shape entirely');

/* ── 6 · a split's early part can't re-bucket a ticket ──────────────── */

// the LAST settle 19:40 IST is the truth (the seat freed when the final
// part landed); the 18:10 early part is not the finish line
const t5 = ord('t5', 206, 'tb5', 'T5', T0);
const agg5 = tableTurnover(
  [t5],
  settles([['t5', mins(550)], ['t5', mins(640)]]),
);
assert.equal(agg5.hours[19].timed, 1);
assert.equal(agg5.hours[18].timed, 0);
assert.equal(agg5.hours[19].avgMin, 640);
ok("a split's early part never re-buckets a span (LAST settle wins, hour 19 not 18)");

/* ── 7 · a skew hop never made a span, never lands in an hour ───────── */

const t6 = ord('t6', 207, 'tb6', 'T6', T0);
const agg6 = tableTurnover([t6], settles([['t6', mins(-30)]]));
assert.equal(agg6.tickets, 1);
assert.deepEqual(agg6.hours, zeroHours());
assert.equal(agg6.peakHour, null);
ok('a hop older than the ticket winds nothing — turn only, no hour, no negative');

/* ── 8 · peak ties go to the earlier hour ───────────────────────────── */

// hour 9: two tickets paid 09:30 IST; hour 12: two paid 12:30 IST
const a1 = ord('a1', 208, 'tbA', 'TA', T0);
const a2 = ord('a2', 209, 'tbB', 'TB', T0);
const b1 = ord('b1', 210, 'tbC', 'TC', T0);
const b2 = ord('b2', 211, 'tbD', 'TD', T0);
const agg7 = tableTurnover(
  [a1, a2, b1, b2],
  settles([['a1', mins(30)], ['a2', mins(30)], ['b1', mins(210)], ['b2', mins(210)]]),
);
assert.equal(agg7.hours[9].timed, 2);
assert.equal(agg7.hours[12].timed, 2);
assert.equal(agg7.peakHour, 9);
ok('a peak tie reads the earlier hour (9 and 12 both two-wide → 9)');

/* ── 9 · a real max beats an earlier hour ───────────────────────────── */

const c1 = ord('c1', 212, 'tbE', 'TE', T0); // hour 9, one span
const d1 = ord('d1', 213, 'tbF', 'TF', T0); // hour 12
const d2 = ord('d2', 214, 'tbG', 'TG', T0); // hour 12
const agg8 = tableTurnover(
  [c1, d1, d2],
  settles([['c1', mins(30)], ['d1', mins(210)], ['d2', mins(210)]]),
);
assert.equal(agg8.peakHour, 12);
ok('a strictly wider later hour takes the peak (hour 12 beats hour 9)');

/* ── 10 · per-hour average ──────────────────────────────────────────── */

// two spans in hour 9: 45m and 15m → avg 30m; the other hour untouched
const e1 = ord('e1', 215, 'tbH', 'TH', T0);
const e2 = ord('e2', 216, 'tbI', 'TI', T0);
const agg9 = tableTurnover(
  [e1, e2],
  settles([['e1', mins(45)], ['e2', mins(15)]]),
);
assert.equal(agg9.hours[9].timed, 2);
assert.equal(agg9.hours[9].avgMin, 30);
assert.equal(agg9.hours[10].avgMin, null);
ok('an hour averages its own spans only (45m + 15m → 30m); empty hours stay null');

/* ── 11 · spans still counted after the sort ────────────────────────── */

// bucketing must not disturb the minutes-sorted stats (median/longest)
const f1 = ord('f1', 217, 'tbJ', 'TJ', T0);
const f2 = ord('f2', 218, 'tbK', 'TK', T0);
const agg10 = tableTurnover(
  [f1, f2],
  settles([['f1', mins(20)], ['f2', mins(90)]]),
);
// 5.182.0 — even-count medians round the mean of the middles ([20,90] → 55),
// the ONE median rule the census shares (medianMinOf)
assert.equal(agg10.spans.medianMin, 55);
assert.equal(agg10.longest.minutes, 90);
assert.equal(agg10.spans.n, 2);
ok('the day shape rides the same walk without disturbing median or longest');

console.log(`\n${n} asserts PASS`);
