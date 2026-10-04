/* Task 232 — v5.193.0 unit suite: the book dates the seat.
 * The camping clock (5.158.0) read ONE ledger — the round's placed-at —
 * so a seat the BOOK created (the host's Seat gesture, no ticket keyed
 * yet) sat undated forever: no chip, no camping pill, no word in the
 * header's longest-seat count. But the book remembers the flip: a
 * `seated` reservation row carries the trigger's own updated_at stamp —
 * a provable instant, not an invention. The doctrine amends to TWO
 * provable sources (round in hand; book's flip stamp), ONE clock (the
 * existing seatClockFor — no fork), same silence rule as ever: NEITHER
 * in hand → silence, never a number.
 * Asserted: newest-seated-row-wins (max taken explicitly), the flip's
 * stamp not the promise's (updated_at, NOT created_at), only seated rows
 * date the seat (booked/no_show/cancelled silent), table scoping, the
 * unread-book silences (null and undefined — 5.187's doctrine), the ONE-
 * arithmetic sweep (book clock's label AND camping === seatClockFor's on
 * the same stamp, 0–100h), the turn line riding turnAfterMin (89/90/91),
 * the clock-back clamp (future stamp → "just sat"), and the book chip's
 * sentence shape (bookSeatWords: the just-sat state stays bare, every
 * span wears "sat").
 * Run: bunx vite-node scripts/unit232.mjs
 */
import assert from 'node:assert/strict';

const floorM = await import('/src/components/floor/FloorScreen.tsx');
const { bookSeatClockFor, bookSeatWords, seatClockFor, seatLabelFor } = floorM;

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

/* The suite owns the clock — no run-hour literals (228's rule). */
const NOW = Date.parse('2026-10-04T12:00:00+05:30');
const agoIso = (msAgo) => new Date(NOW - msAgo).toISOString();
const MIN = 60_000, H = 60 * MIN;

const T1 = 'tbl-t1';
const row = (over) => ({ table_id: T1, status: 'seated', updated_at: agoIso(2 * H), ...over });

/* ── 1. the newest seated row wins — max taken explicitly, never the
 *       read order (229's discipline) ─────────────────────────────────── */
{
  const book = [
    row({ updated_at: agoIso(5 * H) }),
    row({ updated_at: agoIso(1 * H) }), // newer, LATER in the array
  ];
  const c = bookSeatClockFor(T1, book, NOW);
  assert.equal(c.label, seatLabelFor(60), 'newest seated row wins regardless of read order');
  assert.equal(c.camping, false, '1h seat is fresh — under the 90-min line');
  ok('the newest seated row wins — max taken explicitly');
}

/* ── 2. the FLIP's stamp, not the promise's: updated_at dates the seat;
 *       created_at dates the phone promise (a different truth) ───────── */
{
  const book = [
    row({ updated_at: agoIso(1 * H), created_at: agoIso(72 * H) }),
  ];
  const c = bookSeatClockFor(T1, book, NOW);
  assert.equal(c.label, '1h 0m', 'the clock reads the flip (updated_at), not the promise');
  assert.notEqual(c.label, '3d 0h', 'the promise\'s age is NOT the seat\'s age');
  ok('the book\'s flip stamp — updated_at, never created_at');
}

/* ── 3. only SEATED rows date the seat — every other status is silent ── */
{
  for (const status of ['booked', 'no_show', 'cancelled']) {
    const c = bookSeatClockFor(T1, [row({ status })], NOW);
    assert.equal(c, null, `${status} rows hold no seat clock`);
  }
  ok('booked / no_show / cancelled stay silent — only seated dates the seat');
}

/* ── 4. table scoping: another table's seated row is not this seat ───── */
{
  const book = [row({ table_id: 'tbl-other' })];
  assert.equal(bookSeatClockFor(T1, book, NOW), null, 'another table\'s row is not this seat');
  assert.equal(bookSeatClockFor(T1, [row({ table_id: null })], NOW), null, 'untabled rows pin nowhere');
  ok('the clock scopes to the table — other tables\' and untyped rows stay out');
}

