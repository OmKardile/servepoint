/* Task 263 — v5.224.0 unit suite: the Z-report answers the book.
 *
 * The close-out's floor strip counted what the book RECORDED (no-shows,
 * v5.83) but never what the book never ANSWERED — a booked promise whose
 * hour passed and was never resolved leaves no trace in the Z: the owner
 * closing the day reads "No-shows: 0" while a party sits in the book still
 * marked 'booked', its hour gone. The Z-report now tells the day's whole
 * book truth: rounds seated (the kept seats), no-shows (the recorded
 * misses), and the quiet debt (the unanswered hour) — the same convict-free
 * words the book, the band and the drill speak, drawn by the SAME day
 * bounds the no-show read uses, silent when the book never loaded or the
 * debt is zero — never a guessed zero. And the whisper speaks in BOTH
 * branches of the strip: a zero-rounds day can still carry book debt
 * (today is exactly that day).
 *
 * Asserted: the quiet read (booked-only, the EOD's own istDayBounds — one
 * day grammar in this surface, the hour-passed predicate, the null guard);
 * the threading (the floor type's wentQuiet, the Z opts' quietDay); the
 * print-HTML and text/CSV builders' 'Went quiet' rows with their >0
 * guards; the strip whisper's both-branch placement + grey tone + the
 * clock-does-not-convict title; the no-show neighbour untouched; the
 * silence rule everywhere.
 * Run: bunx vite-node scripts/unit263.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (s) => { n++; console.log(`  ✓ ${s}`); };
const strip = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

const eod = strip('../src/components/eod/EodScreen.tsx');

/* ── 1. The quiet read — what the book never answered ── */

assert.ok(eod.includes('const quietDay = useMemo('), 'the quiet read exists beside the no-show read');
assert.ok(eod.includes("r.status === 'booked' &&"), 'it counts BOOKED rows — never seated/cancelled/no-show');
assert.ok(eod.includes('if (!reservations) return null;'),
  'a book that never loaded stays silent — null, not a guessed zero');
assert.ok(eod.includes('new Date(r.slot_at).getTime() < nowMs'),
  'the hour-passed predicate — the book\'s own quiet boundary');
assert.ok(
  eod.indexOf('const { startIso, endIso } = istDayBounds(dateIso);') !== -1 &&
    eod.split('istDayBounds(dateIso)').length >= 3,
  'the SAME istDayBounds as the no-show read — one day grammar in this surface');
ok('the quiet read: booked, hour passed, honest silence when the book is absent');

/* ── 2. The threading — the Z's floor block carries the debt ── */

assert.ok(eod.includes('wentQuiet: number | null'), 'the floor type grew the quiet field');
assert.ok(eod.includes('wentQuiet: quietDay,'), 'the Z opts thread the quiet count');
assert.ok(eod.includes("row('Went quiet', `${opts.floor.wentQuiet} promise${opts.floor.wentQuiet === 1 ? '' : 's'} still booked`)"),
  'the print-HTML Z speaks "Went quiet · N promise(s) still booked"');
assert.ok(eod.includes("two('Went quiet', `${opts.floor.wentQuiet} promise${opts.floor.wentQuiet === 1 ? '' : 's'} still booked`)"),
  'the Copy / WhatsApp Z speaks the same row');
ok('both Z builders carry the debt row — print and chat, one voice');

// the silence rule in both builders — a zero debt prints nothing
const htmlRow = eod.indexOf("opts.floor.wentQuiet && opts.floor.wentQuiet > 0 ? row('Went quiet'");
const textRow = eod.indexOf("opts.floor.wentQuiet && opts.floor.wentQuiet > 0)\n      out.push(two('Went quiet'");
assert.ok(htmlRow > 0 && textRow > 0, 'both rows guard on > 0');
ok('a zero debt prints nothing — the silence rule holds in both builders');

/* ── 3. The strip whisper — the debt speaks in BOTH branches ── */

assert.ok(eod.includes('{quietDay !== null && quietDay > 0 && ('),
  'the strip whisper guards null AND zero');
assert.ok(
  eod.indexOf('{quietDay !== null && quietDay > 0 && (') >
    eod.indexOf("The floor sat quiet — no table rounds to close out."),
  'the whisper sits OUTSIDE the rounds===0 branch — a quiet-debt day speaks even with zero rounds');
assert.ok(eod.includes("Booked promises whose hour passed on this day and were never resolved — still booked; the clock does not convict."),
  'the whisper wears the book\'s own convict-free title');
assert.ok(
  eod.indexOf("className=\"text-[10.5px] font-semibold text-[#6B6B6B]\"", eod.indexOf('{quietDay !== null && quietDay > 0 && (')) > 0,
  'the whisper speaks in the book\'s convict-free grey');
assert.ok(eod.includes("{quietDay} {quietDay === 1 ? 'promise' : 'promises'} went quiet"),
  'the agreed plural — the book\'s own words');
ok('the strip whisper: both branches, grey, convict-free, plural-honest');

/* ── 4. The neighbour — the no-show whisper stands untouched ── */

assert.ok(eod.includes("{noShowDay} {noShowDay === 1 ? 'booking' : 'bookings'} didn't show"),
  'the no-show whisper\'s words are untouched');
assert.ok(eod.includes("Bookings whose slot fell on this day and were marked no-show in the book"),
  'the no-show whisper\'s title is untouched');
ok('the v5.83 neighbour stands — the recorded miss and the unanswered hour now sit side by side');

console.log(`\nunit263 — ${n} checks green`);
