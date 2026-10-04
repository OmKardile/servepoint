/* Task 250 — v5.211.0 unit suite: the window speaks the offer's own rides.
 * The Reports scorecard (5.71) answered for every offer in aggregates —
 * uses, brought-in, cost — but kept the window's rides themselves locked
 * in the read, and composed the badge voice LOCALLY (a second composer of
 * the offer's own words, five versions after lib/offerLabel became the
 * one home). v5.211.0 retires the local voiceOf (the ONE composer speaks
 * — 5.210's own-word rule finally reaching Reports, the share paper's
 * byte-identity watch 5.149 deserves a single source) and opens the
 * family's ledger door on every scorecard row that rode in the window:
 * the drawer grammar borrowed WHOLE from the offers tab (5.206) — rows
 * newest-first (the read's own order; inWin filters, never re-sorts),
 * each row naming both rupee registers, the footer's average voice from
 * the SAME exported pure reducer the chip speaks (offerUsageStats — a
 * second copy would be a second arithmetic that can disagree).
 * Asserted: the composer agreement (offerBadgeLabel's words hand-checked
 * against the retired local line — percent and flat, the byte-identity
 * the share paper watches); source guards (no local voiceOf, the memo
 * derives the ledger from the window's own rows — one read, free
 * derivation, 5.197; the reducers imported from the family home, not
 * copied); the window slice preserves the read's newest-first order (no
 * second clock); the family agreement (stats.given == the scorecard's
 * discountSum register for the same rows, hand-re-addable fixtures);
 * orphan discipline at window scale (null total → counted in the take,
 * silent about the ticket; all-null → avgTicket null → the per-
 * redemption voice); structural silence (an offer with no rows gets no
 * bucket and no door — the guard is the slice's length).
 * Run: bunx vite-node scripts/unit250.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const { offerBadgeLabel, offerRuleLabel } = await import('/src/lib/offerLabel.ts');
const { redemptionsByOffer, offerUsageStats } = await import(
  '/src/components/customers/CustomersScreen.tsx'
);

const strip = (p) =>
  readFileSync(new URL(p, import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l))
    .join('\n');
const scrCode = strip('../src/components/reports/ReportsScreen.tsx');

/* ── 1 — the composer agreement: one voice, byte-identical ──
 * The retired local line spoke exactly these words; the lib composer
 * must speak the SAME words or the share paper (5.149, byte-identity
 * watched) would shift under the owner's feet. */
const flatOffer = { discount_type: 'flat', discount_value: 50, min_order_amount: 300 };
const pctOffer = { discount_type: 'percent', discount_value: 10, min_order_amount: 0 };
assert.equal(offerBadgeLabel(flatOffer), '₹50.00 off', 'flat: the retired voiceOf\'s exact words');
assert.equal(offerBadgeLabel(pctOffer), '10% off', 'percent: the retired voiceOf\'s exact words');
assert.equal(offerRuleLabel(flatOffer), '₹50.00 off over ₹300.00', 'the rule names its threshold');
assert.equal(offerRuleLabel(pctOffer), '10% off', 'a zero min speaks no clause');
ok('composer agreement: the ONE composer speaks the retired local words byte-for-byte');

/* ── 2 — source guards: one composer, one reducer family, one read ── */
assert.ok(!scrCode.includes('const voiceOf'), 'the local second composer is GONE');
assert.ok(scrCode.includes('voice: offerBadgeLabel(o)'), 'the scorecard borrows the lib composer');
assert.ok(scrCode.includes("from '../../lib/offerLabel'"), 'the composer import points at the lib home');
assert.ok(scrCode.includes("from '../customers/CustomersScreen'"), 'the reducers travel from the family home (no second copy)');
assert.ok(scrCode.includes('ledger: redemptionsByOffer(inWin)'), 'the ledger derives from the WINDOW\'s own rows (5.197: free derivation, never a second fetch)');
assert.ok(scrCode.includes('offerUsageStats(usageRows)'), 'the footer arithmetic is the family\'s own reducer');
ok('source guards: one composer, reducers borrowed not copied, ledger from the one read');

