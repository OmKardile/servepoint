/* Task 214 — v5.175.0 unit suite: the morning paper.
 * Covers the new pure voices in DashboardScreen:
 *   morningTake(data) — the paper's sync read of fetchDashboard's OWN
 *   weeklyRevenue buckets: yesterday = the row before TODAY (the fetch's
 *   last row by contract), null when the day sold nothing; the week = the
 *   six days before today, null when they sold nothing; the lead service
 *   tie-break is deterministic (Dine-in, then Takeaway), not a judgment.
 *   bookAhead(reservations, nowMs, todayKey) — the floor's exact ahead/
 *   quiet grammar lifted pure: booked rows only (seated/no_show/cancelled
 *   never speak), today in the booking clock (the passed key), ahead vs
 *   quiet split at nowMs, ascending by slot.
 * Run: bunx vite-node scripts/unit214.mjs
 */
import assert from 'node:assert/strict';

const { morningTake, bookAhead } = await import('/src/components/dashboard/DashboardScreen.tsx');

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

/* A week of buckets in the fetch's own row shape: oldest first, LAST row = today. */
const row = (label, full, dineIn, takeaway, delivery) => ({
  label,
  full,
  dineIn,
  takeaway,
  delivery,
  total: dineIn + takeaway + delivery,
});
const weekOf = (rows) => ({
  hourlySales: [],
  revenueByType: [],
  weeklyRevenue: rows,
  weeklyTrending: [],
  totalRevenue: 0,
  totalOrders: 0,
  ordersTrendPct: 0,
  newCustomers: 0,
  customersTrendPct: 0,
  team: [],
  trendingDishes: [],
});

/* ── morningTake ─────────────────────────────────────────────────────── */

// 1. yesterday is the row BEFORE the last (today) — never today itself
const w1 = weekOf([
  row('Mon', 'Monday, 28 Sep', 100, 0, 0),
  row('Tue', 'Tuesday, 29 Sep', 200, 0, 0),
  row('Today', 'Friday, 3 Oct', 9999, 0, 0),
]);
const t1 = morningTake(w1);
assert.equal(t1.yesterday.total, 200);
assert.equal(t1.yesterday.full, 'Tuesday, 29 Sep');
ok('yesterday reads the row before TODAY, never today');

// 2. dead yesterday reads silence even when the rest of the week sold
const w2 = weekOf([
  row('Mon', 'Monday, 28 Sep', 500, 0, 0),
  row('Tue', 'Tuesday, 29 Sep', 0, 0, 0),
  row('Today', 'Friday, 3 Oct', 0, 0, 0),
]);
assert.equal(morningTake(w2).yesterday, null);
ok('a dead yesterday is silence, not a zero');

// 3. week sum covers exactly the past rows and never today
const w3 = weekOf([
  row('Mon', 'Monday, 28 Sep', 100, 50, 0),
  row('Tue', 'Tuesday, 29 Sep', 0, 40, 10),
  row('Wed', 'Wednesday, 30 Sep', 0, 0, 0),
  row('Today', 'Friday, 3 Oct', 777, 0, 0),
]);
const t3 = morningTake(w3);
assert.equal(t3.week.total, 200); // 150 + 50, today's 777 excluded
assert.equal(t3.week.sellingDays, 2); // the dead Wednesday never sold
assert.deepEqual(t3.week.best, { label: 'Mon', total: 150 });
ok('the week sums the past only, counts only selling days, names the best');

// 4. lead service tie-break: dine-in wins ties, then takeaway, then delivery
const t4a = morningTake(weekOf([row('A', 'A', 100, 100, 0), row('Today', 'T', 0, 0, 0)]));
assert.equal(t4a.yesterday.lead, 'Dine-in');
const t4b = morningTake(weekOf([row('A', 'A', 0, 80, 80), row('Today', 'T', 0, 0, 0)]));
assert.equal(t4b.yesterday.lead, 'Takeaway');
const t4c = morningTake(weekOf([row('A', 'A', 0, 0, 60), row('Today', 'T', 0, 0, 0)]));
assert.equal(t4c.yesterday.lead, 'Delivery');
const t4d = morningTake(weekOf([row('A', 'A', 0, 0, 0), row('Today', 'T', 0, 0, 0)]));
assert.equal(t4d.yesterday, null);
ok('lead is a deterministic tie-break, not a judgment');

// 5. all-silent week (and dead yesterday) → both nulls: the page keeps the circle
const t5 = morningTake(weekOf([row('Today', 'T', 0, 0, 0)]));
assert.deepEqual(t5, { yesterday: null, week: null });
ok('a dead week is double silence — the honest circle stays');

// 6. a missing/short rows array cannot explode the paper
assert.deepEqual(morningTake({ weeklyRevenue: [] }), { yesterday: null, week: null });
assert.deepEqual(morningTake({ weeklyRevenue: undefined }), { yesterday: null, week: null });
ok('no rows at all reads double silence');

/* ── bookAhead — the floor's grammar, lifted pure ────────────────────── */

const T = '2026-10-03'; // the booking-clock "today" the tests pass
const slot = (iso) => ({
  id: iso,
  tenant_id: 't',
  location_id: null,
  guest_name: 'Guest',
  phone: '',
  party_size: 2,
  table_id: null,
  slot_at: iso,
  status: 'booked',
  note: '',
  created_by_email: '',
  created_at: iso,
  updated_at: iso,
});

const now = new Date(`${T}T18:00:00+05:30`).getTime();

// 7. booked-today-ahead stands; the slot boundary itself is ahead
const b7 = bookAhead([slot(`${T}T19:30:00+05:30`), slot(`${T}T18:00:00+05:30`)], now, T);
assert.equal(b7.ahead.length, 2);
assert.equal(b7.quiet, 0);
assert.equal(b7.ahead[0].slot_at, `${T}T18:00:00+05:30`); // ascending
ok('ahead holds booked-today rows ascending, the boundary slot included');

// 8. quiet: the promised hour went by, still booked
const b8 = bookAhead([slot(`${T}T17:59:00+05:30`)], now, T);
assert.equal(b8.ahead.length, 0);
assert.equal(b8.quiet, 1);
ok('a passed hour with the booking open reads quiet, not ahead');

// 9. only booked rows speak — seated, no_show and cancelled never do
const others = ['seated', 'no_show', 'cancelled'].map((status) => ({
  ...slot(`${T}T20:00:00+05:30`),
  status,
}));
const b9 = bookAhead(others, now, T);
assert.deepEqual(b9, { ahead: [], quiet: 0 });
ok('a seated, no-show or cancelled promise never speaks');

// 10. the booking clock's today is the PASSED key — other days never speak
const b10 = bookAhead(
  [slot('2026-10-02T20:00:00+05:30'), slot('2026-10-04T09:00:00+05:30'), slot('2026-10-03T20:30:00+05:30')],
  now,
  T,
);
assert.equal(b10.ahead.length, 1);
assert.equal(b10.ahead[0].slot_at, `${T}T20:30:00+05:30`);
ok("yesterday's kept and tomorrow's fresh promises stay out of today's book");

// 11. an empty or unread book is silence
assert.deepEqual(bookAhead([], now, T), { ahead: [], quiet: 0 });
ok('an empty book reads silence');

console.log(`\nunit214 — ${n} asserts, all green.`);
