/* Task 264 — v5.225.0 unit suite: the past book keeps the verdict.
 *
 * The book's row badges computed their promise verdict under a TODAY gate:
 * a booked row whose promised hour passed read "Booked · went quiet" only
 * when its day was today — a Saturday promise opened in Monday's archive
 * still wore the ledger's gold "Booked", the exact second-verdict disease
 * 5.223 killed in the header (the ledger speaks where the clock has already
 * answered). The quiet verdict is now the archive's too: the lib's
 * isQuietPromiseAnyDay speaks for ANY booked row whose hour has passed,
 * and the book's day headings count their own quiet debt beside the
 * badges' clock (rowNowMs — one pass, one verdict), so the archive
 * scan-reads which days left promises unanswered. The board and the
 * arrivals slot keep their today-gated silence (5.86 was right there —
 * a past promise is not an arrival); the amber due-soon stays today-only;
 * a future-day promise keeps the honest gold.
 *
 * Asserted: the lib predicate (past-day booked speaks, future-day and
 * non-booked stay silent, purity, minute-boundary honesty); the today-gated
 * pair UNCHANGED (yesterday booked → false — the board's 5.86 silence
 * stands); the Floor wiring (the import rides, the row verdict uses the
 * any-day predicate, the due-soon branch stays today-gated behind
 * rowTodayKey, the RES_META fallback remains for future-day + non-booked);
 * the badge + title bytes unchanged; the heading quiet chip (grey,
 * normal-case, convict-free title, plural-honest words, derived with the
 * same predicate + rowNowMs); the map's block-body closure; no new timer;
 * the board's and arrivals' today-gated callers untouched.
 * Run: bunx vite-node scripts/unit264.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const bd = await import('/src/lib/bookingday.ts');
const { isQuietPromiseAnyDay, isQuietPromise, isLivePromise, bookingDayKey, PROMISE_DUE_SOON_MIN } = bd;

const floor = readFileSync(new URL('../src/components/floor/FloorScreen.tsx', import.meta.url), 'utf8');
const dash = readFileSync(new URL('../src/components/dashboard/DashboardScreen.tsx', import.meta.url), 'utf8');

let n = 0;
const ok = (s) => { n++; console.log(`  ✓ ${s}`); };

/* The suite owns the clock: NOW = Mon 5 Oct 2026, 09:00 IST. */
const NOW = Date.parse('2026-10-05T03:30:00Z');
const TODAY_PAST = '2026-10-05T02:35:00Z';    // 8:05 am IST today — hour gone
const TODAY_AHEAD = '2026-10-05T05:00:00Z';   // 10:30 am IST today — still ahead
const SAT_PAST = '2026-10-03T11:17:00Z';      // 4:47 pm IST Saturday — the live-caught row
const TOMORROW = '2026-10-06T11:00:00Z';      // 4:30 pm IST Tuesday — a future promise
const TODAY_KEY = bookingDayKey(TODAY_PAST);  // the booking clock's own grammar

const row = (slot_at, status = 'booked') => ({ status, slot_at });

/* ── 1. The archive's verdict — isQuietPromiseAnyDay ── */

assert.equal(isQuietPromiseAnyDay(row(SAT_PAST), NOW), true,
  'a Saturday promise read on Monday speaks — the archive keeps the verdict');
assert.equal(isQuietPromiseAnyDay(row(TODAY_PAST), NOW), true,
  'today\'s quiet is the same verdict the clock always spoke');
assert.equal(isQuietPromiseAnyDay(row(TOMORROW), NOW), false,
  'a future promise stays gold — its hour is still ahead');
assert.equal(isQuietPromiseAnyDay(row(TODAY_AHEAD), NOW), false,
  'today\'s still-ahead hour is not quiet');
assert.equal(isQuietPromiseAnyDay(row(SAT_PAST, 'seated'), NOW), false,
  'a seated past row never speaks — the party came');
assert.equal(isQuietPromiseAnyDay(row(SAT_PAST, 'no_show'), NOW), false,
  'a recorded no-show never speaks — the verdict is the host\'s, and it was given');
assert.equal(isQuietPromiseAnyDay(row(SAT_PAST, 'cancelled'), NOW), false,
  'a cancelled row never happened');
ok('the archive verdict: booked + hour passed, any day; everyone else silent');

/* the exact boundary — the hour that is going by RIGHT NOW is not yet quiet */
const EDGE = new Date(NOW - 1000).toISOString();
assert.equal(isQuietPromiseAnyDay(row(EDGE), NOW), true, 'a second-old hour has passed');
const FUTURE_EDGE = new Date(NOW + 1000).toISOString();
assert.equal(isQuietPromiseAnyDay(row(FUTURE_EDGE), NOW), false, 'a second-ahead hour is still expected');
ok('the boundary is the hour itself — the clock\'s own edge, not a buffer');

/* purity — same rows, same answer, no clock of its own */
assert.equal(isQuietPromiseAnyDay(row(SAT_PAST), NOW), isQuietPromiseAnyDay(row(SAT_PAST), NOW),
  'pure: the same input reads the same verdict');
ok('the predicate is pure — no hidden clock, no hidden state');

/* ── 2. The board's silence stands — the today-gated pair is UNTOUCHED ── */

assert.equal(isQuietPromise(row(SAT_PAST), NOW, TODAY_KEY), false,
  'the board\'s quiet stays today-gated — a past promise is not an arrival (5.86)');
