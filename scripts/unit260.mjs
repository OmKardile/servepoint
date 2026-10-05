/* Task 260 — v5.221.0 unit suite: the band hears the whole book.
 *
 * The Dashboard's arrivals slot (v5.61.0) counted every booked row inside
 * its anti-ghost window as "due" — including parties whose promised hour
 * passed up to sixty minutes ago, a SECOND book verdict spoken beside the
 * Floor chip's own law. And the QR slot named a count but never a PLACE,
 * even though the band already holds the tables. The fix is one lift and
 * one naming:
 *
 * 1. The book's promise verdicts (isLivePromise / isQuietPromise /
 *    minsUntil) moved home to lib/bookingday — the clock they already
 *    belong to — and PROMISE_DUE_SOON_MIN names the amber line the Floor
 *    carried THREE bare `mins <= 45` literals of (5.211: a rule two
 *    screens need is a lib's rule, never a copy; the Floor keeps its
 *    words, loses its local bodies). The verdicts judge on the clocks
 *    they are GIVEN (nowMs + todayKey — 228's seam) and read the row
 *    structurally (status + slot_at), so the lib stays dependency-free.
 * 2. The arrivals slot splits its scope by the lib verdict: DUE stays
 *    deep ink, a party inside the book's 45-minute line turns the chip's
 *    own amber (#FDF3E4/#8A5A16), and quiet-only scope speaks the book's
 *    convict-free grey (#F1F4F1/#6B6B6B) — "went quiet", never a
 *    no-show conviction. The hint names the next party in the book's own
 *    words (guest · party · promised 7:30 pm), or the most recent quiet
 *    row when only debt remains. The door stays on the Floor — the book's
 *    room. Midnight gate follows the book: yesterday's promises don't
 *    speak.
 * 3. The QR slot names WHERE: the value carries the distinct table
 *    numbers holding live windows (a failed tables read degrades to the
 *    old tableless words — never a fabricated name), the warm hint names
 *    the dying window's own table through youngestLiveWindow — the argmin
 *    lifted into lib/tableSession so youngestLiveMs composes it (ONE
 *    minimum arithmetic, two names).
 *
 * Asserted: the lib verdicts (booked-only, today-gated, two clocks on one
 * row, the 45 line named, minsUntil's ceil+clamp); youngestLiveWindow's
 * argmin + null-on-empty and youngestLiveMs's composed Infinity seed; the
 * Floor importing the family with NO local copy and zero bare 45s; the
 * Dashboard's scope + lib-verdict split + amber/grey tones + the book's
 * hint words + the quiet sort (most recent debt first); the QR naming
 * (map from now.tables, value/aria/hint bytes, degrade-to-tableless);
 * zero new timers; no formatWindowLeft on the Dashboard.
 * Run: bunx vite-node scripts/unit260.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (s) => { n++; console.log(`  ✓ ${s}`); };
const strip = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

/* ── 1. The lib verdicts — ONE book rule, judged on given clocks ── */

const bd = await import('/src/lib/bookingday.ts');
const { isLivePromise, isQuietPromise, minsUntil, PROMISE_DUE_SOON_MIN } = bd;

assert.equal(PROMISE_DUE_SOON_MIN, 45, 'the amber line is 45 minutes — now it has a NAME');
ok('PROMISE_DUE_SOON_MIN: the book\'s amber line, named');

const NOW = Date.parse('2026-10-05T14:00:00Z'); // 19:30 IST — hour-stable anchor, far from midnight
const TODAY = bd.bookingDayKey(new Date(NOW).toISOString());

const due = { status: 'booked', slot_at: '2026-10-05T14:30:00Z' };      // 20:00 IST — ahead
const past = { status: 'booked', slot_at: '2026-10-05T13:30:00Z' };     // 19:00 IST — passed
const yesterday = { status: 'booked', slot_at: '2026-10-04T14:30:00Z' };

assert.equal(isLivePromise(due, NOW, TODAY), true, 'a future booked promise advertises');
assert.equal(isQuietPromise(due, NOW, TODAY), false, 'a future promise is NOT quiet');
assert.equal(isLivePromise(past, NOW, TODAY), false, 'a passed promise does not advertise');
assert.equal(isQuietPromise(past, NOW, TODAY), true, 'a passed promise went quiet — the clock does not convict');
ok('the two verdicts split cleanly at the promised instant');

for (const status of ['seated', 'no_show', 'cancelled']) {
  const r = { status, slot_at: due.slot_at };
  assert.equal(isLivePromise(r, NOW, TODAY), false, `${status} never advertises`);
  assert.equal(isQuietPromise(r, NOW, TODAY), false, `${status} never goes quiet either — it already spoke`);
}
ok('booked-only: a seated, no-show or cancelled row never speaks');

