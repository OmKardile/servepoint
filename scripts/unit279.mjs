/* Task 279 — v5.240.0 unit suite: the week answers to a calendar.
 *
 * The classified watch item from 5.239's round, paid: Bills' date filter
 * was the LAST room still speaking a second window clock. "Last 7 days"
 * meant a ROLLING 168 hours back from the moment (weekAgo), while
 * Reports' KPIs, the movers' week, the shelf's pace and the armed Custom
 * row all meant 7 CALENDAR days ending today, today inclusive — the same
 * word, two windows, the exact disease 5.239 cured for "today". The
 * same word could even disagree with ITSELF: the owner selecting Custom
 * (armed with the calendar week) and the owner selecting "Last 7 days"
 * could ask for the same week and get two different ticket sets.
 *
 * The honest laws, kept and extended:
 * - ONE ask: the whole date predicate rides lib/reportWindow's
 *   rangeWindow — today, 7d, custom — every bounded key through the ONE
 *   door; 'all' keeps its no-bounds silence (the ledger's whole truth
 *   has no window to consult). The today key's verdict is unchanged:
 *   lastNDaysMs(1)'s bounds ARE the app-day clock 5.239 taught this
 *   filter (isSameAppDay's verdict, through the window builder).
 * - The fossil is EXTINCT: no weekAgo, no 168h arithmetic, no second
 *   clock anywhere in the file — "no inline calendar math" (5.238's own
 *   pin) now means the fixed keys too.
 * - The label law (5.236/5.238) reaches the FIXED keys: the window a
 *   word alone cannot verify speaks its dates — rangeSpanOf, the span
 *   phrase through THE house formatter on THE pair the window builds
 *   (shiftDayIso(-6)…today — the same pair the Custom row arms
 *   pre-filled, so the fixed key and the owner's default Custom say the
 *   same window in the same words). The miss sentence, the chip label
 *   and the honesty row all speak the span; the chip word itself keeps
 *   its lib voice ("Last 7 days", RANGE_LABEL byte-true).
 * - The honesty row (the Custom row's sibling, 5.238): while the week
 *   stands, the row says WHICH dates and WHAT SHAPE — ONE text flow,
 *   the a11y-glue law (5.237) never gets a fork to glue.
 * - The suites own now (228's doctrine): shiftDayIso gains the optional
 *   now (the bare form byte-true), rangeSpanOf takes it — the proof is
 *   deterministic in any runner.
 *
 * Asserted: the ONE ask byte + the fossil extinct; 'all' silence and the
 * structural null guard; no inline calendar arithmetic anywhere; the 7d
 * window's bounds BY BEHAVIOR (byte-equal to lastNDaysMs(7) and to the
 * shiftDayIso(-6) pair's midnights); the DISAGREEMENT case proven both
 * ways (the evening instant 7 days back — rolling says in, calendar says
 * out, runner-tz-independent); the today door keeping 5.239's verdict at
 * the 17:30Z instant; rangeSpanOf's one-derivation equality, the single
 * day alone, 30d's span, determinism under an injected now; shiftDayIso's
 * bare form delegating; the labels (the miss sentence, the chip label,
 * the honesty row's ink and shape words, the Custom bytes untouched); the
 * 5.238 pins still standing (the union, the arms, the memo, the row's
 * caps and ink); the lib's fixed words byte-true; and the version law
 * (the agreement shape — sw bakes whatever word version.ts speaks).
 * Run: bunx vite-node scripts/unit279.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  rangeWindow,
  rangeLabelOf,
  rangeSpanOf,
  shiftDayIso,
  RANGE_LABEL,
  orderedCustom,
} from '/src/lib/reportWindow.ts';
import { lastNDaysMs, appDayStartMs, appDayEndMs, appTodayIso, appTimezone, isSameAppDayAs } from '/src/lib/appday.ts';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);
const strip = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const bills = strip('../src/components/bills/BillsScreen.tsx');
const libSrc = strip('../src/lib/reportWindow.ts');
const versionSrc = strip('../src/version.ts');
const swSrc = strip('../public/sw.js');

const HOUR = 3_600_000;

/* ── 1. the ONE ask — every bounded key through the one door ── */
assert.ok(
  bills.includes('rangeWindow(dateFilter, { from: customFrom, to: customTo })'),
  'the whole chase asks ONE window builder',
);
assert.ok(bills.includes("if (dateFilter !== 'all') {"), "'all' keeps its no-bounds silence before the ask");
assert.ok(bills.includes('startMs !== null && (t < startMs || t > endMs)'), 'the structural null guard stands');
ok('the ONE ask — today, 7d, custom through the one door, all silent');