/* ── 3 — the door grammar guards ── */
assert.ok(scrCode.includes('usageRows.length > 0'), 'the door guards on the slice, not the map');
assert.ok(scrCode.includes('aria-expanded={openThis}'), 'the door speaks its own truth');
assert.ok(scrCode.includes('toggleOfferLedger(o.id)'), 'the door toggles the row\'s own id');
assert.ok(scrCode.includes("silent ? ("), 'a silent offer keeps the static row (no door, no invented content)');
assert.ok(scrCode.includes("'per redemption'"), 'the all-orphan footer voice exists');
assert.ok(scrCode.includes('a {formatMoney(r.orderTotal)} ticket'), 'the ticket register names itself');
assert.ok(scrCode.includes('usedAgo(r.createdAt, Date.now())'), 'the row\'s ago-voice rides right');
assert.ok(scrCode.includes('dayTime(r.createdAt)'), 'the full stamp lives in the title');
ok('door grammar: guarded door, both time registers, both footer voices, silent rows stay silent');

/* ── 4 — the window slice: the read's own newest-first order ── */
/* the read arrives NEWEST FIRST (api's .order created_at desc); the
 * window filter keeps that order — a local re-sort would be a second
 * clock (5.190's lesson at bucket scale). Fixtures walk backwards. */
const A = 'offer-aaaa';
const B = 'offer-bbbb';
const inWin = [
  { offerId: A, discountAmount: 50, orderTotal: 409.5, createdAt: '2026-10-04T09:00:00Z' },
  { offerId: B, discountAmount: 44, orderTotal: 440, createdAt: '2026-10-03T09:00:00Z' },
  { offerId: A, discountAmount: 50, orderTotal: 332.5, createdAt: '2026-10-02T09:00:00Z' },
  { offerId: A, discountAmount: 50, orderTotal: null, createdAt: '2026-10-01T09:00:00Z' },
];
const ledger = redemptionsByOffer(inWin);
const aRows = ledger.get(A);
assert.equal(aRows.length, 3, 'A rode three times in the window');
assert.equal(aRows[0].createdAt, '2026-10-04T09:00:00Z', 'newest first: the read order preserved');
assert.equal(aRows[2].createdAt, '2026-10-01T09:00:00Z', 'oldest last: no re-sort anywhere');
ok('window slice: buckets preserve the read\'s own newest-first order');

/* ── 5 — structural silence: no rows, no bucket, no door ── */
assert.equal(ledger.get(B).length, 1, 'B rode once');
assert.equal(ledger.get('offer-gone'), undefined, 'an offer with no window rows gets NO bucket');
ok('structural silence: the missing bucket is the missing door');

/* ── 6 — the family agreement: one arithmetic, two surfaces ──
 * Hand-checked: A's rides 50 + 50 + 50 = ₹150 given (the scorecard's
 * discountSum register for the same rows); avg take 150/3 = ₹50.00;
 * avg ticket over the rows that CARRY a total: (409.50 + 332.50) / 2
 * = ₹371.00 — the orphaned third ride contributes its take but stays
 * out of the ticket average (a null total is not a ₹0 ticket). */
const aStats = offerUsageStats(aRows);
assert.equal(aStats.count, 3);
assert.equal(aStats.given, 150, 'the take re-adds by hand: 50 + 50 + 50');
assert.equal(aStats.avgOff, 50, 'avg take = given / count');
assert.equal(aStats.avgTicket, 371, 'avg ticket = (409.50 + 332.50) / 2 — the orphan stays out');
assert.equal(aStats.given, aRows.reduce((s, r) => s + Number(r.discountAmount ?? 0), 0), 'the footer\'s sum IS the scorecard\'s cost register — one arithmetic');
ok('family agreement: the window footer and the scorecard register speak one arithmetic');

/* ── 7 — all-orphan: a null average never becomes an invented ₹0 ── */
const orphanRows = [{ offerId: 'D', discountAmount: 30, orderTotal: null, createdAt: '2026-10-01T09:00:00Z' }];
const dStats = offerUsageStats(orphanRows);
assert.equal(dStats.count, 1, 'the ride still counts');
assert.equal(dStats.given, 30, 'the take still speaks');
assert.equal(dStats.avgTicket, null, 'no carried total → no ticket register invented');
ok('all-orphan: the footer falls to the per-redemption voice');

console.log(`\nunit250 — ${n} groups green — the window speaks the offer's own rides.`);
