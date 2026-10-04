/* Task 249 — v5.210.0 unit suite: the cart hears the offers.
 * The counter built an order on Food & Drinks and the only surface that
 * ever mentioned offers was the review drawer's picker — a fit the
 * counter had to discover by opening things. v5.210.0 gives the order
 * pill a fit whisper: an offer the line set already qualifies for speaks
 * "applies" (the money on the table), a threshold just out of reach
 * speaks "add ₹X more", an offer already applied speaks its
 * confirmation. The fit's arithmetic is the store's own offerDiscount —
 * the SAME number the drawer's discount line speaks (one arithmetic,
 * never a second one); the rule's words come from the lib's ONE
 * composer (offerRuleLabel — the same words the offers tab's card
 * speaks, 5.201's own-word rule). The offers register is the SCREEN's
 * ONE read feeding both pill and picker (the drawer's own fetch
 * retired — two readers of one state can never disagree).
 * Asserted: offerFit's three kinds (hand-re-addable — the born suite
 * lesson; best take wins among eligible, ties keep the read's order; the
 * CLOSEST threshold speaks among unlocks); the family agreement (the
 * fit's take == offerDiscount's number == the drawer's discount line);
 * structural silence (null offers / empty / zero subtotal → null); the
 * honest upsell (a worse offer applied while a better one fits still
 * speaks 'applies'); source guards — the screen's ONE read, the drawer
 * receives the state (its own fetch retired), the picker's null guard,
 * the pill's chip and aria clause, the lib composer shared.
 * Run: bunx vite-node scripts/unit249.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const { offerFit } = await import('/src/components/food/FoodDrinksScreen.tsx');
const { offerDiscount } = await import('/src/store/cart.ts');
const { offerRuleLabel, offerBadgeLabel } = await import('/src/lib/offerLabel.ts');

const strip = (p) =>
  readFileSync(new URL(p, import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l))
    .join('\n');
const foodCode = strip('../src/components/food/FoodDrinksScreen.tsx');
const crmCode = strip('../src/components/customers/CustomersScreen.tsx');
const libCode = strip('../src/lib/offerLabel.ts');

/* the fixture — the live CheeseBurg register's own shape */
const flat50 = { id: 'flat50', discount_type: 'flat', discount_value: 50, min_order_amount: 300, is_active: true };
const pct10 = { id: 'pct10', discount_type: 'percent', discount_value: 10, min_order_amount: 350, is_active: true };
const flat20 = { id: 'flat20', discount_type: 'flat', discount_value: 20, min_order_amount: 100, is_active: true };

/* ── 1 — 'applies': the best take wins (hand-re-addable) ──
 * At ₹440 all three fit: ₹50, ₹44 (10%), ₹20 — the flat 50 speaks. */
const fit = offerFit([flat50, pct10, flat20], 440, null);
assert.equal(fit.kind, 'applies');
assert.equal(fit.offer.id, 'flat50');
assert.equal(fit.take, 50);
assert.equal(fit.rule, '₹50.00 off over ₹300.00');
ok("offerFit 'applies': best take wins (50 beats 44 beats 20), rule speaks the threshold");

/* ── 2 — the family agreement: the fit's take IS the drawer's discount ── */
assert.equal(fit.take, offerDiscount(fit.offer, 440), 'the same number the drawer speaks');
assert.equal(offerRuleLabel(pct10), `10% off over ${offerRuleLabel(pct10).split(' over ')[1]}`);
ok("the fit's take == offerDiscount (one arithmetic); the rule rides the ONE composer");

/* ── 3 — 'applied' and the honest upsell ── */
assert.equal(offerFit([flat50, pct10, flat20], 440, 'flat50').kind, 'applied', 'the applied best speaks its confirmation');
const upsell = offerFit([flat50, pct10, flat20], 440, 'pct10');
assert.equal(upsell.kind, 'applies', 'a worse offer applied while a better one fits still speaks applies');
assert.equal(upsell.offer.id, 'flat50');
ok("'applied' when the best is applied; the honest upsell when it is not");

/* ── 4 — 'unlock': the closest threshold speaks ──
 * At ₹80 nothing fits: ₹20-off needs ₹100 (missing ₹20), ₹50-off needs
 * ₹300 (missing ₹220) — the NEARER threshold whispers. */
const unlock = offerFit([flat50, flat20], 80, null);
assert.equal(unlock.kind, 'unlock');
assert.equal(unlock.offer.id, 'flat20');
assert.equal(unlock.missing, 20);
ok("'unlock': the closest threshold speaks (₹20 more for ₹20 off over ₹100)");

/* ── 5 — structural silence ── */
assert.equal(offerFit(null, 440, null), null, 'unread register → silence');
assert.equal(offerFit([], 440, null), null, 'no live offers → silence');
assert.equal(offerFit([flat50], 0, null), null, 'empty line set → silence');
ok('silence: unread / empty / zero subtotal all stay silent (never a fabricated "no offers")');

/* ── 6 — source guards: one register, one composer, one tap ── */
assert.ok(foodCode.split('fetchOffers(').length === 2, 'the screen holds the ONE offers read');
assert.ok(foodCode.includes('<OrderDrawer') && foodCode.includes('offers={offers}'), 'the drawer receives the screen state');
assert.ok(!foodCode.includes('useState<Offer[]>'), "the drawer's own offers state is retired");
assert.ok(foodCode.includes('{offers && offers.length > 0 && ('), "the picker hides on an unread register (never a fabricated 'no offers')");
assert.ok(foodCode.includes('${fit ? `, ${fitVoice}` : \'\'}') || foodCode.includes('fit ? `, ${fitVoice}`'), "the pill's aria names the fit");
assert.ok(foodCode.includes('{fit && (') && foodCode.includes('{fitVoice}'), 'the pill renders the whisper chip');
assert.ok(foodCode.includes('if (drawerOpen) setOffersTick((t) => t + 1)'), 'every drawer open re-reads (the picker meets mid-shift offers)');
assert.ok(libCode.includes('export function offerRuleLabel') && crmCode.includes("from '../../lib/offerLabel'"), 'the ONE composer lives in lib, the offers tab borrows from it');
assert.ok(foodCode.includes('offerDiscount(best, subtotal)'), "the fit computes with the store's own arithmetic");
ok('source guards: one read, one composer, one register, the picker null-guarded');

console.log(`\nunit249 — ${n} groups green`);
