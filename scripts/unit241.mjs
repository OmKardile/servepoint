/* Task 241 — v5.202.0 unit suite: the movers keep the ledger's week.
 * The Menu medallion said "Ranked No.1 this week by paid orders — 30 sold
 * across 22 tickets" while Reports' Top items said "27 units on paid
 * tickets, Flat White 25": 5.198 unified the POPULATION (isPaidTicket in
 * both loops) but the WINDOW stayed forked — the movers fetched a private
 * rolling `now − 7·24h` while Reports' "Last 7 days" means N calendar
 * days of the reporting day ending today (today inclusive). Both were
 * true to their own math and neither wrong alone; the disagreement was
 * the debt, and the ledger aged past the boundary until the same dish
 * wore two numbers under the same week-word.
 * The fix: appday grows ONE builder (lastNDaysMs) owning the shape,
 * Reports' rangeWindow delegates, movers grows moverWindow delegating,
 * and fetchPaidMoverLines rides the ledger's week with a .lt end-cap
 * for exact [start, end) parity with the client-side range filter.
 * Asserted: the window math pinned at a fixed NOW (IST midnight seam —
 * the reporting day flips where UTC doesn't); moverWindow's delegation;
 * the boundary pair (a ticket inside the ledger's week the rolling
 * window would have swallowed, and the proof the OLD shape admitted
 * both); the zone seams (IST vs UTC on the same instant); comment-blind
 * source guards (rolling math extinct, delegation wired, rangeWindow's
 * body clean of the private shift while priorWindow keeps it); and the
 * movers' aggregation math untouched (rank + tie-breaks + pace).
 * Run: bunx vite-node scripts/unit241.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

import { lastNDaysMs, appTodayIso } from '../src/lib/appday';
import { moverWindow, computeTopMovers, computePaceByItem, MOVER_WINDOW_DAYS } from '../src/lib/movers';

/* The suite owns nowMs — the drift moment: UTC Sun 4 Oct 18:57, which is
 * IST Mon 5 Oct 00:27. The two clocks disagree about TODAY; that seam is
 * exactly where the old fork lived. */
const NOW = new Date('2026-10-04T18:57:00Z');

/* 1 — the ONE builder: 7 reporting days ending today (today inclusive),
 * pinned to the millisecond. start = Mon 29 Sep 00:00 IST = Sun 28 Sep
 * 18:30 UTC; end = Mon 6 Oct 00:00 IST = Sun 5 Oct 18:30 UTC. */
const w7 = lastNDaysMs(7, NOW);
assert.equal(w7.startMs, Date.parse('2026-09-28T18:30:00.000Z'), '7d start = Mon 29 Sep 00:00 IST');
assert.equal(w7.endMs, Date.parse('2026-10-05T18:30:00.000Z'), '7d end = Mon 6 Oct 00:00 IST');
ok('lastNDaysMs(7): the ledger week, pinned to the ms across the IST seam');

/* 2 — today and 30d ride the same shape. */
const w1 = lastNDaysMs(1, NOW);
assert.equal(w1.startMs, Date.parse('2026-10-04T18:30:00.000Z'), '1d start = Mon 5 Oct 00:00 IST');
assert.equal(w1.endMs, w7.endMs, 'every window ends at the same midnight');
const w30 = lastNDaysMs(30, NOW);
assert.equal(w30.startMs, Date.parse('2026-09-05T18:30:00.000Z'), '30d start = Sun 6 Sep 00:00 IST');
assert.equal(w30.endMs, w7.endMs, '30d ends at the same midnight');
ok('lastNDaysMs(1) and (30): same shape, same end midnight');

/* 3 — moverWindow delegates: the movers' week IS the ledger's week. */
const mw = moverWindow(7, NOW);
assert.equal(mw.startMs, w7.startMs);
assert.equal(mw.endMs, w7.endMs);
assert.equal(MOVER_WINDOW_DAYS, 7, 'the week stays a 7-day week');
ok('moverWindow(7) === lastNDaysMs(7): one window, no private math');

/* 4 — THE BOUNDARY PROOF: a ticket at Sun 28 Sep 18:29 UTC (= Sun 23:59 IST)
 * is OUTSIDE the ledger's week (the window starts Mon 00:00 IST); the OLD
 * rolling shape (NOW − 7d = Sat 27 Sep 18:57 UTC) would have admitted it.
 * Its neighbour one minute later (Mon 00:01 IST) is IN. One minute of
 * IST-midnight decides which surface a unit belongs to — that is why the
 * shape, not the instant, had to own the truth. */