/* ── 2. the fossil is extinct ── */
assert.ok(!bills.includes('weekAgo'), 'the rolling weekAgo byte is extinct');
assert.ok(!/7 \* 24|168/.test(bills.replace(/[^\n]*168 hours back[^\n]*/g, '')), 'no 168h arithmetic outside the honesty words');
assert.ok(!bills.includes("dateFilter === 'today' && !isSameAppDay"), 'the filter no longer asks isSameAppDay directly — the door does');
ok('the last second clock — extinct');

/* ── 3. no inline calendar arithmetic, anywhere (5.238's pin, still true) ── */
assert.ok(!/\bsetUTC(Date|Month)\b/.test(bills), 'no inline UTC calendar arithmetic anywhere in Bills');
ok('ONE derivation — no inline fork of the window grammar');

/* ── 4. the 7d window by behavior — the calendar week ── */
const w7 = rangeWindow('7d');
const l7 = lastNDaysMs(7);
assert.equal(w7.startMs, l7.startMs, 'the 7d window starts where lastNDaysMs(7) starts');
assert.equal(w7.endMs, l7.endMs, 'the 7d window ends where lastNDaysMs(7) ends');
assert.equal(w7.startMs, appDayStartMs(shiftDayIso(-6)), 'the start is 6 calendar days back, midnight (today inclusive)');
assert.equal(w7.endMs, appDayEndMs(appTodayIso()), 'the end is today, midnight to midnight');
ok('the 7d window — 7 calendar days ending today, today inclusive');

/* ── 5. the disagreement case — the round's behavioral proof ── */
/* NOW = 5 Oct 2026, 09:00 IST. The instant 28 Sep 20:00 IST is 7 calendar
 * days back at evening: the ROLLING window (now − 168h) includes it; the
 * CALENDAR window (lastNDaysMs(7)) excludes it. That disagreement is the
 * bug the round removes — provable in any runner (explicit instants). */
const NOW_0900IST = new Date('2026-10-05T09:00:00+05:30');
const eveningSevenBack = new Date('2026-09-28T20:00:00+05:30').getTime();
const rollingStart = NOW_0900IST.getTime() - 7 * 24 * HOUR;
assert.ok(eveningSevenBack >= rollingStart, 'the rolling 168h week would include the evening instant');
const cal = lastNDaysMs(7, NOW_0900IST);
assert.ok(eveningSevenBack < cal.startMs, 'the calendar week excludes it — the fossil\u2019s lie, named');
ok('the disagreement case — rolling says in, calendar says out');

/* ── 6. the today door keeps 5.239's verdict ── */
/* At NOW = 17:30Z (23:00 IST) the instant 20:30Z is "today" on the local
 * clock but 02:00 tomorrow in IST — isSameAppDayAs says false, and the
 * window door (lastNDaysMs(1, now)) must say the same false. */
const NOW_1730Z = new Date('2026-10-05T17:30:00Z');
const instant2030Z = new Date('2026-10-05T20:30:00Z').getTime();
const w1 = lastNDaysMs(1, NOW_1730Z);
assert.ok(!isSameAppDayAs('2026-10-05T20:30:00Z', NOW_1730Z.getTime()), 'the app-clock twin says false (unit278\u2019s proof)');
assert.ok(instant2030Z < w1.startMs || instant2030Z > w1.endMs, 'the window door agrees — the verdict is unchanged');
const midDay = lastNDaysMs(1, new Date('2026-10-05T06:00:00Z'));
const midInstant = new Date('2026-10-05T08:00:00Z').getTime();
assert.ok(midInstant >= midDay.startMs && midInstant <= midDay.endMs, 'the mid-day case is inside — both clocks agree');
ok('the today door — 5.239\u2019s app-day verdict through the builder');

/* ── 7. rangeSpanOf — the fixed window's own dates, ONE derivation ── */
const NOW_SPAN = new Date('2026-10-05T09:00:00+05:30');
assert.equal(
  rangeSpanOf('7d', NOW_SPAN),
  rangeLabelOf('custom', { from: shiftDayIso(-6, NOW_SPAN), to: appTodayIso(appTimezone(), NOW_SPAN) }),
  'the span is THE span builder on THE pair the window builds',
);
assert.ok(rangeSpanOf('7d', NOW_SPAN).includes('–'), 'the week speaks a span (from – to)');
assert.ok(!rangeSpanOf('today', NOW_SPAN).includes('–'), 'a single day speaks just its date');
assert.ok(rangeSpanOf('30d', NOW_SPAN).includes('–'), 'the 30-day window speaks its span');
assert.equal(rangeSpanOf('7d', NOW_SPAN), rangeSpanOf('7d', new Date('2026-10-05T21:00:00+05:30')), 'the same day speaks the same span all day');
assert.notEqual(rangeSpanOf('7d', NOW_SPAN), rangeSpanOf('7d', new Date('2026-10-06T09:00:00+05:30')), 'tomorrow\u2019s span is tomorrow\u2019s');
ok('rangeSpanOf — the 5.238 law\u2019s fixed-key edition, deterministic');

