/* Task 235 — v5.196.0 unit suite: the ghost wears its name.
 * The dashboard's strip counts "older stuck tickets off today's board —
 * see Bills", but Bills never said "stuck": the trio model shows the
 * PAYMENT word (Active/Paid), so a paid-but-never-bumped ticket read
 * settled and the pointer died at the door. Worse, the dashboard's own
 * file forked: staleKitchen counted ['pending','preparing'] while its
 * oldest-wait clock ran ['pending','preparing','ready'] — two answers
 * to one question in one file. isOnRail (exported from the kitchen
 * screen, THE rail-active set) closes the fork; isGhostTicket +
 * ghostChipWords (exported from Bills, the surface the pointer names)
 * put the dashboard's word on the ghost; day.ts grows
 * isSameLocalDayAs(iso, nowMs) so the suite owns the clock (228).
 * Asserted: isOnRail truth table (incl. case + the counter-inbox
 * 'new' + done states → false); isSameLocalDayAs explicit-clock
 * agreement with the bare form on real now; isGhostTicket population
 * (older rail-active true, today's rail-active false, older
 * new/completed/cancelled false); ghostChipWords (paid ghost carries
 * the age "stuck 2d old", unpaid ghost just "stuck"); THE ONE-
 * POPULATION GUARD — Bills' chip condition and the dashboard's
 * staleKitchen condition agree ticket-by-ticket on a mixed fixture;
 * THE ROUND GUARD — the inline two-state arrays gone from the
 * dashboard's live copy (comment-blind, 233's lesson), the ghost
 * wiring present in Bills.
 * Run: bunx vite-node scripts/unit235.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const kitchen = await import('/src/components/kitchen/KitchenScreen.tsx');
const { isOnRail } = kitchen;
const bills = await import('/src/components/bills/BillsScreen.tsx');
const { isGhostTicket, ghostChipWords } = bills;
const day = await import('/src/lib/day.ts');
const { isSameLocalDayAs, isSameLocalDay, chaseAge } = day;

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

/* The suite owns the clock — a fixed NOW, fixtures derived from it. */
const NOW = Date.UTC(2026, 9, 4, 17, 30, 0); // 4 Oct 2026, fixed
const ago = (ms) => new Date(NOW - ms).toISOString();
const H = 3600_000;
const D = 24 * H;

/* 1 — isOnRail: THE rail-active set. */
assert.equal(isOnRail('pending'), true);
assert.equal(isOnRail('preparing'), true);
assert.equal(isOnRail('ready'), true);
assert.equal(isOnRail('PREPARING'), true);
ok('isOnRail: pending/preparing/ready → true (case-insensitive)');

assert.equal(isOnRail('new'), false); // the counter inbox's — the rail never sees it
assert.equal(isOnRail('completed'), false);
assert.equal(isOnRail('cancelled'), false);
assert.equal(isOnRail('served'), false);
assert.equal(isOnRail(''), false);
assert.equal(isOnRail(null), false);
ok("isOnRail: inbox 'new' + done states → false (silence, never invented)");

/* 2 — the explicit-clock day test agrees with the bare form on real now. */
const realIso = new Date(Date.now() - 2 * D).toISOString();
assert.equal(isSameLocalDayAs(realIso, Date.now()), isSameLocalDay(realIso));
assert.equal(isSameLocalDayAs(new Date(NOW).toISOString(), NOW), true);
assert.equal(isSameLocalDayAs(ago(2 * D), NOW), false);
ok('isSameLocalDayAs(iso, nowMs): delegates on real now, deterministic on a fixed clock');

/* 3 — the ghost population: older rail-active, and ONLY that. */
assert.equal(isGhostTicket({ status: 'preparing', created_at: ago(2 * D) }, NOW), true);
assert.equal(isGhostTicket({ status: 'pending', created_at: ago(3 * D) }, NOW), true);
assert.equal(isGhostTicket({ status: 'ready', created_at: ago(2 * D) }, NOW), true);
ok('ghost: older pending/preparing/ready → true (ready no longer invisible)');

