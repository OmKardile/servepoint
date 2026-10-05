/* Task 262 — v5.223.0 unit suite: the book's count keeps its own verdicts,
 * and the rhythm counts the looks.
 *
 * Two lies and a gap, one round:
 *
 * 1. THE BOOK HEADER LIED LIVE. The header's "N still expected today" was a
 *    status-count (status === 'booked' today) computed inside the book memo
 *    — but a went-quiet party STAYS 'booked'; its row badge flips to "went
 *    quiet" on the promise clock while the header kept saying "still
 *    expected" until the next fetch (261's E2E caught the band mid-flip;
 *    this header held the same stale lie for weeks). The count now follows
 *    the book's OWN verdicts: expected = the promised hour has not passed,
 *    quiet = it has — computed at render beside the row badges' clock
 *    (rowNowMs), one pass, one verdict. The quiet debt speaks its own words
 *    in the book's grey with the badge's own title; a status-count the rows
 *    contradict is retired (the memo's bookedToday is gone).
 * 2. THE RHYTHM NEVER COUNTED THE LOOKS. The strip speaks seated rounds
 *    (the work) but never menu windows (the looks) — the owner reading
 *    "20 seated rounds" cannot see how many scans opened a window at all.
 *    A fifth tile, "Menu windows · 7d", counts the session rows inside the
 *    SAME bounds the seated-rounds census draws (lib/tableSession's
 *    sessionsInWindow — the look count and the work count can never draw
 *    from different weeks); compare mode deltas the prior week in the
 *    seated-rounds tile's own grammar; and the all-lookers case — scans
 *    with zero tickets — is named in the empty state instead of leaving
 *    the week's windows uncounted.
 *
 * Asserted: the lib count (bounds semantics — start inclusive, end
 * exclusive; empty silence; noise skipped; disjoint windows partition the
 * ledger; purity); the Floor wiring (lib import, the memo's same-bounds
 * reads, the tile bytes + tooltip + grid-cols-5 + compare grammar, the
 * empty-state honesty, no new timer); the book header (bookedToday
 * retired everywhere, the render-time split beside rowNowMs, the row
 * badge's own boundary complemented, the grey words + title + conditional
 * today tail, the gold phrase byte-identical when all is well).
 * Run: bunx vite-node scripts/unit262.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (s) => { n++; console.log(`  ✓ ${s}`); };
const strip = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

/* ── 1. The lib — the look count inside honest bounds ── */

const ts = await import('/src/lib/tableSession.ts');
const { sessionsInWindow } = ts;

assert.equal(typeof sessionsInWindow, 'function', 'sessionsInWindow lives in the session lib');
ok('sessionsInWindow has its home in lib/tableSession');

const S = 1_000_000; // window start
const E = 9_000_000; // window end

// empty ledger → silence
assert.equal(sessionsInWindow([], S, E), 0, 'an empty ledger counts nothing');
ok('an empty ledger reads zero — the count is silence by shape');

// the bounds: start inclusive, end exclusive — the census's own convention
const ledger = [
  { created_at: new Date(S).toISOString() }, // at start — IN
  { created_at: new Date(S + 1).toISOString() }, // inside — IN
  { created_at: new Date(E - 1).toISOString() }, // just before end — IN
  { created_at: new Date(E).toISOString() }, // AT end — OUT
  { created_at: new Date(S - 1).toISOString() }, // just before start — OUT
];
assert.equal(sessionsInWindow(ledger, S, E), 3, '[start, end) — inclusive start, exclusive end');
ok('the bounds are the census\'s own [start, end) — no fencepost drift');

// unreadable instants are ledger noise
assert.equal(sessionsInWindow([{ created_at: 'not-a-date' }, { created_at: '' }], S, E), 0,
  'noise is skipped, never counted');
ok('an unreadable instant is noise, not a window');

// disjoint windows partition the ledger (current + prior never double-count)
const all = [S + 1, E + 1, E + 2].map((t) => ({ created_at: new Date(t).toISOString() }));
const cur = sessionsInWindow(all, S, E);
const pri = sessionsInWindow(all, E, E * 2);
assert.equal(cur + pri, 3, 'disjoint windows partition the ledger');
assert.equal(cur, 1, 'one in the current window');
ok('current and prior windows partition — the delta draws from one ledger');