assert.equal(isLivePromise(yesterday, NOW, TODAY), false, 'yesterday\'s kept promise is silent');
assert.equal(isQuietPromise(yesterday, NOW, TODAY), false, 'yesterday\'s broken promise is silent too — they don\'t either');
ok('the today gate: yesterday\'s promises don\'t speak');

const T1 = Date.parse('2026-10-05T13:00:00Z');
const T2 = Date.parse('2026-10-05T14:30:00Z');
const oneRow = { status: 'booked', slot_at: '2026-10-05T14:00:00Z' };
assert.equal(isLivePromise(oneRow, T1, TODAY), true, 'at 18:30 IST the 19:30 promise is live');
assert.equal(isQuietPromise(oneRow, T2, TODAY), true, 'at 20:00 IST the SAME promise went quiet');
ok('the nowMs seam: two clocks on ONE row flip the verdict');

assert.equal(minsUntil('2026-10-05T14:00:30Z', NOW), 1, 'a slot 30s away is still 1 min (ceil)');
assert.equal(minsUntil('2026-10-05T13:00:00Z', NOW), 0, 'a past slot clamps at 0 — never negative minutes');
ok('minsUntil: rounded up, floored at zero');

/* ── 2. youngestLiveWindow — the argmin gets a name, the ms composes ── */

const ts = await import('/src/lib/tableSession.ts');
const { youngestLiveWindow, youngestLiveMs } = ts;

const mk = (id, tableId, minsLeft, created) => ({
  id, table_id: tableId,
  session_token: `tok-${id}`,
  status: 'active',
  created_at: created ?? '2026-10-05T13:50:00Z',
  expires_at: new Date(NOW + minsLeft * 60000).toISOString(),
});
const rows = [mk('a', 't1', 7), mk('b', 't2', 2), mk('c', 't1', 9)];

const y = youngestLiveWindow(rows, NOW);
assert.equal(y?.id, 'b', 'the youngest window is the smallest remainder, not the first or largest');
assert.equal(youngestLiveWindow([], NOW), null, 'an EMPTY set yields null — never a fabricated row');
assert.equal(
  youngestLiveWindow([mk('d', 't3', -5)], NOW),
  null,
  'all-expired yields null — the live filter gates the argmin',
);
ok('youngestLiveWindow: the argmin by expires_at, null when nothing lives');

assert.equal(youngestLiveMs(rows, NOW), 2 * 60000, 'the ms composes the window (same minimum, one arithmetic)');
assert.equal(youngestLiveMs([], NOW), Infinity, 'the Infinity seed keeps its post — an empty set never reads warm');
ok('youngestLiveMs composes youngestLiveWindow — no second reduce');

/* ── 3. The Floor — the family imported, the local bodies gone ── */

const floor = strip('../src/components/floor/FloorScreen.tsx');

assert.ok(floor.includes('  isLivePromise,\n  isQuietPromise,\n  minsUntil,\n  PROMISE_DUE_SOON_MIN,\n} from \'../../lib/bookingday\';'),
  'the Floor imports the promise family from the booking clock\'s lib');
assert.ok(!floor.includes('function isLivePromise('), 'no local live-verdict copy');
assert.ok(!floor.includes('function isQuietPromise('), 'no local quiet-verdict copy');
assert.ok(!floor.includes('function minsUntil('), 'no local minsUntil copy');
assert.ok(!floor.includes('mins <= 45'), 'zero bare 45s — the amber line speaks its NAME');
const floorConstUses = floor.split('PROMISE_DUE_SOON_MIN').length - 1;
assert.ok(floorConstUses >= 4, `the named constant is used at every amber site (import + 3 uses) — found ${floorConstUses}`);
ok('the Floor keeps its words, loses its local bodies (5.211)');

/* ── 4. The arrivals slot — the BOOK's verdict, the chip's tones ── */

const dash = strip('../src/components/dashboard/DashboardScreen.tsx');

assert.ok(dash.includes('isLivePromise,\n  isQuietPromise,\n  minsUntil,\n  PROMISE_DUE_SOON_MIN,\n} from \'../../lib/bookingday\';'),
  'the Dashboard imports the SAME verdict family');
assert.ok(!dash.includes('function isLivePromise('), 'no local promise copy on the Dashboard');
assert.ok(dash.includes('slot >= nowMs - 60 * 60000 && slot <= nowMs + 90 * 60000'),
  'the band\'s own anti-ghost scope stands (an hour of grace, ninety ahead)');
