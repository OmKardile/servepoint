/* Task 246 — v5.207.0 unit suite: the paper names its giveaways.
 * The morning paper had two money registers — what the week brought in
 * (the week tile, 5.205's ledger calendar) and the book's promises — but
 * the house's GIVEAWAYS had no voice: the redemption ledger that 5.206's
 * drawer opened on the offers tab was silent on the surface the owner
 * reads first. v5.207.0 gives the paper a THIRD register: GIVEN AWAY —
 * the ledger's whole-book truth (sum, count) beside the offers register's
 * live count, with a door that hints 'tab:offers' and a Guests screen
 * that CONSUMES the hint (5.203's rule: the named thing reachable in ONE
 * tap — landing on the guests tab would be a fiction with a doorknob).
 * Deliberately NO window: the tile speaks all-time because that is the
 * truth the landing answers (5.198 — two surfaces quoting the same
 * register must quote the same number; a "this week" promise with no
 * week-voiced landing would be the 5.205 fiction class).
 * Asserted: offersTake's arithmetic (hand-re-addable fixtures — the born
 * suite lesson); the family agreement (the tile's given IS the chip
 * reducer's sum, offerGivenAway, the offers tab's own voice — one
 * arithmetic across the door); the live count from the offers register;
 * empty rows → null (structural silence, never a fabricated ₹0);
 * string paise coerced at the boundary; paused offers counted out of
 * live; source guards — the door hints tab:offers, the Guests screen
 * consumes it, BOTH reads ride the same Promise.all (one voice or none),
 * and the paper's render guard includes the giveaway tile.
 * Run: bunx vite-node scripts/unit246.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const { offersTake } = await import('/src/components/dashboard/DashboardScreen.tsx');
const { offerGivenAway } = await import('/src/components/customers/CustomersScreen.tsx');

const strip = (p) =>
  readFileSync(new URL(p, import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l))
    .join('\n');
const dashCode = strip('../src/components/dashboard/DashboardScreen.tsx');
const scrCode = strip('../src/components/customers/CustomersScreen.tsx');

/* ── 1 — the arithmetic (the live CheeseBurg ledger's own shape) ──
 * 3 rows of ₹50 off + 1 row of ₹44 → given 194, count 4. */
const rows = [
  { discountAmount: 50 },
  { discountAmount: 50 },
  { discountAmount: 50 },
  { discountAmount: 44 },
];
const offers = [
  { is_active: true },
  { is_active: true },
  { is_active: false }, // paused: counted out of live, not out of the ledger
];
const take = offersTake(rows, offers);
assert.equal(take.given, 194);
assert.equal(take.count, 4);
assert.equal(take.live, 2);
ok('offersTake: sum 194 / count 4 / live 2 (paused offers count out of live only)');

/* ── 2 — the family agreement: the tile's given IS the chip reducer's sum ──
 * The landing's per-offer chips speak offerGivenAway's map; the tile must
 * quote the same money (5.198's rule across the door). */
const ledger = [
  { offerId: 'a', discountAmount: 50 },
  { offerId: 'a', discountAmount: 50 },
  { offerId: 'a', discountAmount: 50 },
  { offerId: 'b', discountAmount: 44 },
];
const chipSum = [...offerGivenAway(ledger).values()].reduce((s, v) => s + v, 0);
assert.equal(offersTake(ledger, offers).given, chipSum);
ok("the tile's given == the landing's chip sums (offerGivenAway family, one arithmetic)");

/* ── 3 — structural silence: empty ledger → null ── */
assert.equal(offersTake([], offers), null);
assert.equal(offersTake(null, offers), null);
/* nothing to read from the register side either — the tile still computes
 * (live 0), because an all-paused register is a fact, not a failure: */
const noneLive = offersTake([{ discountAmount: 10 }], [{ is_active: false }]);
assert.equal(noneLive.given, 10);
assert.equal(noneLive.live, 0);
ok('empty ledger → null (no fabricated ₹0); an all-paused register still speaks live 0');

/* ── 4 — the boundary coerces: string paise still sum ── */
assert.equal(offersTake([{ discountAmount: '50' }, { discountAmount: '44' }], offers).given, 94);
ok('string paise coerced at the boundary');

/* ── 5 — source guards: the door's word, the landing's ear, one voice ── */
assert.ok(dashCode.includes("go('customers', ['Dashboard', 'Guests'], 'tab:offers')"), 'the door hints tab:offers');
assert.ok(scrCode.includes("hint === 'tab:offers'") && scrCode.includes("setTab('offers')"), 'the Guests screen consumes the hint and opens ON the offers tab');
assert.ok(dashCode.includes('Promise.all([fetchOfferRedemptions(tenantId, 500), fetchOffers(tenantId)])'), 'BOTH reads ride one Promise.all — one voice or none');
assert.ok(dashCode.includes('!give)') || dashCode.includes('&& !give'), "the paper's render guard includes the giveaway tile");
assert.ok(dashCode.includes('Open Guests — the offers ledger reads'), "the door's aria names the landing's own figures");
ok('source guards: the door speaks tab:offers, the landing consumes it, one voice or none');

console.log(`\nunit246 — ${n} groups green`);
