/* Task 236 — v5.197.0 unit suite: the offer names its cost.
 * The offer card counted its uses ("used 3×") and dated its last use
 * ("last used 1d ago", 5.190) — but never said what the offer COST:
 * the rupees it took off tickets. The redemption ride (5.190's
 * fetchOfferRedemptions read) already carried each row's
 * discount_amount; the sum was being discarded. offerGivenAway
 * reduces it (ONE read, TWO derivations), offerUsageAria grows an
 * optional cost clause (count → cost → date; absent = 229's contract
 * byte-identical), the card wears a gold Tag chip (5.192's giveaway
 * icon), and the share paper grows the "Given away" row.
 * Asserted: offerGivenAway (sums per offer, casts DB numerics, the
 * missing-row silence vs the provable 0.00 — the ?? null register);
 * offerUsageAria both shapes + the 229 byte-identity (absent cost);
 * buildOfferShareText absent-cost byte-identity + the present-cost
 * "Given away" row (read as \s{2,} cells, 229's lesson); THE ROUND
 * GUARD — the card chip, the aria param and the paper row wired in
 * live copy (comment-blind, 233's lesson).
 * Run: bunx vite-node scripts/unit236.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const cust = await import('/src/components/customers/CustomersScreen.tsx');
const { offerGivenAway, offerUsageAria, buildOfferText } = cust;

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

/* The suite owns the clock — a fixed NOW, fixtures derived from it. */
const NOW = Date.UTC(2026, 9, 4, 17, 30, 0);
const ago = (h) => new Date(NOW - h * 3600_000).toISOString();

/* 1 — the reducer: the ledger's own paise, summed per offer. */
const given = offerGivenAway([
  { offerId: 'A', discountAmount: 50 },
  { offerId: 'A', discountAmount: '50.00' }, // the DB's numeric arrives as text
  { offerId: 'A', discountAmount: 50 },
  { offerId: 'B', discountAmount: 40.5 },
  { offerId: 'B', discountAmount: null }, // a legacy null rides as 0 (231's lesson)
]);
assert.equal(given.get('A'), 150);
assert.ok(Math.abs(given.get('B') - 40.5) < 1e-9);
ok('offerGivenAway: sums per offer, casts the DB numeric, null rides as 0');

/* 2 — the register: missing row vs provable zero. */
assert.equal(given.has('C'), false); // never redeemed — the ledger never spoke
const zero = offerGivenAway([{ offerId: 'D', discountAmount: 0 }]);
assert.equal(zero.get('D'), 0); // a row with 0.00 — the ledger SPOKE a zero
assert.equal(offerGivenAway([]).size, 0);
ok('the register: no row stays out of the map (silence), a 0.00 row sums to a speaking 0');

/* 3 — the aria: 229's contract byte-identical when the cost is absent. */
assert.equal(offerUsageAria(3, ago(26), NOW), 'used 3 times, last used 1d ago');
assert.equal(offerUsageAria(1, null, NOW), 'used 1 time');
ok('offerUsageAria: absent cost keeps the 229 sentence byte-identical');

/* 4 — the aria: the cost clause rides between count and date. */
assert.equal(
  offerUsageAria(3, ago(26), NOW, 150),
  'used 3 times, ₹150.00 given away, last used 1d ago',
);
assert.equal(offerUsageAria(1, null, NOW, 0), 'used 1 time, ₹0.00 given away');
ok('offerUsageAria: count → cost → date; a provable 0.00 still speaks');

/* 5 — the paper: absent cost keeps the old bytes. */
const offer = {
  id: 'A',
  title: '₹50 off over ₹300',
  description: 'Treat the table.',
  discount_type: 'flat',
  discount_value: 50,
  min_order_amount: 300,
  usage_count: 3,
  is_active: true,
};
const paperNoCost = buildOfferText(offer, 'CheeseBurg', ago(26), NOW);
const paperCost = buildOfferText(offer, 'CheeseBurg', ago(26), NOW, 150);
const strip = (s) => s.split('\n').filter((l) => !l.startsWith('Shared '));
assert.deepEqual(
  strip(paperCost).filter((l) => !l.includes('Given away')),
  strip(paperNoCost),
);
ok('the paper: absent cost → byte-identical (the Shared-timestamp line excepted)');

/* 6 — the paper's Given away row, read as \s{2,} cells (229's lesson). */
const givenRow = paperCost.split('\n').find((l) => l.includes('Given away'));
assert.ok(givenRow, 'the Given away row must exist');
const cells = givenRow.trim().split(/\s{2,}/);
assert.equal(cells[0], 'Given away');
assert.equal(cells[1], '₹150.00');
ok('the paper: "Given away ₹150.00" rides as clean two() cells after Used so far');

/* 7 — the row order: Used so far → Given away → Last used (the card's order). */
const lines = paperCost.split('\n');
const iUsed = lines.findIndex((l) => l.includes('Used so far'));
const iGiven = lines.findIndex((l) => l.includes('Given away'));
const iLast = lines.findIndex((l) => l.includes('Last used'));
assert.ok(iUsed < iGiven && iGiven < iLast);
ok('the paper order: Used so far → Given away → Last used (count → cost → date)');

/* 8–9 — THE ROUND GUARD on live copy (comment-blind, 233's lesson). */
const src = readFileSync(
  new URL('../src/components/customers/CustomersScreen.tsx', import.meta.url),
  'utf8',
);
const live = src
  .split('\n')
  .filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l))
  .join('\n');
assert.ok(live.includes('setGivenAway(offerGivenAway(rows))'));
assert.ok(live.includes('offerUsageAria(o.usage_count, lastIso, Date.now(), givenRupees)'));
assert.ok(live.includes('{formatMoney(givenRupees)} given'));
assert.ok(live.includes('givenAway?.get(o.id) ?? null'));
ok('the round guard — the load, the aria, the chip and both share calls wire the cost');

assert.ok(live.includes('<Tag size={12}') && live.includes('bg-[#FBF7EC]'));
ok('the chip wears the gold register with the Tag icon (5.192\u2019s giveaway voice)');

console.log(`\nunit236: ${n} asserts — the offer names its cost, one read two derivations.`);