assert.ok(dash.includes('isLivePromise(r, nowMs, arrivalsTodayKey)'), 'DUE rows are judged by the lib verdict');
assert.ok(dash.includes('isQuietPromise(r, nowMs, arrivalsTodayKey)'), 'quiet rows are judged by the SAME lib');
assert.ok(
  dash.includes('.filter((r) => isQuietPromise(r, nowMs, arrivalsTodayKey))\n    .sort((a, b) => new Date(b.slot_at).getTime() - new Date(a.slot_at).getTime())'),
  'quiet rows sort most-recent-first — the book\'s own voice rule for debt',
);
assert.ok(dash.includes('minsUntil(r.slot_at, nowMs) <= PROMISE_DUE_SOON_MIN'),
  'the amber line is the named constant, not a second 45');
ok('the arrivals slot speaks ONE book verdict, not a second one');

assert.ok(dash.includes("'text-[#8A5A16]' : quietOnly ? 'text-[#5F6B63]' : 'text-[#0F3D3E]'"),
  'amber inside the 45-minute line, grey when only quiet remains, deep ink otherwise');
assert.ok(dash.includes("'bg-[#FDF3E4] text-[#8A5A16]'"), 'the chip tone is the book chip\'s own amber');
assert.ok(dash.includes("'bg-[#F1F4F1] text-[#6B6B6B]'"), 'quiet-only speaks the book\'s convict-free grey');
assert.ok(dash.includes('went quiet'), 'the value says "went quiet" — never a no-show conviction');
assert.ok(dash.includes('the promised hour passed, still booked'), 'the aria spells the quiet state in full words');
assert.ok(dash.includes('`next ${nextDue.guest_name} · ${nextDue.party_size}p${dueTable ? ` · ${dueTable}` : \'\'} · promised ${bookingSlotLabel(nextDue.slot_at)}`'),
  'the hint names the next party in the book\'s own words (5.222 adds the table clause — the words stand)');
assert.ok(dash.includes('the promised hour went by, still booked`'),
  'quiet-only scope names the most recent debt');
assert.ok(dash.includes('the next is inside the book\'s 45-minute line'),
  'the aria names the amber state');
ok('the words are the book\'s, the tones are the chip\'s');

assert.ok(dash.includes("onOpen: () => go('floor', ['Dashboard', 'Floor'])"), 'the door opens the Floor — the book\'s room');
assert.ok(dash.includes('in the book\'s arrival window'), 'the door\'s aria names the whole scope honestly');
ok('the door follows the truth (5.89)');

/* ── 5. The QR slot — the band already holds the tables, so WHERE is free ── */

assert.ok(dash.includes('const tableNameById = new Map(now.tables.map((t) => [t.id, t.table_number]));'),
  'the table names come from the read the band ALREADY holds — zero new fetches (5.222 renames it: one map, two slots)');
assert.ok(dash.includes("filter((n): n is string => !!n)"), 'unknown table ids drop out — never a fabricated name');
assert.ok(dash.includes('qrNames ? ` · ${qrNames}` : \'\''),
  'the value carries the distinct table numbers');
assert.ok(dash.includes('open on ${qrNames ?? \'the tables\'}'),
  'a failed tables read degrades to the old tableless words');
assert.ok(dash.includes('const youngestQr = youngestLiveWindow(liveQr, nowMs);'),
  'the dying window comes from the lib argmin');
assert.ok(dash.includes('import { liveWindows, youngestLiveMs, youngestLiveWindow } from \'../../lib/tableSession\';'),
  'the argmin rides the ONE session lib');
ok('the QR slot names WHERE — free, honest, degradable');

/* ── 6. The discipline — no new timer, no stopwatch, no regression ── */

const dashIntervals = dash.split('window.setInterval(').length - 1;
assert.equal(dashIntervals, 1, `exactly ONE interval on the Dashboard — found ${dashIntervals}`);
assert.ok(!dash.includes('formatWindowLeft'), 'the Dashboard still speaks NO stopwatch');
assert.ok(dash.includes('await fetchTableSessions(tenantId).catch(() => null);'),
  'the fail-soft session read stands');
assert.ok(!floor.includes('PROMISE_DUE_SOON_MIN = 45'), 'the constant is not re-declared on the Floor');
/* 5.221.0 E2E catch — the slots' rich aria strings were computed and then
   DROPPED: the render block never bound s.aria, so the band's screen
   reader heard the doors but not the slots themselves. The container now
   speaks. */
assert.ok(dash.includes('role="group" aria-label={s.aria}'),
  'every slot\'s full-words aria reaches the DOM (the band speaks for itself)');
ok('no new timer, no stopwatch, no second copy — and the band\'s words are audible');

console.log(`\nunit260 — ${n} checks green (the band hears the whole book)`);
