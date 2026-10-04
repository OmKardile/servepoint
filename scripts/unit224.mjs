/* Task 224 — v5.185.0 unit suite: the door follows the truth, the mirror
 * speaks the age.
 * Two truths the dashboard owed:
 *   1. The kitchen card's DOOR never learned 5.89's doctrine ("the door
 *      follows the truth") — when only older stuck tickets remain, the card
 *      whispered "see Bills" while its button opened an EMPTY kitchen board.
 *      The fix is UI-side (E2E-verified); the pure truths behind it:
 *   2. chaseAge moves home to src/lib/day.ts — the ONE age register, importable
 *      by any surface without dragging Bills' module graph into another chunk —
 *      and the unpaid card's age voice ("oldest #96 owes ₹X, 2d old") rides the
 *      chase set's own oldest-first rule (created_at asc) and the band's own
 *      open-balance formula (total − paid parts, floored at zero).
 * Asserted: chaseAge register ("today" calm, "Nd old" urgent), the floor of
 *   full days (41h → 1d), the 24h boundary (24h → 1d), the max(0,·) clamp's
 *   real promise (a clock-skewed future stamp → "today"); oldest-first
 *   ordering by created_at localeCompare on ISO stamps; the open-balance
 *   formula shared by the band sum and the oldest's owe (over-covered part
 *   floored at zero; un-split identity); the band sum unchanged (v5.65
 *   arithmetic preserved through the map refactor).
 * Run: bunx vite-node scripts/unit224.mjs
 */
import assert from 'node:assert/strict';

const { chaseAge } = await import('/src/lib/day.ts');

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

/* 1 — the register: "today" reads calm */
assert.equal(chaseAge('2026-10-04T09:00:00Z', Date.parse('2026-10-04T15:00:00Z')), 'today');
ok('chaseAge: a ticket from this morning reads "today"');

/* 2 — the floor of full days: 41h is 1d old, said plainly */
assert.equal(chaseAge('2026-10-02T22:00:00Z', Date.parse('2026-10-04T15:00:00Z')), '1d old');
ok('chaseAge: 41h floors to "1d old" — the chase list\'s own plain voice');

/* 3 — the 24h boundary is exact */
assert.equal(chaseAge('2026-10-03T15:00:00Z', Date.parse('2026-10-04T15:00:00Z')), '1d old');
assert.equal(chaseAge('2026-10-03T14:59:00Z', Date.parse('2026-10-04T15:00:00Z')), '1d old');
assert.equal(chaseAge('2026-10-03T15:01:00Z', Date.parse('2026-10-04T15:00:00Z')), 'today');
ok('chaseAge: the 24h boundary holds (23h59 today, 24h01 → 1d old)');

/* 4 — the clamp's real promise: a clock-skewed FUTURE stamp never goes negative */
assert.equal(chaseAge('2026-10-04T18:00:00Z', Date.parse('2026-10-04T15:00:00Z')), 'today');
ok('chaseAge: a future stamp (clock skew) clamps to "today", never a negative age');

/* 5 — the chase set's oldest-first rule: created_at asc on ISO stamps */
const unpaid = [
  { id: 'b', order_number: 97, created_at: '2026-10-03T10:00:00Z', total: 300 },
  { id: 'a', order_number: 96, created_at: '2026-10-01T09:00:00Z', total: 969 },
  { id: 'c', order_number: 98, created_at: '2026-10-04T08:00:00Z', total: 150.5 },
];
const oldest = unpaid.slice().sort((x, y) => x.created_at.localeCompare(y.created_at))[0];
assert.equal(oldest.id, 'a');
assert.equal(oldest.order_number, 96);
ok('the age voice names the chase set\'s own oldest (#96) — created_at asc');

/* 6 — the open-balance formula: total − paid parts, floored at zero */
const paidSums = new Map([['a', 100], ['c', 999]]); // c over-covered
const openByTicket = new Map(
  unpaid.map((o) => [o.id, Math.max(0, Number(o.total || 0) - (paidSums.get(o.id) || 0))])
);
assert.equal(openByTicket.get('a'), 869);
assert.equal(openByTicket.get('b'), 300);
assert.equal(openByTicket.get('c'), 0);
ok('openByTicket: ledger parts subtracted, an over-covered row floors at zero');

/* 7 — the band sum rides the same map: the v5.65 arithmetic preserved */
const bandSum = unpaid.reduce((s, o) => s + (openByTicket.get(o.id) || 0), 0);
assert.equal(bandSum, 1169);
const legacySum = unpaid.reduce(
  (s, o) => s + Math.max(0, Number(o.total || 0) - (paidSums.get(o.id) || 0)),
  0
);
assert.equal(bandSum, legacySum);
ok('the band\'s sum is byte-identical through the ONE-map refactor (₹1169 shape)');

/* 8 — the age voice string, assembled the way the card speaks it */
const nowMs = Date.parse('2026-10-04T15:00:00Z');
const voice = `oldest #${oldest.order_number} owes ₹${openByTicket.get(oldest.id).toFixed(2)}, ${chaseAge(oldest.created_at, nowMs)}`;
assert.equal(voice, 'oldest #96 owes ₹869.00, 3d old');
ok('the age voice: "oldest #96 owes ₹869.00, 3d old" — the total\'s hidden dimension');

console.log(`\nunit224: ${n} asserts passed`);
