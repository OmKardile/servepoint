/* Task 267 — v5.228.0 unit suite: the quiet line remembers its last ticket.
 *
 * The Kitchen context line's quiet branch said "Quiet service — no active
 * tickets" and stopped — a quiet board is two different stories (the day
 * passed through and the rail is empty again, or the day has not reached
 * the kitchen yet), and the line could not tell them apart. A cook opening
 * the pass at 9:47 am with zero tickets reads the same words as one at
 * 9:47 pm after a full day. v5.228.0 gives the quiet line a memory:
 *
 * 1. lastRailTicketAt (exported pure, beside isOnRail — the rail-active
 *    set's own home): the LATEST created_at among today's LANDED tickets —
 *    isOnRail's three active stages + the pass's `completed` column +
 *    `cancelled` (a cancelled ticket did land; the line's cancelledToday
 *    clause already tells that story, so cancelledToday > 0 must force a
 *    stamp — the two clauses can never disagree). The counter inbox's
 *    `new` never landed: the Dashboard's NEEDS YOU NOW owns that voice.
 *    The caller passes the day grammar (isSameLocalDay) — one day, one
 *    derivation, the same bounds law the floor's week split obeys (5.226).
 *    Null when the kitchen has seen nothing today — the line says so in
 *    its own words, silence is still never a zero.
 * 2. The quiet branch speaks: "· last ticket HH:MM" (hhmm — the bare local
 *    clock the whole app already speaks) when a stamp exists, "· nothing
 *    yet today" when it does not; the cancelled clause follows both. The
 *    ACTIVE branch keeps its bytes byte-identical — the oldest-wait voice
 *    was never the thin one.
 *
 * Asserted: the lib grammar (latest-not-first, inbox excluded, cancelled
 * + completed included, other-day excluded, null on nothing-landed, case
 * blindness, input purity); the coherence law (cancelled-only day still
 * stamps); the KitchenScreen wiring (the memo passes isSameLocalDay, the
 * quiet branch's two clauses, the ACTIVE branch's preserved bytes, hhmm
 * from lib/day, no new timer — the two intervals stand, isOnRail
 * untouched).
 * Run: bunx vite-node scripts/unit267.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const kitchen = await import('/src/components/kitchen/KitchenScreen.tsx');
const { lastRailTicketAt, isOnRail } = kitchen;

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);
const strip = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

/* The suite owns the clock through the INJECTED grammar — the same seam
 * the screen's real call site passes isSameLocalDay through (pinned, so
 * UTC midnight can never collect the debt — the 5.202 law). */
const TODAY = '2026-10-05';
const sameDay = (iso) => String(iso).startsWith(TODAY);
const at = (hh, mm) => `${TODAY}T${hh}:${mm}:00+05:30`;

const row = (id, created_at, status) => ({ id, created_at, status });

/* 1 — the LATEST landed ticket, not the first the array happens to hold. */
const latest = lastRailTicketAt(
  [
    row('a', at('08:05'), 'completed'),
    row('b', at('14:22'), 'cancelled'),
    row('c', at('11:00'), 'ready'),
  ],
  sameDay
);
assert.equal(latest, at('14:22'));
ok('lastRailTicketAt: the LATEST landed created_at wins (14:22, out of order)');

/* 2 — the counter inbox's `new` never landed, even when it is the newest
 * of the day: the Dashboard's NEEDS YOU NOW owns that voice. */
assert.equal(
  lastRailTicketAt(
    [row('a', at('08:05'), 'completed'), row('b', at('15:00'), 'new')],
    sameDay
  ),
  at('08:05')
);
ok("lastRailTicketAt: inbox 'new' excluded even when newest of the day");

/* 3 — completed counts (the pass's own column) and cancelled counts (a
 * cancelled ticket did land). */
assert.equal(
  lastRailTicketAt(
    [row('a', at('09:00'), 'pending'), row('b', at('12:30'), 'completed')],
    sameDay
  ),
  at('12:30')
);
ok("lastRailTicketAt: the pass's `completed` column counts as landed");

assert.equal(
  lastRailTicketAt([row('a', at('10:15'), 'cancelled')], sameDay),
  at('10:15')
);
ok('lastRailTicketAt: a cancelled ticket did land — the stamp exists');

/* 4 — THE COHERENCE LAW: the line's cancelledToday clause and the stamp
 * can never disagree. A cancelled-only day stamps, so "N cancelled today"
 * and "nothing yet today" can never render together. */
const coh = lastRailTicketAt(
  [row('a', at('07:40'), 'cancelled'), row('b', at('08:10'), 'cancelled')],
  sameDay
);
assert.equal(coh, at('08:10'));
assert.ok(coh !== null);
ok('coherence: cancelledToday > 0 forces a stamp — the clauses never disagree');

/* 5 — other-day rows are the caller's grammar to exclude: the suite's
 * pinned sameDay keeps a yesterday ticket silent even when it is the
 * newest ISO in the array. */
