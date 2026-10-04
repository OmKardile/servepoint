/* Task 239 — v5.200.0 unit suite: the bell's hour names its day.
 * The booking trigger composes the reminder body ONCE — "7:30 pm — T1 — …"
 * — and the bell repeats those frozen words on every later day, so a row
 * read tomorrow reads like tonight's promise: title says "Booking today:",
 * the body says "7:30 pm" with no day, the stamp says "1 day ago" — three
 * day-voices, none of them the slot's own. The slot's day now rides the
 * row's own book match: matchReminder is the echo's matcher extracted
 * (ONE definition), reminderDayBody prefixes the booking clock's day tag
 * ("Sat 3 Oct, 7:30 pm — T1 — …") when the matched slot's day is not the
 * reader's today, and bookingDayTag is the booking clock's own weekday
 * word (new in the 5.105 family). Today's rows keep the frozen bytes;
 * an unmatched or ambiguous row keeps its silence — the day voice never
 * guesses from text alone. The echo's five spoken states carry the
 * matched slot (slotIso) so the day voice and the chip read one truth.
 * Asserted: matchReminder's exactly-one semantics; reminderDayBody's
 * four shapes (non-today match, today match, no match, ambiguous, null
 * book); bookingDayTag in the booking clock incl. the UTC-midnight
 * boundary (IST's +05:30 flips the day where UTC doesn't); the live-copy
 * wiring guard (card renders dayBody, echoFor delegates to matchReminder,
 * five slotIso returns, the import rides).
 * Run: bunx vite-node scripts/unit239.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mod = await import('/src/components/notifications/NotificationsScreen.tsx');
const { matchReminder, reminderDayBody, groupNotificationsForFeed } = mod;
const { bookingDayTag, bookingSlotLabel } = await import('/src/lib/bookingday.ts');

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

/* The suite owns the clock: NOW = Sat 4 Oct 2026, 11:30 IST. */
const NOW = Date.parse('2026-10-04T06:00:00Z');
const TODAY_SLOT = '2026-10-04T14:00:00Z'; // 7:30 pm IST today
const YESTERDAY_SLOT = '2026-10-03T14:00:00Z'; // 7:30 pm IST yesterday

const res = (id, slot_at, status = 'cancelled') => ({
  id,
  tenant_id: 't1',
  location_id: null,
  guest_name: 'Maya Iyer',
  phone: '98765 43210',
  party_size: 2,
  table_id: 'tb1',
  slot_at,
  status,
  note: '',
  created_by_email: 'x@y.z',
  created_at: '2026-10-03T09:00:00Z',
  updated_at: '2026-10-03T09:00:00Z',
});
const bell = (over = {}) => ({
  id: 'n1',
  tenant_id: 't1',
  category: 'reminder',
  title: 'Booking today: Maya Iyer ×2',
  body: '7:30 pm — T1 — 98765 43210',
  is_read: false,
  link_to: 'floor',
  created_at: '2026-10-03T09:00:00Z',
  ...over,
});

/* 0 — the family words the fix rides on (fixture sanity, IST-anchored). */
assert.equal(bookingSlotLabel(YESTERDAY_SLOT), '7:30 pm', 'the frozen hour the body speaks');
assert.equal(bookingDayTag(YESTERDAY_SLOT), 'Sat 3 Oct', 'the booking clock day tag');
ok('booking voice family: slot hour + day tag');

/* 1 — the day tag speaks the BOOKING clock, not UTC: 18:45Z on 3 Oct is
 *    already 00:15 IST on 4 Oct — the tag must flip where UTC doesn't. */
assert.equal(bookingDayTag('2026-10-03T18:45:00Z'), 'Sun 4 Oct');
ok('bookingDayTag flips at the IST midnight, not UTC');

/* 2 — matchReminder: the echo's exact matcher, one definition. */
const book = [res('r1', YESTERDAY_SLOT)];
assert.equal(matchReminder(bell(), book)?.id, 'r1', 'exactly one match speaks');
assert.equal(matchReminder(bell(), []), null, 'zero matches: silence');
assert.equal(
  matchReminder(bell(), [res('r1', YESTERDAY_SLOT), res('r2', YESTERDAY_SLOT)]),
  null,
  'two identical promises: ambiguous, never a coin flip',
);
assert.equal(matchReminder(bell({ category: 'system' }), book), null, 'only reminders match');
assert.equal(matchReminder(bell(), null), null, 'an unread book never matches');
ok('matchReminder: exactly-one semantics');

/* 3 — the day voice: yesterday's match gains the day tag, byte-exact. */
const dayed = reminderDayBody(bell(), book, NOW);
assert.equal(dayed, 'Sat 3 Oct, 7:30 pm — T1 — 98765 43210');
ok('non-today match: the hour wears its day ("Sat 3 Oct, 7:30 pm — …")');

/* 4 — today's match keeps the frozen bytes (the trigger said today; it is). */
assert.equal(
  reminderDayBody(bell(), [res('r1', TODAY_SLOT)], NOW),
  '7:30 pm — T1 — 98765 43210',
  'a today row is byte-identical',
);
ok('today match: frozen bytes kept');

/* 5 — silence, never a guess: unmatched / ambiguous / null book / system
 *    rows all render the trigger's own words untouched. */
const raw = bell().body;
assert.equal(reminderDayBody(bell(), [], NOW), raw, 'no match → no day voice');
assert.equal(
  reminderDayBody(bell(), [res('r1', YESTERDAY_SLOT), res('r2', YESTERDAY_SLOT)], NOW),
  raw,
  'ambiguous → no day voice',
);
assert.equal(reminderDayBody(bell(), null, NOW), raw, 'unread book → no day voice');
assert.equal(reminderDayBody(bell({ category: 'system', title: 'Out of stock: Coffee beans' }), book, NOW), raw, 'non-reminder → no day voice');
ok('the day voice never guesses (four silences)');

/* 6 — THE ROUND GUARD on live copy (comment-blind, 233's lesson). */
const live = readFileSync(
  new URL('../src/components/notifications/NotificationsScreen.tsx', import.meta.url),
  'utf8',
);
const code = live
  .split('\n')
  .filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l))
  .join('\n');

assert.ok(code.includes('dayBody={reminderDayBody(n, reservations, nowMs)}'), 'the card is fed the day voice');
assert.ok(code.includes('{dayBody}'), 'the card renders the day voice');
assert.ok(code.includes('const r = matchReminder(n, reservations);'), 'echoFor delegates to the ONE matcher');
assert.equal((code.match(/slotIso: r\.slot_at/g) || []).length, 5, 'all five echo states carry the matched slot');
assert.ok(code.includes('bookingDayTag'), 'the day tag rides the booking clock family');
ok('live wiring: card, delegation, slot provenance, import');

/* 7 — the feed's day rhythm is untouched (unit198's contract). */
const groups = groupNotificationsForFeed([bell()], '2026-10-04', '2026-10-03');
assert.equal(groups.length, 1);
assert.equal(groups[0].label, 'Yesterday');
ok('groupNotificationsForFeed unchanged (198 holds)');

console.log(`\nunit239 — ${n} asserts, ALL GREEN`);
