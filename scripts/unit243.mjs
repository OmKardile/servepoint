/* Task 243 — v5.204.0 unit suite: the replay lands on the day it names.
 * The morning paper's tile said "Yesterday · Saturday, 3 Oct — ₹294.00"
 * with a button promising "Replay yesterday (Saturday, 3 Oct) in Close-out"
 * — and the landing opened Close-out on SUNDAY 4 OCT. The door kept a
 * second clock: the tile's rupees came from the week rows' own day buckets
 * (browser local midnights) while the door key re-derived "yesterday" from
 * the reporting day stepped back one (appday) — two computations of one
 * word in one file, and on any device whose clock sits across the
 * reporting day's midnight the promise named one day while the landing
 * opened another. Live-caught: the promise said Sat 3 Oct, the landing
 * said Sun 4 Oct.
 * The fix: the week bucket's day key rides the rupees — api's weeklyRevenue
 * rows carry `key` (en-CA YYYY-MM-DD, the shape Close-out's day-hint
 * contract already demands), morningTake returns it, and the door passes
 * THE BUCKET'S key. One derivation; the landing IS the named thing.
 * Asserted: morningTake's yesterday carries its row's key (and the lead
 * tie-break and the dead-day silence unchanged); the key is in the exact
 * format the Close-out day-hint regex accepts; the TODAY row can never
 * become yesterday; comment-blind source guards — the en-CA bucket key,
 * the dropped toDateString key extinct, the map carries the key, the door
 * passes the bucket's key, the second clock (yDoor/yesterdayKey) extinct,
 * Close-out's absolute-day consumption intact.
 * Run: bunx vite-node scripts/unit243.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const dash = await import('/src/components/dashboard/DashboardScreen.tsx');
const { morningTake } = dash;

/* 1 — the key rides the rupees: yesterday's key IS its row's key. */
const rows = [
  { key: '2026-09-28', label: 'Mon', full: 'Monday, 28 Sep', dineIn: 100, takeaway: 0, delivery: 0, total: 100 },
  { key: '2026-09-29', label: 'Tue', full: 'Tuesday, 29 Sep', dineIn: 0, takeaway: 60, delivery: 0, total: 60 },
  { key: '2026-09-30', label: 'Wed', full: 'Wednesday, 30 Sep', dineIn: 0, takeaway: 0, delivery: 0, total: 0 },
  { key: '2026-10-01', label: 'Thu', full: 'Thursday, 1 Oct', dineIn: 40, takeaway: 40, delivery: 40, total: 120 },
  { key: '2026-10-02', label: 'Fri', full: 'Friday, 2 Oct', dineIn: 0, takeaway: 0, delivery: 90, total: 90 },
  { key: '2026-10-03', label: 'Sat', full: 'Saturday, 3 Oct', dineIn: 294, takeaway: 0, delivery: 0, total: 294 },
  { key: '2026-10-04', label: 'Today', full: 'Sunday, 4 Oct', dineIn: 0, takeaway: 0, delivery: 0, total: 0 },
];
const take = morningTake({ weeklyRevenue: rows });
assert.ok(take.yesterday, 'a sold yesterday speaks');
assert.equal(take.yesterday.key, '2026-10-03', 'the key is the row’s own day');
assert.equal(take.yesterday.full, 'Saturday, 3 Oct');
assert.equal(take.yesterday.total, 294);
assert.equal(take.yesterday.lead, 'Dine-in');
assert.equal(take.week.total, 664, 'the week reads the six past days (the zero day speaks 0)');
assert.equal(take.week.sellingDays, 5, 'five of the six past days sold');
assert.equal(take.week.best.label, 'Sat', 'the best day is the short-label voice, top total wins');
ok('morningTake: the key travels with the rupees, the voices unchanged');

/* 2 — the key is in the EXACT shape Close-out's day-hint contract accepts
 * (^\d{4}-\d{2}-\d{2}$): a key the door cannot carry is a key the door
 * cannot keep. */
assert.match(take.yesterday.key, /^\d{4}-\d{2}-\d{2}$/);
ok('the bucket key is YYYY-MM-DD — the payload the day: hint accepts');

/* 3 — the TODAY row can never become yesterday: its money is the today
 * card's, not the replay's. */
const todayOnly = rows.map((r, i) => (i === 6 ? { ...r, total: 555, dineIn: 555 } : r));
const take2 = morningTake({ weeklyRevenue: todayOnly });
assert.equal(take2.yesterday.key, '2026-10-03');
assert.equal(take2.yesterday.total, 294);
assert.equal(take2.week.total, 664, 'the TODAY row stays out of the week too');
ok('the TODAY row never becomes yesterday — slice boundary holds');

/* 4 — a dead yesterday stays silent (the family's own rule). */
const dead = rows.map((r, i) => (i === 5 ? { ...r, total: 0, dineIn: 0 } : r));
const take3 = morningTake({ weeklyRevenue: dead });
assert.equal(take3.yesterday, null, 'a sold-nothing yesterday reads silence');
assert.ok(take3.week, 'the week still speaks around the silence');
ok('dead yesterday → silence; the week rides on');

/* comment-blind live copy (233's lesson). */
const strip = (p) =>
  readFileSync(new URL(p, import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l))
    .join('\n');
const apiCode = strip('../src/lib/api.ts');
const dashCode = strip('../src/components/dashboard/DashboardScreen.tsx');
const eodCode = strip('../src/components/eod/EodScreen.tsx');

/* 5 — the bucket's key is the calendar string itself; the toDateString key
 * (a shape no door could carry) is extinct. */
assert.ok(
  apiCode.includes("key: d.toLocaleDateString('en-CA')"),
  'the week bucket keys en-CA YYYY-MM-DD',
);
assert.ok(!apiCode.includes('key: d.toDateString()'), 'the toDateString bucket key is extinct');
assert.ok(
  apiCode.includes('const weeklyRevenue = weekBuckets.map((b) => ({\n    key: b.key,'),
  'the rows carry the key to the screen',
);
assert.ok(
  apiCode.includes("weekIndex.get(new Date(r.created_at).toLocaleDateString('en-CA'))"),
  'the row lookup speaks the SAME day word as the buckets',
);
assert.ok(!apiCode.includes("weekIndex.get(new Date(r.created_at).toDateString())"), 'the old lookup word is extinct — one day word per bucket loop');
ok('api: the key is born in the bucket and rides the row — lookup and bucket one word');

/* 6 — the door passes THE BUCKET'S key; the second clock is extinct. */
assert.ok(
  dashCode.includes('day:${y.key}') || dashCode.includes('day:${take.yesterday.key}'),
  "the door passes the tile's own bucket key",
);
assert.ok(!dashCode.includes('yDoor'), 'the yDoor second-clock block is extinct');
assert.ok(!dashCode.includes('yesterdayKey'), 'the independent yesterdayKey is extinct');
ok('dashboard: one derivation — the key rides the rupees to the door');

/* 7 — Close-out's end of the contract is unchanged: an absolute day key,
 * strictly shaped, consumed once. */
assert.ok(eodCode.includes("hint.startsWith('day:')"), 'the day: hint still consumed');
assert.ok(eodCode.includes('/^\\d{4}-\\d{2}-\\d{2}$/'), 'the strict day-key shape enforced');
assert.ok(eodCode.includes('consumeSectionHint()'), 'consumed once on arrival');
ok('Close-out: the absolute-day contract intact — the landing IS the named day');

console.log(`\nunit243 — ${n} asserts ALL GREEN`);