const tOutside = Date.parse('2026-09-28T18:29:00Z');
const tInside = Date.parse('2026-09-28T18:31:00Z');
const oldRollingStart = NOW.getTime() - 7 * 86400000;
assert.ok(tOutside < w7.startMs, 'Sun 23:59 IST sits outside the ledger week');
assert.ok(tInside >= w7.startMs, 'Mon 00:01 IST sits inside the ledger week');
assert.ok(tOutside > oldRollingStart && tInside > oldRollingStart, 'the OLD rolling shape admitted BOTH — the fork made 30 vs 25');
ok('boundary pair: the IST midnight seam decides; the old shape swallowed the difference');

/* 5 — the zone seams stay deliberate: the same NOW is a different TODAY
 * per zone, and the additive `now` param did not move the default. */
assert.equal(appTodayIso('Asia/Kolkata', NOW), '2026-10-05', 'IST has crossed midnight');
assert.equal(appTodayIso('UTC', NOW), '2026-10-04', 'UTC has not');
assert.equal(appTodayIso('Asia/Kolkata').length, 10, 'the default still reads the live clock');
ok('zone seams deliberate: IST vs UTC day words on one instant');

/* comment-blind live copy (233's lesson). */
const strip = (p) =>
  readFileSync(new URL(p, import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l))
    .join('\n');
const apiCode = strip('../src/lib/api.ts');
const moversCode = strip('../src/lib/movers.ts');
const reportsCode = strip('../src/components/reports/ReportsScreen.tsx');

/* 6 — the fetch rides moverWindow with the exact [start, end) cap; the
 * private rolling math is extinct from live code. */
assert.ok(
  apiCode.includes('const { startMs, endMs } = moverWindow(days);'),
  'fetchPaidMoverLines delegates to moverWindow',
);
assert.ok(
  apiCode.includes(".gte('orders.created_at', sinceIso)") &&
    apiCode.includes(".lt('orders.created_at', untilIso)"),
  'the window is [start, end) — .lt end-cap, no future leak',
);
assert.ok(!apiCode.includes('86400000'), 'rolling now−N·24h math is extinct from api.ts');
ok('fetchPaidMoverLines: moverWindow in, [start,end) capped, rolling math extinct');

/* 7 — the movers lib owns the shape through the one builder. */
assert.ok(
  moversCode.includes('export function moverWindow(') &&
    moversCode.includes('return lastNDaysMs(days, now);'),
  'moverWindow delegates to appday lastNDaysMs',
);
ok('movers.ts owns the week via lastNDaysMs — no second window math');

/* 8 — Reports' rangeWindow delegates too; the private shift stays only in
 * priorWindow (scoped guard — the file still holds shiftDayIso). */
const rwStart = reportsCode.indexOf('function rangeWindow(');
const rwEnd = reportsCode.indexOf('function priorWindow(');
assert.ok(rwStart > -1 && rwEnd > rwStart, 'rangeWindow found before priorWindow');
const rwBody = reportsCode.slice(rwStart, rwEnd);
assert.ok(rwBody.includes('return lastNDaysMs(days);'), "rangeWindow delegates to the ONE builder");
assert.ok(!rwBody.includes('shiftDayIso'), 'no private day-shift inside rangeWindow');
assert.ok(reportsCode.includes('shiftDayIso(-(2 * days - 1))'), "priorWindow keeps its shift — untouched");
ok('Reports rangeWindow: delegate + scoped guard (priorWindow untouched)');

/* 9 — the aggregation math did not move: rank by units with the family's
 * deterministic tie-breaks, pace the same ledger minus the cap. */
const rows = [
  { order_id: 'a', menu_item_id: 'fw', name: 'Flat White', qty: 2, unit_price: 220 },
  { order_id: 'b', menu_item_id: 'fw', name: 'Flat White', qty: 1, unit_price: 220 },
  { order_id: 'b', menu_item_id: 'mu', name: 'Muffin', qty: 1, unit_price: 124 },
  { order_id: 'c', menu_item_id: 'sw', name: 'Sandwich', qty: 2, unit_price: 260 },
  { order_id: 'd', menu_item_id: null, name: 'Ghost line', qty: 9, unit_price: 1 },
];
const top = computeTopMovers(rows);
assert.equal(top[0].name, 'Flat White');
assert.equal(top[0].units, 3);
assert.equal(top[0].tickets, 2);
assert.equal(top[1].name, 'Sandwich');
assert.equal(top[1].units, 2);
assert.equal(top[2].name, 'Muffin');
const pace = computePaceByItem(rows);
assert.equal(pace.get('fw'), 3);
assert.ok(!pace.has(null) && !pace.has(undefined), 'ghost lines sit out of the pace');
ok('rankMovers/computePaceByItem semantics untouched (units → tie-breaks, ghost lines silent)');

console.log(`\nunit241 — ${n} asserts ALL GREEN`);