assert.equal(isQuietPromise(row(TODAY_PAST), NOW, TODAY_KEY), true,
  'the board still speaks today\'s quiet');
assert.equal(isLivePromise(row(TOMORROW), NOW, TODAY_KEY), false,
  'the board\'s live verdict stays today-gated too');
assert.equal(isLivePromise(row(TODAY_AHEAD), NOW, TODAY_KEY), true,
  'the board\'s live verdict speaks for today\'s ahead hour');
ok('the board and arrivals keep 5.86\'s silence — the new predicate never touched them');

/* source pins: the today-gated callers are byte-identical */
assert.ok(floor.includes('if (isLivePromise(r, nowMs, todayKey)) {') && floor.includes('} else if (isQuietPromise(r, nowMs, todayKey)) {'),
  'the board\'s next-promise computation still reads the today-gated pair');
assert.ok(dash.includes('.filter((r) => isLivePromise(r, nowMs, arrivalsTodayKey))') &&
  dash.includes('.filter((r) => isQuietPromise(r, nowMs, arrivalsTodayKey))'),
  'the arrivals slot still reads the today-gated pair');
ok('both old callers pinned — the lib grew, nobody was rewired');

/* ── 3. The Floor wiring — the book rows speak the archive verdict ── */

assert.ok(floor.includes('  isQuietPromiseAnyDay,\n'), 'the import rides the bookingday block');
assert.ok(floor.includes('r.status === \'booked\'\n                    ? (() => {\n                        if (isQuietPromiseAnyDay(r, rowNowMs))'),
  'the row verdict opens on booked and asks the ANY-DAY predicate first');
assert.ok(floor.includes("label: 'Booked · went quiet',"), 'the badge keeps its words');
assert.ok(floor.includes('The promised hour went by — the party is still booked. Seat them or mark the no-show; the clock does not convict.'),
  'the convict-free title is byte-identical — one voice on every day');
assert.ok(floor.includes('if (bookingDayKey(r.slot_at) === rowTodayKey) {\n                          const mins = minsUntil(r.slot_at, rowNowMs);'),
  'the due-soon branch stays today-gated behind rowTodayKey');
assert.ok(floor.includes(`if (mins <= PROMISE_DUE_SOON_MIN)`), 'the amber line stays PROMISE_DUE_SOON_MIN');
assert.ok(floor.includes('const res = RES_META[r.status];'), 'the RES_META fallback remains for future-day + non-booked');
ok('the book rows: quiet on any day, amber today-only, gold only when honest');

/* the old gate is gone from the ROW verdict — it survives exactly once, in
   the header's bookedTodayRows, where "still expected TODAY" is today-scoped
   by design (5.223's own words); the badge ternary no longer opens with it */
const gateUses = floor.split("r.status === 'booked' && bookingDayKey(r.slot_at) === rowTodayKey").length - 1;
const ternaryGate = floor.includes("'booked' && bookingDayKey(r.slot_at) === rowTodayKey\n                    ? (() => {");
assert.ok(gateUses === 1 && !ternaryGate,
  'the today gate no longer guards the row verdict — it lives only in the header\'s today-scoped count');
ok('the old today-gated verdict is retired from the rows; the header keeps its own by design');

/* ── 4. The day headings — the archive scan-reads its debt ── */

assert.ok(floor.includes('const quietCount = rows.filter((r) => isQuietPromiseAnyDay(r, rowNowMs)).length;'),
  'the heading count derives beside the badges\' clock (rowNowMs — one pass, one verdict)');
assert.ok(floor.includes('{quietCount > 0 && ('), 'the chip is guarded on zero — silence never a zero');
assert.ok(floor.includes('{quietCount} went quiet'), 'the chip speaks the book\'s own words, plural-honest');
assert.ok(floor.includes('Booked promises whose hour passed and were never resolved — still booked; the clock does not convict.'),
  'the chip wears the convict-free title');
const chipIdx = floor.indexOf('{quietCount} went quiet');
assert.ok(floor.slice(chipIdx - 260, chipIdx).includes('bg-[#F1F4F1]') && floor.slice(chipIdx - 260, chipIdx).includes('text-[#6B6B6B]'),
  'the chip speaks in the quiet grey — the archive\'s one tone');
assert.ok(floor.slice(chipIdx - 260, chipIdx).includes('normal-case'),
  'the chip keeps sentence case inside the uppercase heading');
assert.ok(floor.indexOf('const quietCount') < floor.indexOf('rows.map((r) => {'),
  'the count is derived BEFORE the rows render — same pass, same clock');
ok('the day headings count their quiet debt — grey, guarded, one pass');

/* the map closure matches the new block body (5.261's anchor law) */
const mapOpen = floor.indexOf('book.groups.map(([dayKey, rows]) => {');
const mapClose = floor.indexOf('          );\n        })}', mapOpen);
assert.ok(mapOpen > 0 && mapClose > mapOpen, 'the block-body map closes with return + })}');
ok('the map closure was rewritten with the body — no dangling )}');

/* ── 5. The heartbeat — no new timer ── */

const intervals = floor.match(/setInterval\(/g) || [];
assert.equal(intervals.length, 4, 'the floor still runs exactly its four heartbeats — the verdict rides rowNowMs');
ok('no new timer — the archive reads the clocks it already has');

console.log(`\nunit264 — ${n} checks green`);
