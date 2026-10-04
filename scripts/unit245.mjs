/* Task 245 — v5.206.0 unit suite: the offer's ledger opens.
 * The offers tab's scorecard (5.71) told each offer's story in three chips
 * (count → cost → date) but kept the ledger's rows themselves locked in the
 * read: fetchOfferRedemptions returned every redemption with its ticket and
 * its paise, and the screen reduced it all away. The card could say "used
 * 3×, ₹150.00 given" yet never show WHICH tickets, WHEN, or what the
 * average redemption looked like. v5.206.0 keeps the rows whole (ONE read,
 * now THREE facts — 5.190+5.197's doctrine continued), slices them by
 * offer (redemptionsByOffer, the read's own newest-first order preserved —
 * no local re-sort clock), and opens a per-offer usage drawer whose footer
 * speaks the average voice (offerUsageStats): count, given (the SAME sum
 * offerGivenAway speaks on the chip — one reducer family), avg take, avg
 * ticket — computed over rows that CARRY a total only, because an orphaned
 * ticket's missing total is not a ₹0 ticket (silence is not zero), and
 * all-null totals make avgTicket null so the footer falls to the
 * per-redemption voice instead of inventing a register.
 * Asserted: the slicer's bucketing + order preservation; the stats math
 * (fixtures chosen to be re-addable by hand — the born-suite lesson);
 * the provable zero (0.00 rows SPEAK); the orphan discipline (null totals
 * excluded from the ticket average, still counted in count/avgOff);
 * all-null → avgTicket null; empty → null (structural silence); string
 * discount tolerance (Number() coercion at the boundary); source guards —
 * the drawer speaks usedAgo + dayTime (the ledger's two time registers)
 * and the door exists only under `usageRows.length > 0`.
 * Run: bunx vite-node scripts/unit245.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const { redemptionsByOffer, offerUsageStats, offerGivenAway } = await import(
  '/src/components/customers/CustomersScreen.tsx'
);

const strip = (p) =>
  readFileSync(new URL(p, import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l))
    .join('\n');
const scrCode = strip('../src/components/customers/CustomersScreen.tsx');

/* ── 1 — the slicer: buckets by offer, preserves the read's order ── */
const A = 'offer-aaaa';
const B = 'offer-bbbb';
/* the read arrives NEWEST FIRST (api's .order created_at desc) — the
 * fixtures walk backwards in time on purpose, A twice, B twice. */
const rows = [
  { offerId: A, title: 'flat', discountType: 'flat', discountValue: 50, isActive: true, discountAmount: 50, orderTotal: 409.5, createdAt: '2026-10-04T09:00:00Z' },
  { offerId: B, title: 'pct', discountType: 'percent', discountValue: 10, isActive: true, discountAmount: 22, orderTotal: 220, createdAt: '2026-10-03T09:00:00Z' },
  { offerId: A, title: 'flat', discountType: 'flat', discountValue: 50, isActive: true, discountAmount: 50, orderTotal: 358, createdAt: '2026-10-02T09:00:00Z' },
  { offerId: B, title: 'pct', discountType: 'percent', discountValue: 10, isActive: true, discountAmount: 18, orderTotal: 180, createdAt: '2026-10-01T09:00:00Z' },
];
const sliced = redemptionsByOffer(rows);
assert.equal(sliced.size, 2, 'exactly the two offers that wrote rows');
assert.deepEqual([...sliced.keys()].sort(), [A, B].sort());
const aRows = sliced.get(A);
assert.equal(aRows.length, 2);
assert.equal(aRows[0].createdAt, '2026-10-04T09:00:00Z', 'newest first: the read order preserved');
assert.equal(aRows[1].createdAt, '2026-10-02T09:00:00Z', 'older second: NO local re-sort');
ok('redemptionsByOffer: buckets by offer, the read newest-first order kept');

/* ── 2 — the drawer's footer math (re-addable by hand) ──
 * A's rows: 50 + 50 = 100 given; tickets 409.5 + 358 = 767.5; avg 383.75. */