assert.equal(
  lastRailTicketAt(
    [
      row('a', at('09:00'), 'completed'),
      row('b', '2026-10-04T21:00:00+05:30', 'completed'),
    ],
    sameDay
  ),
  at('09:00')
);
ok('lastRailTicketAt: other-day rows excluded (the injected day grammar)');

/* 6 — nothing landed today → null (the line's "nothing yet today" voice;
 * silence is never a zero, never an invented stamp). */
assert.equal(lastRailTicketAt([], sameDay), null);
assert.equal(lastRailTicketAt([row('a', at('06:00'), 'new')], sameDay), null);
assert.equal(
  lastRailTicketAt([row('a', '2026-10-04T21:00:00+05:30', 'ready')], sameDay),
  null
);
ok('lastRailTicketAt: nothing landed today → null (never a zero, never invented)');

/* 7 — case blindness, matching isOnRail's own contract. */
assert.equal(
  lastRailTicketAt([row('a', at('13:45'), 'COMPLETED')], sameDay),
  at('13:45')
);
assert.equal(
  lastRailTicketAt([row('a', at('13:45'), 'CANCELLED')], sameDay),
  at('13:45')
);
ok("lastRailTicketAt: 'COMPLETED'/'CANCELLED' case-blind (isOnRail's contract)");

/* 8 — purity: the input array and its rows are untouched. */
const input = [row('a', at('08:05'), 'completed'), row('b', at('09:30'), 'new')];
const snapshot = JSON.stringify(input);
lastRailTicketAt(input, sameDay);
assert.equal(JSON.stringify(input), snapshot);
ok('lastRailTicketAt: pure — the input is untouched');

/* 9 — the ACTIVE rail set is untouched: isOnRail keeps its exact three
 * states (the Dashboard's stuck counts and Bills' ghost chip read THIS —
 * one set, no fork, the 5.235 law that named it). */
assert.equal(isOnRail('pending'), true);
assert.equal(isOnRail('preparing'), true);
assert.equal(isOnRail('ready'), true);
assert.equal(isOnRail('completed'), false);
assert.equal(isOnRail('cancelled'), false);
assert.equal(isOnRail('new'), false);
ok("isOnRail untouched: pending/preparing/ready only — 'new'/completed/cancelled out");

/* ── source pins — the wiring cannot lie ── */
const src = strip('../src/components/kitchen/KitchenScreen.tsx');

/* 10 — the memo passes the day grammar at the call site (the bounds law:
 * the split can never draw a different day than the counts it sits
 * beside — here, than the cancelledToday clause beside it). */
assert.ok(
  src.includes('lastTicketAt: lastRailTicketAt(orders, isSameLocalDay),'),
  'the memo wires lastRailTicketAt(orders, isSameLocalDay)'
);
ok('memo wiring: lastRailTicketAt(orders, isSameLocalDay) — one day grammar');

/* 11 — the quiet branch's memory clause, exact bytes. */
assert.ok(
  src.includes("{board.lastTicketAt\n              ? ` · last ticket ${hhmm(board.lastTicketAt)}`\n              : ' · nothing yet today'}"),
  'the quiet branch speaks last ticket / nothing yet today'
);
ok("quiet branch: '· last ticket HH:MM' or '· nothing yet today', exact bytes");

/* 12 — the cancelled clause follows BOTH branches of the memory (it sits
 * after the ternary, unguarded by it). */
const quietBlock = src.slice(src.indexOf('Quiet service — no active tickets'));
assert.ok(
  quietBlock.indexOf("cancelledToday > 0 ? ` · ${board.cancelledToday} cancelled today`") >
    quietBlock.indexOf("nothing yet today"),
  'the cancelled clause follows the memory clause'
);
ok('clause order: memory first, the cancelled clause follows unguarded');

/* 13 — the ACTIVE branch keeps its bytes byte-identical (the 5.227 law:
 * the branch that was never thin keeps its voice untouched). */
assert.ok(
  src.includes('Oldest active ticket waiting'),
  'the active branch headline survives'
);
assert.ok(
  src.includes('{board.cancelledToday > 0 && <> · {board.cancelledToday} cancelled today (off rail)</>}'),
  'the active branch cancelled clause survives byte-identical'
);
ok('active branch: byte-identical — oldestWait + (off rail) untouched');

/* 14 — hhmm comes from lib/day: the bare local clock the whole app
 * already speaks — no second formatter born here. */
assert.ok(
  src.includes("import { hhmm, isSameLocalDay } from '../../lib/day';"),
  'hhmm imported from lib/day'
);
ok('clock: hhmm from lib/day — one formatter, the app\u2019s own clock');

/* 15 — no new timer: the stamp is derived in the existing memo from the
 * orders the screen already holds; the two intervals stand. */
const timers = src.match(/setInterval/g) || [];
assert.equal(timers.length, 2, 'setInterval count stands at 2 (heartbeat + poll)');
ok('no new timer: a stamp, not a duration — the two intervals stand');

console.log(`\nunit267 — ${n} checks green`);
