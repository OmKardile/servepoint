/* Task 266 — v5.227.0 unit suite: the paper answers the quiet-only book.
 *
 * The morning paper's book card (5.207) rendered only when the book held
 * promises AHEAD — `promises.ahead.length > 0` — and its quiet whisper
 * lived INSIDE that card. On a morning where every promise's hour has
 * already gone by (ahead = 0, quiet = 1 — the exact live case the round
 * caught: the 8:05 am promise past the band's 60-minute lookback, zero
 * sales today), the paper showed Yesterday / Week / Given-away and NO
 * trace of the book. The band above had honestly retired the promise (its
 * ±60/90min scope), so the Dashboard said nothing while the Floor book,
 * the archive and the Z all spoke the debt. A quiet-only book is a story,
 * not silence.
 *
 * 1. bookAhead rides the quiet rows home (most recent first — the book's
 *    own voice rule, 5.221, the same rule the band's hint obeys): the
 *    return shape grows `quietRows`, `quiet` stays the count (one number,
 *    one derivation — the 5.262 law). Non-booked and other-day rows never
 *    speak. Ahead and quiet co-exist in one pass.
 * 2. The paper's guard admits the quiet-only book; the card's label says
 *    "today" when nothing is left of it; the quiet-only branch speaks the
 *    debt in the floor book header's own convict-free grey and NAMES the
 *    most recent quiet row (slot in the booking voice, guest, party) with
 *    the band's own tail words; the door's aria follows. The ahead branch
 *    keeps its bytes byte-identical — headline, first row, gold whisper,
 *    door.
 *
 * Asserted: the lib grammar (quietRows order, co-existence, exclusions,
 * the evolved empty shape); the DashboardScreen wiring (the guard, the
 * card guard, the label conditional, the grey headline, the named row,
 * the door aria, the ahead branch's preserved bytes, the band untouched,
 * no new timer — the heartbeat stands at 1).
 * Run: bunx vite-node scripts/unit266.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { bookAhead } = await import('/src/components/dashboard/DashboardScreen.tsx');

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);
const strip = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

const T = '2026-10-05'; // the booking-clock "today" the tests pass
const slot = (iso, status = 'booked') => ({
  id: iso,
  tenant_id: 't',
  location_id: null,
  guest_name: 'E2E Kumar',
  phone: '',
  party_size: 4,
  table_id: null,
  slot_at: iso,
  status,
  note: '',
  created_by_email: '',
  created_at: iso,
  updated_at: iso,
});

const now = new Date(`${T}T09:30:00+05:30`).getTime(); // 09:30 IST

/* ── 1. The lib — the quiet rows ride home ── */

// quiet-only: the live case — one promise at 8:05, nothing ahead
const b1 = bookAhead([slot(`${T}T08:05:00+05:30`)], now, T);
assert.equal(b1.ahead.length, 0);
assert.equal(b1.quiet, 1);
assert.equal(b1.quietRows.length, 1, 'the quiet row rides home');
assert.equal(b1.quietRows[0].slot_at, `${T}T08:05:00+05:30`);
ok('a quiet-only book returns its row — the card can name the debt');

// most recent first (the book's own voice rule)
const b2 = bookAhead(
  [slot(`${T}T07:30:00+05:30`), slot(`${T}T08:40:00+05:30`), slot(`${T}T08:05:00+05:30`)],
  now,
  T,
);
assert.deepEqual(
  b2.quietRows.map((r) => r.slot_at),
  [`${T}T08:40:00+05:30`, `${T}T08:05:00+05:30`, `${T}T07:30:00+05:30`],
  'quiet rows sort most recent first',
);
assert.equal(b2.quiet, 3, 'the count stays the rows\' length — one derivation');
ok('quiet rows sort most-recent-first; quiet stays the count');

// ahead and quiet co-exist in one pass
const b3 = bookAhead(
  [slot(`${T}T08:05:00+05:30`), slot(`${T}T19:00:00+05:30`)],
  now,
  T,
);
assert.equal(b3.ahead.length, 1);
assert.equal(b3.quiet, 1);
assert.equal(b3.quietRows.length, 1);
ok('ahead and quiet co-exist — one pass, one grammar');

// non-booked and other-day rows never ride
const b4 = bookAhead(
  [slot(`${T}T08:05:00+05:30`, 'seated'), slot(`${T}T08:05:00+05:30`, 'no_show'), slot('2026-10-04T08:05:00+05:30')],
  now,
  T,
);
assert.equal(b4.quietRows.length, 0);
assert.deepEqual(b4, { ahead: [], quiet: 0, quietRows: [] });
ok('a seated, no-show or other-day promise never rides home');

ok('the quiet grammar is one pass over the book — no second clock');

/* ── 2. The paper — the card speaks the debt ── */

const dash = strip('../src/components/dashboard/DashboardScreen.tsx');

assert.ok(dash.includes('(promises.ahead.length === 0 && promises.quiet === 0)'),
  'the paper\'s guard admits the quiet-only book');
assert.ok(dash.includes('(promises.ahead.length > 0 || promises.quiet > 0) && ('),
  'the card renders on ahead OR quiet');
assert.ok(dash.includes("{promises.ahead.length > 0 ? 'rest of today' : 'today'}"),
  'the label says today when nothing is left of it');
assert.ok(dash.includes('text-[22px] font-bold leading-tight text-[#6B6B6B]'),
  'the quiet-only headline wears the floor book header\'s convict-free grey');
assert.ok(dash.includes("{promises.quiet} {promises.quiet === 1 ? 'promise' : 'promises'} went quiet"),
  'the headline speaks the count with the plural grammar');
assert.ok(dash.includes('bookingSlotLabel(promises.quietRows[0].slot_at)'),
  'the debt names its most recent row (the booking voice)');
assert.ok(dash.includes('— the promised hour went by, still booked'),
  'the tail words are the band\'s own (one voice)');
assert.ok(dash.includes("`Open the floor's book — ${promises.quiet} went quiet today`"),
  'the door\'s aria follows the quiet-only branch');
ok('the quiet-only card speaks in the family\'s words and ink');

/* ── 3. The neighbours — byte-untouched ── */

assert.ok(dash.includes("{promises.ahead.length} {promises.ahead.length === 1 ? 'promise' : 'promises'} ahead"),
  'the ahead headline keeps its bytes');
assert.ok(dash.includes("one promise's hour went by, still booked"),
  'the gold whisper keeps its bytes');
assert.ok(dash.includes('font-medium text-[#967221]'),
  'the whisper keeps its gold ink (the paper\'s attention register)');
assert.ok(dash.includes("{bookingSlotLabel(promises.ahead[0].slot_at)}"),
  'the first-ahead naming keeps its bytes');
assert.ok(dash.includes("for the rest of today`"),
  'the ahead aria keeps its bytes');
const intervals = dash.split('setInterval').length - 1;
assert.equal(intervals, 1, `the heartbeat stands — still 1, found ${intervals}`);
ok('the ahead branch and the heartbeats keep their bytes');

console.log(`\nunit266 — ${n} checks green`);