/* ── 5. the unread book stays silent — null AND undefined (5.187's
 *       doctrine: silence is not zero, and never an invented number) ─── */
{
  assert.equal(bookSeatClockFor(T1, null, NOW), null, 'unread book → silence');
  assert.equal(bookSeatClockFor(T1, undefined, NOW), null, 'missing book → silence');
  assert.equal(bookSeatClockFor(T1, [], NOW), null, 'empty book → silence (no row, no claim)');
  ok('the unread / empty book never invents a seat');
}

/* ── 6. the ONE-arithmetic sweep: the book's clock IS seatClockFor's —
 *       label AND camping agree on every stamp 0–100h (no fork) ──────── */
{
  const stamps = [0, 30 * MIN, 89 * MIN, 90 * MIN, 91 * MIN, 5 * H, 47 * H + 2 * MIN, 100 * H];
  for (const msAgo of stamps) {
    const iso = agoIso(msAgo);
    const book = bookSeatClockFor(T1, [row({ updated_at: iso })], NOW);
    const ticket = seatClockFor(iso, NOW);
    assert.equal(book.label, ticket.label, `label fork at ${msAgo / MIN}m`);
    assert.equal(book.camping, ticket.camping, `camping fork at ${msAgo / MIN}m`);
  }
  ok('sweep 0–100h: book clock === ticket clock, label AND camping');
}

/* ── 7. the house turn line rides the argument — the 5.160.0 rule ────── */
{
  const book = [row({ updated_at: agoIso(90 * MIN) })];
  assert.equal(bookSeatClockFor(T1, book, NOW, 90).camping, true, 'at the line = camping (90)');
  assert.equal(bookSeatClockFor(T1, [row({ updated_at: agoIso(89 * MIN) })], NOW, 90).camping, false, 'under the line = fresh (89)');
  assert.equal(bookSeatClockFor(T1, [row({ updated_at: agoIso(89 * MIN) })], NOW, 60).camping, true, 'a stricter house line fires earlier (60)');
  ok('the turn line is the house\'s own number at every call site');
}

/* ── 8. the clock-back clamp: a future stamp is "just sat", never a
 *       negative span (chaseAge's own clamp, carried) ─────────────────── */
{
  const future = new Date(NOW + 3 * H).toISOString();
  const c = bookSeatClockFor(T1, [row({ updated_at: future })], NOW);
  assert.equal(c.minutes, 0, 'future stamp clamps to zero');
  assert.equal(c.label, 'just sat', 'a seat that just sat is a state, not a span');
  assert.equal(c.camping, false, 'just sat is not camping');
  ok('the clock-back clamp rides — future stamps say "just sat"');
}

/* ── 9. the book chip's sentence shape — ONE shape, both surfaces ────── */
{
  assert.equal(bookSeatWords('just sat'), 'just sat', 'the just-sat state stays bare — "sat just sat" is broken English');
  assert.equal(bookSeatWords('45m'), 'sat 45m', 'spans wear "sat"');
  assert.equal(bookSeatWords('1h 30m'), 'sat 1h 30m', 'hour spans wear "sat"');
  assert.equal(bookSeatWords('47h 2m'), 'sat 47h 2m', 'day+ spans wear "sat"');
  ok('bookSeatWords: one sentence shape, just-sat bare');
}

/* ── 10. the pill parity: the book's camping pill reads EXACTLY like the
 *        ticket's — "sat {label} — camping" — with the book's glyph ──── */
{
  const c = bookSeatClockFor(T1, [row({ updated_at: agoIso(120 * MIN) })], NOW);
  assert.equal(`${bookSeatWords(c.label)} — camping`, `sat ${seatLabelFor(120)} — camping`, 'the book pill matches the ticket pill word for word');
  assert.equal(seatLabelFor(120), '2h 0m', 'the register is the floor\'s own span voice');
  ok('pill parity: the book pill is the ticket pill\'s twin (glyph aside)');
}

console.log(`\nunit232 — ${n} asserts, all green.`);