// purity: the same read twice yields the same count, input untouched
assert.equal(sessionsInWindow(all, S, E), cur, 'the derivation is pure');
ok('a fresh count every call — no shared state');

/* ── 2. The Floor wiring — the tile beside the work ── */

const floor = strip('../src/components/floor/FloorScreen.tsx');

assert.ok(floor.includes('sessionsInWindow,') || floor.includes('sessionsInWindow }'),
  'the Floor imports the lib count');
assert.ok(!/\bfunction sessionsInWindow\b/.test(floor), 'no local copy was born');
assert.ok(floor.includes('count: sessionsInWindow(sessions, startMs, endMs),'),
  'the current week reads the SAME bounds the seated-rounds census draws');
assert.ok(floor.includes('prev: sessionsInWindow(sessions, prevStartMs, startMs),'),
  'the prior week reads the same window one step back');
assert.ok(floor.includes("}, [sessions]);"), 'the census recomputes only on the session ledger');
ok('the FloorScreen wiring: lib import, same bounds, one memo');

// the tile
assert.ok(floor.includes('>Menu windows · 7d</p>'), 'the tile speaks the look count\'s own name');
assert.ok(floor.includes('{windowCensus.count}'), 'the value is the lib count');
assert.ok(floor.includes('md:grid-cols-5'), 'the grid holds five tiles on wide screens');
assert.ok(floor.includes('the raw look count, before any of it became a ticket'),
  'the tooltip tells the honest story');
assert.ok(floor.includes('const delta = windowCensus.count - windowCensus.prev;'), 'compare mode deltas the prior week');
assert.ok(floor.includes('no prior-week windows in the loaded ledger yet'),
  'an empty prior week degrades honestly, never a fake delta');
ok('the rhythm tile: name, value, grid, tooltip, compare grammar');

// the empty state names the all-lookers week
assert.ok(floor.includes('none became a ticket yet'), 'the all-lookers case speaks in the empty state');
assert.ok(floor.includes('{windowCensus.count > 0 && ('), 'the empty-state line keeps the silence rule');
ok('the empty state counts the looks when the work never came');

// no new timer — the heartbeat stays the only cadence
const intervals = floor.split('window.setInterval(').length - 1;
assert.equal(intervals, 4, 'the heartbeat count is unchanged (4)');
ok('no new timer — the look count rides renders, not clocks');

/* ── 3. The book header — the count keeps the book's own verdicts ── */

assert.ok(!floor.includes('book.bookedToday') && !floor.includes('const bookedToday ='),
  'the stale status-count is retired (its field and its memo const — the Rows var is the new read)');
assert.ok(floor.includes("const bookedTodayRows = (reservations ?? []).filter("),
  'today\'s booked rows are read at render, not in the memo');
assert.ok(floor.includes("new Date(r.slot_at).getTime() >= rowNowMs").valueOf(),
  'expected = the promised hour has not passed — the row badge\'s boundary complemented');
assert.ok(floor.includes('const quietToday = bookedTodayRows.length - expectedToday;'),
  'the quiet debt is the complement — one read, no second predicate');
assert.ok(floor.includes('rowNowMs = Date.now()'),
  'the split shares the row badges\' own clock — one pass, one verdict');

// the words
assert.ok(floor.includes('{expectedToday} still expected today</span>'),
  'the gold phrase stands byte-identical when all is well');
assert.ok(floor.includes("font-bold text-[#6B6B6B]\""),
  'the quiet debt speaks in the book\'s grey');
assert.ok(floor.includes('{quietToday} went quiet{expectedToday === 0 ? \' today\' : \'\'}'),
  'the quiet words carry "today" only when no expectation remains');
assert.ok(floor.includes('Seat them or mark the no-show; the clock does not convict.'),
  'the quiet span wears the badge\'s own title — the clock does not convict');
ok('the header\'s words follow the book\'s verdicts, not the status ledger');

console.log(`\nunit262 — ${n} checks green`);
