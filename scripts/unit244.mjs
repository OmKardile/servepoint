/* Task 244 — v5.205.0 unit suite: the dashboard reads the ledger's calendar.
 * The morning paper's week tile promised "Open Reports — the week so far
 * reads ₹9,267.30" and the Reports landing read ₹8,112.30 — same morning,
 * same ledger, live-caught on the very pointer the paper ships. The
 * dashboard's read spoke the BROWSER's calendar end to end (local-midnight
 * fetch window, toDateString today/yesterday slices, getHours hour buckets,
 * en-CA browser-day week buckets) while every surface it points at
 * (Reports' ranges, Close-out's day fetch, the movers' window) resolves
 * through appday's reporting clock. Two calendars answering one word.
 * The fix: appday grows lastNDayKeys (the day-KEY sequence, sibling of
 * lastNDaysMs's window) and fetchDashboard speaks it whole — fetch window
 * = lastNDaysMs(7).startMs, slices by appDayKey, hours by appHour, buckets
 * walking the sequence with noon-anchored UTC-pinned weekday voices, the
 * lookup appDayKey. morningTake's "week so far" sums ALL seven buckets —
 * today's money included — so the tile's number IS Reports' 7d GROSS, the
 * pointer's promise kept structurally (5.198's rule, the paper's edition).
 * Asserted: lastNDayKeys pinned to the ms across the IST seam + sibling
 * identity with lastNDaysMs; the appDayKey boundary pair that killed the
 * fork; morningTake's full-week voice (today can lead); comment-blind
 * source guards — the whole fetchDashboard slice speaks one calendar and
 * the browser clocks are extinct; the paper's sum reads all rows.
 * Run: bunx vite-node scripts/unit244.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const { lastNDayKeys, lastNDaysMs, appDayKey, appDayStartMs, appDayEndMs, appTodayIso } =
  await import('/src/lib/appday');
const { morningTake } = await import('/src/components/dashboard/DashboardScreen.tsx');

/* The seam NOW: 2026-10-04 19:46 UTC = 2026-10-05 01:16 IST — the browser
 * still says Oct 4 while the ledger's reporting day is already Oct 5. */
const NOW = new Date('2026-10-04T19:46:00Z');

/* 1 — the sequence: 7 reporting days, oldest first, ending the IST today. */
const keys7 = lastNDayKeys(7, NOW);
assert.equal(keys7.length, 7);
assert.equal(keys7[0], '2026-09-29', 'the oldest key is IST Sep 29');
assert.equal(keys7[6], '2026-10-05', 'the last key IS the reporting today');
assert.equal(keys7[6], appTodayIso(undefined, NOW), 'the sequence ends at appTodayIso');
for (let i = 1; i < keys7.length; i++) {
  const prev = new Date(`${keys7[i - 1]}T12:00:00Z`);
  prev.setUTCDate(prev.getUTCDate() + 1);
  assert.equal(keys7[i], prev.toISOString().slice(0, 10), `consecutive days ${i - 1}->${i}`);
}
ok('lastNDayKeys(7): the reporting sequence, pinned across the IST seam');

/* 2 — the same shape at 1 and 30: one builder, every N. */
assert.deepEqual(lastNDayKeys(1, NOW), ['2026-10-05']);
const k30 = lastNDayKeys(30, NOW);
assert.equal(k30.length, 30);
assert.equal(k30[29], '2026-10-05');
ok('lastNDayKeys(1) and (30): same shape, same end day');

/* 3 — sibling identity: the window and the sequence span the SAME days —
 * the dashboard's buckets and Reports' 7d window agree by construction. */
const w7 = lastNDaysMs(7, NOW);
assert.equal(w7.startMs, appDayStartMs(keys7[0]), 'the window starts where the sequence starts');
assert.equal(w7.endMs, appDayEndMs(keys7[6]), 'the window ends where the sequence ends');
ok('lastNDaysMs and lastNDayKeys are siblings — one shape, two products');

/* 4 — the boundary pair that killed the fork: an instant the browser read
 * as Oct 4 (its own en-CA day) is the LEDGER'S Oct 5. */
assert.equal(appDayKey('2026-10-04T19:30:00Z'), '2026-10-05', 'IST already tomorrow');
assert.equal(appDayKey('2026-10-04T18:29:00Z'), '2026-10-04', 'the minute before, still yesterday');
ok('appDayKey: the seam pair — the browser day and the reporting day part at 18:30 UTC');

