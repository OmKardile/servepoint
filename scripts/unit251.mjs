/* Task 251 — v5.212.0 unit suite: the guest hears the offer's own words.
 * The guest QR menu composed its offer badge and rule LOCALLY since the
 * banner was born — "₹50 off · min ₹300" while the offers tab's card said
 * "₹50.00 off over ₹300.00" (two composers of one offer's words — the exact
 * disease 5.210 cured on the owner side, 5.211 swept from Reports). And the
 * compact badge's flat branch carried a quiet lie: toFixed(0) rounded a
 * ₹44.50 offer into a "₹45" chip. v5.212.0:
 *   • lib/offerLabel owns the compact register (offerBadgeShort — ONE
 *     composer for BOTH guest badge sites; paise honest via formatMoney);
 *   • the composers accept the OfferVoice triple (Pick<Offer, discount_type
 *     | discount_value | min_order_amount>) — the guest's PublicOffer
 *     projection borrows the words without owning an Offer-shaped shadow;
 *   • the guest drawer's honest state line speaks a picked-but-locked
 *     offer's reason INLINE (the hover title a thumb can never lift is
 *     retired as the only witness);
 *   • the banner chip's aria-label names the rule — the SR hears what the
 *     sighted read (aria-label REPLACES content; the rule was invisible).
 * Asserted: offerBadgeShort's byte cases (the rounding lie asserted dead);
 * the structural borrow (a triple-only literal composes the SAME words the
 * owner surfaces speak — byte-identity, 5.149's watch); the compact↔full
 * agreement (two sizes, one number register); source guards — no local
 * composer remnant survives in GuestPages, the state line composes the
 * i18n voice + the lib rule, the lib owns the integer branch.
 * Run: bunx vite-node scripts/unit251.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const { offerBadgeShort, offerBadgeLabel, offerRuleLabel } = await import('/src/lib/offerLabel.ts');
const { offerDiscount } = await import('/src/store/cart.ts');

const strip = (p) =>
  readFileSync(new URL(p, import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l))
    .join('\n');

const guestCode = strip('../src/components/guest/GuestPages.tsx');
const libCode = strip('../src/lib/offerLabel.ts');
const foodCode = strip('../src/components/food/FoodDrinksScreen.tsx');

/* ── 1 — offerBadgeShort: the compact register's bytes ── */
assert.equal(offerBadgeShort({ discount_type: 'percent', discount_value: 10, min_order_amount: 0 }), '10%');
ok('compact percent speaks its own number ("10%")');

assert.equal(offerBadgeShort({ discount_type: 'percent', discount_value: 12.5, min_order_amount: 0 }), '12.5%');
ok('compact percent keeps the fraction ("12.5%")');

assert.equal(offerBadgeShort({ discount_type: 'flat', discount_value: 50, min_order_amount: 300 }), '₹50');
ok('compact flat whole rupee stays bare ("₹50")');

assert.equal(offerBadgeShort({ discount_type: 'flat', discount_value: 44.5, min_order_amount: 300 }), '₹44.50');
ok('THE ROUNDING LIE IS DEAD — ₹44.50 no longer chips as "₹45"');

assert.equal(offerBadgeShort({ discount_type: 'flat', discount_value: 0.25, min_order_amount: 0 }), '₹0.25');
ok('compact flat paise speaks formatMoney\'s own voice ("₹0.25")');

/* ── 2 — the structural borrow: a triple-only literal (PublicOffer's shape)
      composes the SAME words the owner surfaces speak ── */
const guestProjection = { discount_type: 'flat', discount_value: 50, min_order_amount: 300 };
assert.equal(offerBadgeLabel(guestProjection), '₹50.00 off');
assert.equal(offerRuleLabel(guestProjection), '₹50.00 off over ₹300.00');
ok('the guest projection composes the owner surfaces\' exact words (byte-identity)');

const pctProjection = { discount_type: 'percent', discount_value: 10, min_order_amount: 0 };
assert.equal(offerRuleLabel(pctProjection), '10% off');
ok('a zero-min rule speaks the badge alone (no threshold it doesn\'t have)');

