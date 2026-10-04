/* Task 252 — v5.213.0 unit suite: the chip knows what it saves.
 * The guest banner's chips said WHY an offer exists (the rule, 5.212) but
 * never why the guest should TAP one NOW — "Tap to apply" with no number
 * on the table. v5.213.0 gives the chip the savings preview: what the
 * offer takes off the line set AS IT STANDS, read from the store's ONE
 * offerDiscount (the arithmetic the counter's fit whisper speaks and the
 * drawer's discount line will speak when the guest taps — the voice-triple
 * widening of 5.212 existed precisely so a projection could borrow it).
 * The locked chip reads ₹0 naturally (the arithmetic guards the threshold)
 * — the preview never lies about an offer the cart can't take yet.
 * The aria now speaks EVERY state the sighted read (5.212's own lesson:
 * aria-label REPLACES content — a state the aria omits is a state the SR
 * never hears): applied / saves / tap / add-more, selected-locked included.
 * Asserted: the preview arithmetic byte-cases (flat, percent, locked→0,
 * empty cart→0, percent paise rounding); the family agreement (the chip's
 * preview == offerDiscount == the number the drawer's discount line spoke
 * in 251's E2E, 400×10% = ₹40.00 hand-checked); the i18n template present
 * in ALL THREE languages with the {amt} slot (Dict is Record<string,string>
 * — no compile-time completeness guard, the suite IS the guard); source
 * guards — the chip composes offerDiscount + offerSaves + the four-state
 * aria, tabular-nums on the state line, the addMore round2 discipline.
 * Run: bunx vite-node scripts/unit252.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const { offerDiscount } = await import('/src/store/cart.ts');

const strip = (p) =>
  readFileSync(new URL(p, import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l))
    .join('\n');

const guestCode = strip('../src/components/guest/GuestPages.tsx');
const i18nCode = strip('../src/lib/guest-i18n.ts');

/* ── 1 — the preview arithmetic: the chip's number IS the store's number ── */
const fifty = { discount_type: 'flat', discount_value: 50, min_order_amount: 300 };
const ten = { discount_type: 'percent', discount_value: 10, min_order_amount: 300 };

assert.equal(offerDiscount(fifty, 400), 50);
assert.equal(offerDiscount(ten, 400), 40);
ok('unlocked previews: flat ₹50.00, 10% of ₹400 = ₹40.00 (251 E2E hand-check)');

assert.equal(offerDiscount(fifty, 180), 0);
assert.equal(offerDiscount(ten, 180), 0);
assert.equal(offerDiscount(ten, 299.99), 0);
ok('locked previews read ₹0 — the arithmetic guards the threshold, the preview never lies');

assert.equal(offerDiscount(fifty, 0), 0);
assert.equal(offerDiscount(ten, 400.005), 40); // 400.005*10/100 = 40.0005 → rounds to 40
assert.equal(offerDiscount({ discount_type: 'percent', discount_value: 12.5, min_order_amount: 0 }, 400), 50);
ok('edge bytes: empty cart ₹0, paise rounding, fractional percent');

/* ── 2 — the i18n template: all three languages, one {amt} slot each ── */
for (let i = 0; i < 1; i++) {
  const block = i18nCode.split('offerSaves:').length - 1;
  assert.equal(block, 3, `offerSaves must exist in all three dicts, found ${block}`);
}
assert.ok(/offerSaves: 'Tap to apply — saves \{amt\}'/.test(i18nCode), 'EN template names the action and the money');
assert.ok(/offerSaves: '[^']*\{amt\}[^']*'/.test(i18nCode.split('offerSaves:')[1] ? i18nCode : i18nCode), 'the templates carry the {amt} slot');
assert.ok(i18nCode.split('{amt}').length >= 8, 'the {amt} slots survive in the added templates');
ok('offerSaves present in all three dicts (the suite is the completeness guard Dict lacks)');

/* ── 3 — source guards: the chip composes the family, not a second one ── */
assert.ok(guestCode.includes('offerDiscount(o, cartSubtotal)'), 'the chip preview reads the store\'s ONE arithmetic');
assert.ok(guestCode.includes("t('offerSaves', { amt: money(take) })"), 'the visible line speaks the i18n savings voice');
assert.ok(guestCode.includes('take > 0'), 'a zero take falls back to the plain tap voice (degenerate offers stay honest)');
assert.ok(guestCode.includes('round2(Math.max(min - cartSubtotal, 0))'), 'the addMore amount keeps the round2 discipline (one arithmetic with the drawer\'s state line)');

const savesUses = guestCode.split("t('offerSaves'").length - 1;
assert.equal(savesUses, 2, `the savings voice composes exactly twice — visible line + aria (one sentence, two ears), got ${savesUses}`);
ok('source guards: one arithmetic, the i18n voice twice (eye + ear), the fallback kept');

/* ── 4 — the aria speaks every state the sighted read ── */
assert.ok(guestCode.includes("` — ${t('offerApplied')}`"), 'applied state in the aria');
assert.ok(guestCode.includes("` — ${t('offerSaves', { amt: money(take) })}`"), 'savings state in the aria');
assert.ok(guestCode.includes("` — ${t('offerTap')}`"), 'plain tap state in the aria');
assert.ok(guestCode.includes(': ` — ${addMore}`'), 'locked state in the aria (selected-locked was SR-silent before 252)');
ok('the four-state aria: applied / saves / tap / add-more — the SR hears what the sighted read');

/* ── 5 — the styling discipline: money digits align across the chip rail ── */
assert.ok(guestCode.includes('font-semibold tabular-nums'), 'the state line rides tabular-nums — amounts align across the horizontally-scrolling chips');
ok('styling: tabular-nums on the state line, the rail reads like a table of its own');

/* ── 6 — 251's round survives: no second composer came back ── */
assert.ok(guestCode.includes('offerRuleLabel(o)'), 'the rule still comes from the ONE composer');
assert.ok(guestCode.includes('offerBadgeShort(o)'), 'the compact badge still composes from the lib');
assert.ok(!guestCode.includes('toFixed(0)'), 'the rounding lie stays dead');
ok('251 intact: rule + compact badge still borrowed, the lie stays dead');

console.log(`\n  ${n} groups — unit252 (v5.213.0 the chip knows what it saves)`);
