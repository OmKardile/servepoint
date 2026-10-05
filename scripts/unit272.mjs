/* Task 272 — v5.233.0 unit suite: the words say what the money does.
 *
 * The Task 272 walk (guest QR surfaces end-to-end, then the Platform's
 * ProvisioningWizard — the last unwalked room) found two truth gaps, both
 * the SAME disease: words claiming what the numbers don't show.
 *
 * 1 — the fit's 'applies' voice. A percent offer's rule speaks only a
 *     rate ("10% off applies") while the cart total shows full price —
 *     the ₹27.00 the offer takes on the guest's actual lines lived
 *     nowhere until the tap (5.262: a verdict beside a number that never
 *     meets it). The take rode in the fit all along; the sentence never
 *     said it. A flat offer's rule ALREADY speaks its rupees — saying
 *     them twice is the second disease.
 * 2 — the wizard's price preview said "Charged at ₹4,999.00 / month"
 *     under a TRIAL plan — a charge that never lands during the trial
 *     (the tenant strip's own grammar is "no charge yet"). And the
 *     review's plan word said "Trial (status: trial)" — one fact twice
 *     in one breath.
 *
 * v5.233.0: the 'applies' state names the take for PERCENT offers only
 * ("10% off applies · ₹27.00 off this order"); flat keeps its bytes (the
 * money is already in the rule — say it once); zero take stays silent
 * (never a fabricated ₹0.00); 'applied' and 'unlock' byte-preserved. The
 * wizard's preview speaks the plan's truth ("No charge yet — ₹X / month
 * after the trial ends" vs "Charged at ₹X / month") and the review says
 * the choice once ("Trial (14 days)").
 *
 * Asserted: the composer's three-state contract by BEHAVIOR (percent
 * applies gains the clause; flat byte-preserved; applied/unlock
 * byte-preserved; zero-take silence); the ONE-composer law (the counter
 * and the guest both import offerFitVoice — no local dialect); the
 * wizard's plan-aware caption + the dedup'd planLabel + the option
 * labels' byte-preservation; offerRuleLabel untouched (the rule's own
 * bytes feed the sentence).
 * Run: bunx vite-node scripts/unit272.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { offerFit, offerFitVoice } from '/src/lib/offerFit.ts';
import { offerRuleLabel } from '/src/lib/offerLabel.ts';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);
const strip = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

/* ── 1–6: the composer's contract, by behavior ── */

/* 1 — percent applies names the take on THIS cart. */
const percentFit = offerFit(
  [{ id: 'o1', discount_type: 'percent', discount_value: 10, min_order_amount: 0 }],
  270,
  null
);
assert.ok(percentFit && percentFit.kind === 'applies');
assert.equal(offerFitVoice(percentFit), '10% off applies · ₹27.00 off this order');
ok("percent applies: '10% off applies · ₹27.00 off this order' — the money named");

/* 2 — flat applies keeps its bytes: the rule already speaks the rupees. */
const flatFit = offerFit(
  [{ id: 'o2', discount_type: 'flat', discount_value: 50, min_order_amount: 300 }],
  400,
  null
);
assert.ok(flatFit && flatFit.kind === 'applies');
assert.equal(offerFitVoice(flatFit), '₹50.00 off over ₹300.00 applies');
ok("flat applies byte-preserved: '₹50.00 off over ₹300.00 applies' — said once");

/* 3 — applied confirmation byte-preserved. */
const appliedFit = offerFit(
  [{ id: 'o1', discount_type: 'percent', discount_value: 10, min_order_amount: 0 }],
  270,
  'o1'
);
assert.ok(appliedFit && appliedFit.kind === 'applied');
assert.equal(offerFitVoice(appliedFit), '₹27.00 off applied');
ok("applied byte-preserved: '₹27.00 off applied'");