/* ── 3 — the compact↔full agreement: two sizes, ONE number register ── */
assert.equal(offerBadgeShort({ discount_type: 'flat', discount_value: 44.5, min_order_amount: 0 }), '₹44.50');
assert.equal(offerBadgeLabel({ discount_type: 'flat', discount_value: 44.5, min_order_amount: 0 }), '₹44.50 off');
assert.equal(offerBadgeShort({ discount_type: 'percent', discount_value: 12.5, min_order_amount: 0 }), '12.5%');
assert.equal(offerBadgeLabel({ discount_type: 'percent', discount_value: 12.5, min_order_amount: 0 }), '12.5% off');
ok('compact and full badges agree on the number at both sizes');

/* ── 4 — the store's arithmetic shares the same door (Offer satisfies the
      voice triple; the body never moved) ── */
assert.equal(offerDiscount({ discount_type: 'flat', discount_value: 50, min_order_amount: 300 }, 245), 0);
assert.equal(offerDiscount({ discount_type: 'flat', discount_value: 50, min_order_amount: 300 }, 350), 50);
assert.equal(offerDiscount({ discount_type: 'percent', discount_value: 10, min_order_amount: 300 }, 350), 35);
ok('offerDiscount speaks the voice triple too — one arithmetic, every projection');

/* ── 5 — source guards: the guest file carries no second composer ── */
assert.ok(!guestCode.includes('Number(o.discount_value)}% off'), 'the local badge ternary is retired from the chip subtitle');
assert.ok(!guestCode.includes('Number(o.discount_value) % 1 === 0'), 'the local compact ternary (with its toFixed(0) lie) is retired');
assert.ok(!guestCode.includes('toFixed(0)'), 'no rounding lie survives anywhere in the guest file');
assert.ok(!guestCode.includes('· min ₹'), 'the "min ₹300" dialect is retired — the rule comes from the ONE composer');
assert.ok(libCode.includes('export function offerBadgeShort'), 'the compact register lives in the lib');
assert.ok(libCode.includes('Number.isInteger'), 'the lib owns the honest integer branch');

const badgeShortUses = guestCode.split('offerBadgeShort(o)').length - 1;
assert.equal(badgeShortUses, 2, `both guest badge sites compose the ONE compact voice (banner chip + drawer pill), got ${badgeShortUses}`);
assert.ok(guestCode.includes('offerRuleLabel(o)'), 'the chip subtitle and aria borrow the rule composer');
assert.ok(guestCode.includes('offerRuleLabel(selectedOffer)'), 'the drawer\'s honest state line borrows the rule composer');
ok('source guards: no second composer survives, both badges + subtitle + state line read the lib');

/* ── 6 — the honest state line: picked-but-locked speaks inline ── */
assert.ok(guestCode.includes('selectedOffer && !offerReady'), 'the line guards the picked-but-locked state (applied keeps the green line, never both)');
assert.ok(guestCode.includes("t('offerAddMore'"), 'the i18n\'s own "add more" voice (three languages) speaks the missing amount');
assert.ok(guestCode.includes('role="status"'), 'the line is a live region — the SR hears the reason when it appears');
const ariaPrefix = 'aria-label={`${o.title} — ${offerRuleLabel(o)}`'.replace(/`$/, '');
assert.ok(guestCode.includes(ariaPrefix), 'the chip\'s aria-label names the rule — the SR hears what the sighted read');
ok('the honest state line + the speakable aria: the reason is never tooltip-only');

/* ── 7 — the fit family survives (v5.214.0: the body moved to lib/offerFit.ts —
      the cart-domain home the guest bar borrows; unit249's guards re-run migrated) ── */
const fitLibCode = strip('../src/lib/offerFit.ts');
assert.ok(fitLibCode.includes('offerDiscount(best, subtotal)'), 'offerFit\'s body computes with the store\'s ONE arithmetic — from its cart-domain home');
assert.ok(fitLibCode.includes('OfferVoice & { id: string }'), 'the fit\'s shape is the voice triple + id (the applied/applies tell)');
ok('the fit family survived — now in the lib home, borrowed by both surfaces');

console.log(`\n  ${n} groups — unit251 (v5.212.0 the guest hears the offer's own words)`);