/* ── 8. shiftDayIso — the bare form delegates (the seam is optional) ── */
assert.equal(shiftDayIso(-6), shiftDayIso(-6, new Date()), 'the bare form stays byte-true — the wall behind it');
assert.ok(libSrc.includes('export function shiftDayIso(days: number, now: Date = new Date()): string'), 'the seam is the default param, not a fork');
ok('shiftDayIso — the suites still own now');

/* ── 9. the labels — the chip word carries its dates ── */
assert.ok(bills.includes('const weekSpan = rangeSpanOf(\'7d\');'), 'the span is derived ONCE, at the label block');
assert.ok(bills.includes('`from ${weekSpan}`'), 'the miss sentence says "from <span>"');
assert.ok(bills.includes('`Last 7 days (${weekSpan})`'), 'the chip label says "Last 7 days (<span>)"');
assert.ok(bills.includes('Showing {weekSpan} · the last 7 calendar days, today included — midnight to midnight, not 168 hours back'), 'the honesty row speaks the dates and the shape');
assert.ok(bills.includes('text-[#8A938C]'), 'the row wears the span voice\u2019s own ink');
ok('the labels speak the DATES the window holds');

/* ── 10. ONE text flow — the glue law never gets a fork ── */
const row7 = bills.slice(bills.indexOf("{dateFilter === '7d' ? ("), bills.indexOf('{ordersError && orders.length > 0 && ('));
assert.ok(!row7.includes('aria-hidden'), 'the row has no aria-hidden dot to glue around');
assert.ok(!row7.includes('<span'), 'the row is one text flow, not span-stitched');
ok('the honesty row — one text flow (the 5.237 law, held)');

/* ── 11. the Custom bytes untouched (5.238 still standing) ── */
assert.ok(bills.includes("type DateFilter = 'today' | '7d' | 'custom' | 'all';"), 'the DateFilter union unchanged');
assert.ok(bills.includes('useState<string>(() => shiftDayIso(-6))'), 'From arms 6 days back');
assert.ok(bills.includes("useState<string>(() => appTodayIso())"), 'To arms today');
/* v5.242.0 re-anchor: the memo's BASE grew the money book (loaded ∪ book —
 * the whole-book census), the deps pair is byte-identical. */
assert.ok(bills.includes('}, [book, statusFilter, dateFilter, search, customFrom, customTo]);'), 'the memo rides the pair');
assert.equal((bills.match(/max=\{appTodayIso\(\)\}/g) || []).length, 2, 'both custom inputs cap at today');
assert.equal((bills.match(/sp-input h-9 rounded-xl border border-\[#E3E7E0\]/g) || []).length, 2, 'both custom inputs wear the house ink');
assert.ok(bills.includes('`from ${rangeLabelOf(\'custom\', { from: customFrom, to: customTo })}`'), 'the custom miss sentence byte-true');
assert.ok(bills.includes('`Custom (${customSpan})`'), 'the custom chip label byte-true');
assert.ok(bills.includes('Showing {customSpan}'), 'the custom hint byte-true');
ok('the 5.238 laws — byte-true');

/* ── 12. the lib's fixed words byte-true (the chip voice survives) ── */
assert.equal(RANGE_LABEL['7d'], 'Last 7 days', 'the lib keeps the chip word');
assert.equal(rangeLabelOf('7d'), 'Last 7 days', 'the lib label law unchanged (unit275\u2019s pin holds)');
assert.deepEqual(orderedCustom({ from: '2026-10-05', to: '2026-10-02' }), ['2026-10-02', '2026-10-05'], 'the swap still holds');
ok('the lib — the chip word and the swap, byte-true');

/* ── 13. the version law: one word, two homes (the agreement shape) ── */
const { APP_VERSION: v279 } = await import('/src/version.ts');
assert.ok(v279.length > 0, 'version.ts speaks a word');
assert.ok(swSrc.includes(`servepoint-v${v279}-r1`), 'the service worker bakes the same round');
ok(`the version law — version.ts and sw.js agree on ${v279}`);

console.log(`\nunit279: ${n} checks green — the week answers to a calendar`);