/* 4 — unlock upsell byte-preserved. */
const unlockFit = offerFit(
  [{ id: 'o2', discount_type: 'flat', discount_value: 50, min_order_amount: 300 }],
  220,
  null
);
assert.ok(unlockFit && unlockFit.kind === 'unlock');
assert.equal(offerFitVoice(unlockFit), 'Add ₹80.00 more for ₹50.00 off over ₹300.00');
ok("unlock byte-preserved: 'Add ₹80.00 more for ₹50.00 off over ₹300.00'");

/* 5 — zero take stays silent: no fabricated ₹0.00. */
const zeroFit = offerFit(
  [{ id: 'o3', discount_type: 'percent', discount_value: 0, min_order_amount: 0 }],
  270,
  null
);
assert.ok(zeroFit && zeroFit.kind === 'applies' && zeroFit.take === 0);
assert.equal(offerFitVoice(zeroFit), '0% off applies');
ok('zero take: the guard holds — the clause only rides a real take');

/* 6 — the rule's own bytes feed the sentence (offerLabel untouched). */
assert.equal(offerRuleLabel({ discount_type: 'percent', discount_value: 10, min_order_amount: 0 }), '10% off');
assert.equal(offerRuleLabel({ discount_type: 'flat', discount_value: 50, min_order_amount: 300 }), '₹50.00 off over ₹300.00');
ok('offerRuleLabel untouched: the rule bytes feed the sentence');

/* ── source pins ── */
const fitSrc = strip('../src/lib/offerFit.ts');
const guestSrc = strip('../src/components/guest/GuestPages.tsx');
const foodSrc = strip('../src/components/food/FoodDrinksScreen.tsx');
const wizardSrc = strip('../src/components/platform/ProvisioningWizard.tsx');

/* 7 — the ONE-composer law: both surfaces import the lib's voice; no
 * local dialect resurrected (the 5.210 disease stays cured). */
assert.ok(guestSrc.includes("import { offerFit, offerFitVoice } from '../../lib/offerFit';"));
assert.ok(foodSrc.includes("import { offerFit, offerFitVoice } from '../../lib/offerFit';"));
assert.equal(fitSrc.includes('applies · '), true, 'the clause lives in the composer, once');
const dialectCount = [...guestSrc.matchAll(/applies · /g)].length + [...foodSrc.matchAll(/applies · /g)].length;
assert.equal(dialectCount, 0, 'no surface speaks the clause locally — the composer owns it');
ok('one composer: the counter and the guest both borrow; no local dialect');

/* 8 — the percent gate rides the offer's own kind, not a hardcoded rate. */
assert.ok(
  fitSrc.includes("fit.offer.discount_type === 'percent' && fit.take > 0"),
  'the clause gates on the discount kind + a real take'
);
ok('the gate: percent + take > 0 — flat and zero keep their bytes');

/* ── 9–11: the wizard says what the plan does ── */

/* 9 — the preview speaks the plan's truth. */
assert.ok(
  wizardSrc.includes('`No charge yet — ${pricePreview} / month after the trial ends`'),
  'trial preview: no charge yet, the after-voice'
);
assert.ok(
  wizardSrc.includes('`Charged at ${pricePreview} / month`'),
  'standard preview keeps its bytes'
);
ok("wizard preview: trial speaks 'No charge yet — ₹X / month after the trial ends'");

/* 10 — the review says the choice once. */
assert.equal(
  wizardSrc.includes("'Trial (status: trial)' : 'Standard (status: active)'"),
  false,
  'the doubled ternary is extinct (the pin reads code, not comments — 5.265)'
);
assert.equal(
  wizardSrc.includes("form.plan === 'trial' ? 'Trial (14 days)' : 'Standard (active)'"),
  true,
  "the review's plan word = the option's own label"
);
ok("review dedup: 'Trial (14 days)' — one fact, one breath");

/* 11 — the option labels themselves byte-preserved (the choices' words). */
assert.ok(wizardSrc.includes('<option value="trial">Trial (14 days)</option>'));
assert.ok(wizardSrc.includes('<option value="standard">Standard (active)</option>'));
ok('option labels byte-preserved: step 1 and step 3 share one voice');

console.log(`\nunit272 — ${n} checks green`);
