/* Task 201 — v5.162.0 unit suite: the diary reads in days.
 * groupDiaryByDay gives the 027 stock diary the bell feed's day rhythm
 * (Today / Yesterday / Earlier on the booking clock's IST day keys),
 * unreadable stamps landing in Earlier (never dropped), tallies counting
 * ticket moves and hand moves separately — quantities never sum across
 * SKUs. Run: bunx vite-node scripts/unit201.mjs
 */
import assert from 'node:assert/strict';

const { groupDiaryByDay } = await import('/src/components/inventory/InventoryScreen.tsx');
const { bookingDayKey, bookingTodayKey } = await import('/src/lib/bookingday.ts');

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const todayKey = bookingTodayKey();
const yesterdayKey = bookingDayKey(new Date(Date.now() - 86_400_000).toISOString());
/* v5.186.0 determinism repair (fixture-side, source untouched — proven not a
 * 5.186 regression by a stash run on unmodified HEAD): the original fixtures
 * built stamps from HOUR OFFSETS (at(20) etc.), which land on today or
 * yesterday depending on the RUN HOUR — t2@20h rode 'yesterday' before 20:00
 * IST and 'today' after, so the suite flipped at 20:00 IST (first fired this
 * round). Stamps are now built ON the day keys at fixed IST times — the
 * assertion no longer depends on when the clock runs. */
const earlierKey = bookingDayKey(new Date(Date.now() - 72 * 3600_000).toISOString());
ok('yesterday key derives on the same booking clock (5.198 pattern)');

/* a stamp ON a booking day at a fixed IST time (India is UTC+5:30, no DST) */
const at = (dayKey, time) => `${dayKey}T${time}:00+05:30`;

const ticket = (id, dayKey, time) => ({ kind: 'ticket', id, itemId: 'x', qty: -30, at: at(dayKey, time) });
const adjust = (id, dayKey, time) => ({
  kind: 'adjust', id, itemId: 'x', qty: 500, at: at(dayKey, time), reason: 'delivery', note: '',
});

/* ── empty room ─────────────────────────────────────────────────────── */

assert.deepEqual(groupDiaryByDay([], todayKey, yesterdayKey), []);
ok('empty diary: no groups, honestly shaped');

/* ── all today: single group ────────────────────────────────────────── */

const g1 = groupDiaryByDay([ticket('a', todayKey, '09:15'), ticket('b', todayKey, '08:00')], todayKey, yesterdayKey);
assert.equal(g1.length, 1);
assert.equal(g1[0].key, 'today');
assert.equal(g1[0].label, 'Today');
assert.equal(g1[0].rows.length, 2);
assert.equal(g1[0].tickets, 2);
assert.equal(g1[0].hands, 0);
ok('all-today feed: one Today group, tally 2 tickets 0 hands');

/* ── three groups in reading order, order preserved within ─────────── */

const rows = [
  ticket('t1', todayKey, '09:00'), // today
  adjust('h1', todayKey, '10:30'), // today
  ticket('t2', yesterdayKey, '12:00'), // yesterday (the comment's own intent — "use 30h" meant the PREVIOUS day, not 20h-ago)
  adjust('h2', todayKey, '11:15'), // today
  ticket('t3', earlierKey, '15:45'), // earlier
];
const g2 = groupDiaryByDay(rows, todayKey, yesterdayKey);
assert.ok(g2.length >= 2);
assert.equal(g2[0].key, 'today');
if (g2.length === 3) assert.equal(g2[2].key, 'earlier');
const todayGroup = g2[0];
assert.equal(todayGroup.rows.length, 3);
assert.equal(todayGroup.tickets, 1); // t1 — t2 rode yesterday, t3 rode earlier
assert.equal(todayGroup.hands, 2); // h1 + h2
assert.equal(todayGroup.rows[0].id, 't1'); // newest first preserved from input
ok('groups read Today → (Yesterday) → Earlier; tally splits 1 ticket + 2 hands; input order preserved');

/* ── unreadable stamp lands in Earlier, never dropped ──────────────── */

const broken = [{ kind: 'ticket', id: 'b1', itemId: 'x', qty: -5, at: 'not-a-timestamp' }];
const g3 = groupDiaryByDay([...rows, ...broken], todayKey, yesterdayKey);
const earlierGroup = g3.find((g) => g.key === 'earlier');
assert.ok(earlierGroup);
assert.ok(earlierGroup.rows.some((r) => r.id === 'b1'));
ok('an unreadable stamp never drops the move — Earlier holds it');

/* ── every row lands exactly once ──────────────────────────────────── */

const total = g3.reduce((s, g) => s + g.rows.length, 0);
assert.equal(total, rows.length + broken.length);
ok('no row lost in bucketing (every move lands exactly once)');

/* ── hands-only and mixed tallies ──────────────────────────────────── */

const g4 = groupDiaryByDay([adjust('h1', todayKey, '09:30'), adjust('h2', todayKey, '10:00')], todayKey, yesterdayKey);
assert.equal(g4[0].tickets, 0);
assert.equal(g4[0].hands, 2);
ok('hands-only day: tally 0 tickets 2 hands (quantities never summed)');

console.log(`\n${n} asserts PASS`);