const statsA = offerUsageStats(aRows);
assert.equal(statsA.count, 2);
assert.equal(statsA.given, 100);
assert.equal(statsA.avgOff, 50);
assert.equal(statsA.avgTicket, 383.75);
/* B's rows: 22 + 18 = 40; tickets 220 + 180 = 400; avg 200. */
const statsB = offerUsageStats(sliced.get(B));
assert.equal(statsB.given, 40);
assert.equal(statsB.avgTicket, 200);
/* the family agreement: the stats' given IS the chip's given (one
 * arithmetic, two reducers). */
assert.equal(offerGivenAway(rows).get(A), statsA.given);
assert.equal(offerGivenAway(rows).get(B), statsB.given);
ok('offerUsageStats: count/given/avgOff/avgTicket, the given == the chip reducer');

/* ── 3 — the provable zero: 0.00 rows SPEAK (never silenced) ── */
const zeroStats = offerUsageStats([
  { discountAmount: 0, orderTotal: 120 },
  { discountAmount: 0, orderTotal: 80 },
]);
assert.equal(zeroStats.count, 2);
assert.equal(zeroStats.given, 0);
assert.equal(zeroStats.avgOff, 0);
assert.equal(zeroStats.avgTicket, 100);
ok('a genuine ₹0.00 take speaks — silence is not zero, zero is not silence');

/* ── 4 — the orphan discipline: a null total is not a ₹0 ticket ── */
const orphanStats = offerUsageStats([
  { discountAmount: 30, orderTotal: 300 },
  { discountAmount: 20, orderTotal: null }, // orphaned: counts in take, NOT in ticket average
]);
assert.equal(orphanStats.count, 2);
assert.equal(orphanStats.given, 50);
assert.equal(orphanStats.avgOff, 25);
assert.equal(orphanStats.avgTicket, 300, 'the null-total row stayed out of the ticket average');
/* ALL rows orphaned → avgTicket null (the footer falls to the
 * per-redemption voice — no ticket register invented). */
const allOrphan = offerUsageStats([
  { discountAmount: 10, orderTotal: null },
  { discountAmount: 15, orderTotal: null },
]);
assert.equal(allOrphan.count, 2);
assert.equal(allOrphan.avgOff, 12.5);
assert.equal(allOrphan.avgTicket, null);
ok('orphaned tickets: counted in the take, excluded from the ticket average; all-null → avgTicket null');

/* ── 5 — structural silence: empty rows → null ── */
assert.equal(offerUsageStats([]), null);
assert.equal(offerUsageStats(null), null);
/* and the slicer stays silent for an offer that never wrote a row — */
assert.equal(redemptionsByOffer(rows).get('offer-never-redeemed'), undefined);
ok('empty ledger → null stats, no key → no door: the silence is structural');

/* ── 6 — the boundary coerces: string paise from a hand-edited row still sum ── */
const strStats = offerUsageStats([
  { discountAmount: '50', orderTotal: '409.5' },
  { discountAmount: '50', orderTotal: '358' },
]);
assert.equal(strStats.given, 100);
assert.equal(strStats.avgTicket, 383.75);
ok('string discount/total tolerated at the boundary (Number() before arithmetic)');

/* ── 7 — source guards: the drawer speaks the ledger's two time registers
 *      and the door exists only under rows.length > 0 ── */
assert.ok(scrCode.includes('redemptionsByOffer(redemptions)'), 'the memo slices the raw ride');
assert.ok(scrCode.includes('usageRows.length > 0'), 'the door guards on the slice, not the map');
assert.ok(scrCode.includes('ledgerByOffer?.get(o.id)'), 'the card reads ITS OWN slice');
assert.ok(/usedAgo\(r\.createdAt/.test(scrCode), 'each row speaks its own ago-voice');
assert.ok(/title=\{`redeemed \$\{dayTime\(r\.createdAt\)\}`\}/.test(scrCode), 'the full stamp rides the row title');
assert.ok(scrCode.includes("'per redemption'"), 'the all-orphan footer voice exists');
assert.ok(scrCode.includes('a {formatMoney(r.orderTotal)} ticket'), 'the ticket register names itself');
ok('source guards: one slice, guarded door, both time registers, both footer voices');

console.log(`\nunit245 — ${n} groups green`);