assert.equal(isGhostTicket({ status: 'preparing', created_at: ago(2 * H) }, NOW), false);
assert.equal(isGhostTicket({ status: 'new', created_at: ago(2 * D) }, NOW), false);
assert.equal(isGhostTicket({ status: 'completed', created_at: ago(2 * D) }, NOW), false);
assert.equal(isGhostTicket({ status: 'cancelled', created_at: ago(2 * D) }, NOW), false);
ok('ghost: today rail-active, older inbox/completed/cancelled → false');

/* 4 — the chip's words: two registers, no duplicated age. */
const paid = ghostChipWords('paid', ago(2 * D), NOW);
assert.equal(paid, `stuck ${chaseAge(ago(2 * D), NOW)}`);
assert.match(paid, /^stuck \d+d old$/);
ok('paid ghost: the chip carries the age — "stuck 2d old" (nothing else on the row speaks it)');

assert.equal(ghostChipWords('active', ago(2 * D), NOW), 'stuck');
ok('unpaid ghost: just "stuck" — the chase chip beside already says the age');

/* 5 — THE ONE-POPULATION GUARD: Bills' chip and the dashboard's
 *     staleKitchen agree ticket-by-ticket. The dashboard's condition
 *     (post-edit) is isOnRail && !isSameLocalDayAs over non-cancelled
 *     live orders; Bills' is isGhostTicket. One set, no fork. */
const fixture = [
  { status: 'preparing', created_at: ago(2 * D), pay: 'completed' }, // the #48 shape
  { status: 'pending', created_at: ago(3 * D), pay: 'pending' },
  { status: 'ready', created_at: ago(2 * D), pay: 'completed' },
  { status: 'new', created_at: ago(2 * D), pay: 'pending' },
  { status: 'new', created_at: ago(2 * H), pay: 'pending' },
  { status: 'completed', created_at: ago(2 * D), pay: 'completed' },
  { status: 'cancelled', created_at: ago(2 * D), pay: 'pending' },
];
const dashSet = fixture.filter((f) => isOnRail(f.status) && !isSameLocalDayAs(f.created_at, NOW));
const billsSet = fixture.filter((f) => isGhostTicket({ status: f.status, created_at: f.created_at }, NOW));
assert.deepEqual(billsSet, dashSet);
assert.equal(dashSet.length, 3); // preparing+ready+pending ghosts; inbox 'new' excluded
ok('one population — the dashboard count and the chip name the same tickets (3 of 7)');

/* 6–7 — THE ROUND GUARD on live copy (comment-blind, 233's lesson). */
const dashSrc = readFileSync(
  new URL('../src/components/dashboard/DashboardScreen.tsx', import.meta.url),
  'utf8',
);
const dashLive = dashSrc
  .split('\n')
  .filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l))
  .join('\n');
assert.ok(!dashLive.includes("['pending', 'preparing']"), 'the two-state fork must be gone');
assert.ok(!dashLive.includes("['pending', 'preparing', 'ready']"), 'the three-state inline must be gone too');
assert.ok(dashLive.includes('isOnRail(String(o.status))'));
ok('the round guard — the inline arrays are gone, the dashboard asks isOnRail');

const billsSrc = readFileSync(
  new URL('../src/components/bills/BillsScreen.tsx', import.meta.url),
  'utf8',
);
const billsLive = billsSrc
  .split('\n')
  .filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l))
  .join('\n');
assert.ok(billsLive.includes('isGhostTicket(o, Date.now())'));
assert.ok(billsLive.includes('ghostChipWords(status, o.created_at, Date.now())'));
assert.ok(billsLive.includes('isGhostTicket(selected, Date.now())'));
ok('the ghost wiring — row chip, row aria, and the detail pane all name it');

/* 8 — the chip wears the service-nudge amber (the camping pill's family). */
assert.ok(billsLive.includes('bg-[#FDF3E4]') && billsLive.includes('text-[#8A5A16]'));
ok('the ghost chip wears the service-nudge amber (#FDF3E4 / #8A5A16)');

console.log(`\nunit235: ${n} asserts — the ghost wears its name, one population, no fork.`);