/* 5 — morningTake: the week so far includes today's money, and today can
 * lead the week. Yesterday stays the second-to-last row, never today. */
const mk = (key, label, total) => ({
  key,
  label,
  full: label,
  dineIn: total,
  takeaway: 0,
  delivery: 0,
  total,
});
const rows5 = [
  mk('2026-09-29', 'Tue', 100),
  mk('2026-09-30', 'Wed', 0),
  mk('2026-10-01', 'Thu', 200),
  mk('2026-10-02', 'Fri', 0),
  mk('2026-10-03', 'Sat', 300),
  mk('2026-10-04', 'Sun', 50),
  mk('2026-10-05', 'Today', 777),
];
const take5 = morningTake({ weeklyRevenue: rows5 });
assert.equal(take5.week.total, 1427, '100+200+300+50+777 — ALL rows, today included');
assert.equal(take5.week.sellingDays, 5, 'the two zero days never sold');
assert.deepEqual(take5.week.best, { label: 'Today', total: 777 }, 'today can lead the week');
assert.equal(take5.yesterday.key, '2026-10-04', 'yesterday is the second-to-last row');
assert.equal(take5.yesterday.total, 50);
ok('morningTake: the ledger’s week — today’s money in, today can be best');

/* 6 — a today-only morning now speaks (the week so far is the day so far);
 * an all-silent book stays double silence. */
const todayOnly = rows5.map((r, i) => (i === 6 ? r : { ...r, total: 0, dineIn: 0 }));
const t6 = morningTake({ weeklyRevenue: todayOnly });
assert.equal(t6.week.total, 777, 'a today-only morning still has a week so far');
const dead = rows5.map((r) => ({ ...r, total: 0, dineIn: 0 }));
assert.equal(morningTake({ weeklyRevenue: dead }).week, null);
ok('today-only speaks the day; all-silent stays double silence');

/* comment-blind live copy (233's lesson). */
const strip = (p) =>
  readFileSync(new URL(p, import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l))
    .join('\n');
const apiCode = strip('../src/lib/api.ts');
const dashCode = strip('../src/components/dashboard/DashboardScreen.tsx');

/* 7 — the WHOLE fetchDashboard speaks one calendar: slice the function body
 * and pin every clock word inside it. */
const fStart = apiCode.indexOf('export async function fetchDashboard');
const fEnd = apiCode.indexOf('export async function fetchNotifications');
assert.ok(fStart >= 0 && fEnd > fStart, 'the fetchDashboard slice exists');
const body = apiCode.slice(fStart, fEnd);
assert.ok(body.includes('lastNDaysMs(7)'), 'the fetch window is the ledger week');
assert.ok(body.includes('lastNDayKeys(7)'), 'the buckets walk the reporting sequence');
assert.ok(body.includes('appDayKey(r.created_at)'), 'the today/yesterday/week slices resolve appDayKey');
assert.ok(body.includes('appHour(r.created_at)'), 'the hour buckets speak the reporting clock');
assert.ok(!body.includes('toDateString'), 'the browser toDateString clock is extinct');
assert.ok(!body.includes('getHours'), 'the browser getHours clock is extinct');
assert.ok(!body.includes('setHours'), 'the local-midnight fetch window is extinct');
assert.ok(!body.includes("toLocaleDateString('en-CA')"), 'the browser en-CA bucket key is extinct');
assert.ok(body.includes("`${key}T12:00:00Z`"), 'the weekday voices anchor at the key’s own noon');
assert.ok(body.includes("timeZone: 'UTC'"), 'the voices read the key’s calendar, pinned');
ok('fetchDashboard: one calendar end to end — window, slices, hours, buckets, voices');

/* 8 — the paper sums ALL the rows; the second-clock words are extinct. */
assert.ok(
  dashCode.includes('rows.reduce((s, r) => s + r.total, 0)'),
  'the week so far sums every bucket',
);
assert.ok(dashCode.includes('rows.length - 2'), 'yesterday is the second-to-last row');
assert.ok(!dashCode.includes('past.reduce'), 'the six-day sum is extinct');
assert.ok(!dashCode.includes('past.slice'), 'the six-day slice is extinct');
ok('the paper: the sum reads all rows — the tile’s number is the landing’s number');

console.log(`\nunit244 — ${n} asserts ALL GREEN`);
