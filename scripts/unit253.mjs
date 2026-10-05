/* Task 253 — v5.214.0 unit suite: the guest bar whispers the fit.
 * The floating cart bar was the LAST silent offer surface on the guest
 * side: it said "2 items | View order · ₹total" while the counter's pill
 * whispered the fit ("applies" / "add ₹X more" / "off applied"). Two
 * moves in this round:
 *   • the fit family moved to its cart-domain home — lib/offerFit.ts owns
 *     the reducer AND the sentence (offerFitVoice, born this round): the
 *     counter screen rendered a fit computed by a function it no longer
 *     hosts, and a component file must never be a lib (the guest would
 *     have imported the food screen's whole module graph to reach one
 *     reducer);
 *   • the guest bar borrows the family: offerFit(offers, cartSubtotal,
 *     selectedOfferId) — the counter's exact selection grammar (best
 *     take wins among eligible, the closest threshold speaks among
 *     unlocks, the honest upsell when a better offer fits than the one
 *     applied) — and offerFitVoice(fit) is the sentence's ONE composer,
 *     rendered on the bar's whisper line and riding the button's aria.
 * Asserted: offerFitVoice's three byte-cases (the counter's exact
 * sentences); offerFit on a PublicOffer-shaped fixture (the guest
 * register's projection) — best-take, closest-threshold, honest upsell,
 * structural silence; the family agreement (the fit's take ==
 * offerDiscount's number == the drawer's discount line); source guards —
 * the guest composes the fit from the LIB (not from the food screen, not
 * a local copy), offerFitVoice exactly twice (line + aria — one sentence,
 * two ears), the state colors are the chips' own palette, tabular-nums,
 * and NO role="status" on the bar line (the bar re-renders on every cart
 * move — a live region there would re-announce every add; the button's
 * aria carries the voice for the SR moment instead).
 * Run: bunx vite-node scripts/unit253.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const { offerFit, offerFitVoice } = await import('/src/lib/offerFit.ts');
const { offerDiscount } = await import('/src/store/cart.ts');

const strip = (p) =>
  readFileSync(new URL(p, import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l))
    .join('\n');

const guestCode = strip('../src/components/guest/GuestPages.tsx');
const fitLibCode = strip('../src/lib/offerFit.ts');
const foodCode = strip('../src/components/food/FoodDrinksScreen.tsx');

/* the guest register's projection — PublicOffer's exact shape */
const flat50 = { id: 'f50', title: '₹50 off over ₹300', description: null, discount_type: 'flat', discount_value: 50, min_order_amount: 300 };
const pct10 = { id: 'p10', title: 'Morning flat white — 10% off', description: null, discount_type: 'percent', discount_value: 10, min_order_amount: 0 };

/* ── 1 — the voice's three byte-cases (the counter's exact sentences) ── */
const applied = offerFit([flat50, pct10], 400, 'f50');
assert.ok(applied && applied.kind === 'applied');
assert.equal(offerFitVoice(applied), '₹50.00 off applied');
ok('applied: "₹50.00 off applied"');

const applies = offerFit([flat50, pct10], 400, null);
assert.ok(applies && applies.kind === 'applies' && applies.offer.id === 'f50');
assert.equal(offerFitVoice(applies), '₹50.00 off over ₹300.00 applies');
ok('applies: the rule + "applies" — the money on the table');

const unlock = offerFit([flat50], 220, null);
assert.ok(unlock && unlock.kind === 'unlock');
assert.equal(offerFitVoice(unlock), 'Add ₹80.00 more for ₹50.00 off over ₹300.00');
ok('unlock: "Add ₹80.00 more for …" — the honest upsell');

/* ── 2 — the selection grammar on the guest's projection ── */
const betterFits = offerFit([flat50, pct10], 400, 'p10');
assert.ok(betterFits && betterFits.kind === 'applies' && betterFits.offer.id === 'f50');
ok('the honest upsell: 10% applied (₹40) while flat ₹50 fits → "applies" names the better one');

const familyTake = offerFit([pct10], 400, null);
assert.equal(familyTake?.take, offerDiscount(pct10, 400));
ok('the fit\'s take IS offerDiscount\'s number — one arithmetic, every surface');

assert.equal(offerFit(null, 400, null), null);
assert.equal(offerFit([], 400, null), null);
assert.equal(offerFit([flat50], 0, null), null);
ok('structural silence: unread register / empty / zero subtotal → no fit');

/* ── 3 — source guards: the bar borrows the family home ── */
assert.ok(guestCode.includes('offerFit(offers, cartSubtotal, selectedOfferId)'), 'the bar\'s fit reads the screen\'s ONE register with the guest\'s own selection');
assert.ok(guestCode.includes("from '../../lib/offerFit'"), 'the guest imports the lib home');
assert.ok(!guestCode.includes('export function offerFit'), 'no local copy of the reducer — a copy would fork the arithmetic AND the guard');
assert.ok(!guestCode.includes("from '../food/FoodDrinksScreen'"), 'a component file is never a lib — the guest did not import the food screen for one reducer');

const voiceUses = guestCode.split('offerFitVoice(fit)').length - 1;
assert.equal(voiceUses, 2, `the voice composes exactly twice — the whisper line + the button's aria (one sentence, two ears), got ${voiceUses}`);
ok('source guards: one home, one borrow, the voice twice');

/* ── 4 — the surface: the chips' palette, the tabular money, the SR discipline ── */
assert.ok(guestCode.includes("fit.kind === 'applied'\n                  ? 'text-[#2E7D32]'".replace('\n                  ', ' ')) || guestCode.includes("'text-[#2E7D32]'"), 'applied speaks green');
assert.ok(guestCode.includes("'text-[#967221]'") && guestCode.includes("'text-[#B4483C]'"), 'applies gold, unlock red — the chips\' own palette rides the bar');
assert.ok(guestCode.includes('font-semibold tabular-nums'), 'the whisper rides tabular-nums — the money holds still while the cart moves');

const barBlock = guestCode.slice(guestCode.indexOf('floating cart bar'), guestCode.indexOf('cart drawer'));
assert.ok(!barBlock.includes('role="status"'), 'the bar line is NOT a live region — the bar re-renders on every add, a live region would chatter; the button\'s aria carries the voice');
assert.ok(barBlock.includes("aria-label={`${t('viewOrder', { amt: money(cartTotal) })}${fit ? `, ${offerFitVoice(fit)}` : ''}${windowWarm ? `, ${t('windowWarmFab')}` : ''}`}"), 'the bar button\'s aria names the fit (the counter pill\'s own grammar) — 5.251.0 honest re-anchor: the warm word rides the same label');
ok('the surface: the palette, the tabular money, the aria — and no live-region chatter');

/* ── 5 — the counter side: the surface survives, the body does not ── */
assert.ok(foodCode.includes('offerFitVoice(fit)'), 'the counter\'s fitVoice composes from the lib\'s ONE sentence now');
assert.ok(!foodCode.includes('export function offerFit'), 'the food screen no longer hosts the body (unit249\'s guards re-run migrated)');
ok('the counter borrowed the home too — one reducer, one sentence, two surfaces');

console.log(`\n  ${n} groups — unit253 (v5.214.0 the guest bar whispers the fit)`);
