/* unit346 — v5.307.0 "the trial keeps its promised rate" (agreement shape)
 * The wizard's step-1 preview promised "No charge yet — ₹X / month after
 * the trial ends" — and the write path threw the promise away (trial rows
 * landed at ₹0, the subscriptions room answered ₹0.00 to a rate the
 * operator was told, next_billing_at stayed null forever, and after the
 * window passed the primary still said "Trial ends" — a future-tense lie
 * to a dead trial). THE FEATURE: the ledger keeps the promised rate (the
 * columns speak the PLAN's price; trialing status + null next_billing_at
 * already speak the no-charge-yet half); MRR counts only the rows that
 * CHARGE (active — the "no charge yet" truth); the ONE home's primary
 * speaks past tense for passed windows ("Trial ended <date>", the tenant
 * band's own afterword since 5.126); the wizard's price sentence rides
 * ONE home from step 1 to the review row (the 232 law). */

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(`/home/z/my-project/${p}`, 'utf8');

const api = read('src/lib/api.ts');
const platform = read('src/components/platform/PlatformScreen.tsx');
const billing = read('src/lib/billing.ts');
const band = read('src/components/shell/SubscriptionBand.tsx');
const wizard = read('src/components/platform/ProvisioningWizard.tsx');
const version = read('src/version.ts');
const sw = read('public/sw.js');

test('unit346 · the write keeps the promise — the trial lands at its rate', () => {
  // the two price columns carry the operator's number for BOTH plan paths
  assert.ok(api.includes('monthly_price: input.monthlyPrice,'), 'monthly_price speaks the plan');
  assert.ok(api.includes('final_monthly_rate: input.monthlyPrice,'), 'final_monthly_rate speaks the plan');
  // the old zeroing ternary is gone from the write (the comment may name it)
  const write = api.slice(api.indexOf('const subscription: {'), api.indexOf('from(\'subscriptions\')'));
  assert.ok(!write.includes('isTrial ? 0'), 'no zeroing ternary in the subscription write');
  // the law names itself and the MRR rider
  assert.match(api, /v5\.307\.0 — the trial keeps its PROMISED RATE/);
  assert.ok(api.includes('MRR stays\n      // honest because its own law counts ACTIVE rows only'), 'the MRR rider named at the write');
  // the no-charge-yet half still rides its own columns — untouched
  assert.ok(api.includes("status: isTrial ? 'trialing' : 'active',"), 'the trialing status stands');
  assert.ok(api.includes('next_billing_at: isTrial ? null : in30Days,'), 'the null next billing stands');
});

test('unit346 · the MRR law counts the rows that CHARGE', () => {
  // active-only: the filter stands between the census and the sum
  assert.match(platform, /\.filter\(\(s\) => s\.status === 'active'\)\n        \.reduce\(\(sum, s\) => sum \+ \(s\.final_monthly_rate \|\| 0\), 0\)/);
  // the law comment names the why
  assert.match(platform, /v5\.307\.0 — the MRR law counts the rows that CHARGE: active only/);
  assert.ok(platform.includes('must not\n   * answer the revenue card before the trial converts'), 'the why spoken');
  // the Active-subscriptions census stays byte-still
  assert.ok(platform.includes("() => (subs ?? []).filter((s) => s.status === 'active').length,"), 'the census untouched');
  // the hint family still derives from the paying actives
  assert.ok(platform.includes("const payingSubs = activeSubs.filter((s) => (s.final_monthly_rate ?? s.monthly_price ?? 0) > 0);"), 'the MRR hint family stands');
});

test('unit346 · the tense law — the ONE home speaks past tense for passed windows', () => {
  // both arms live in the ONE home
  assert.ok(
    billing.includes('? `Trial ends ${formatBillingDate(s.trial_end)}`\n          : `Trial ended ${formatBillingDate(s.trial_end)}`'),
    'the live arm byte-still, the past arm honest'
  );
  // the secondary keeps its own grammar — the live grace, the bare rel
  assert.ok(billing.includes('secondary: d >= 0 ? `${rel} · no charge yet` : rel,'), 'the secondary byte-still');
  // the law names itself and the band's seniority
  assert.match(billing, /v5\.307\.0 — the tense law: a LIVE window says/);
  assert.ok(billing.includes("the tenant band's own afterword"), 'the band\u2019s senior past tense credited');
});

test('unit346 · the band\u2019s date strip reads both prefixes', () => {
  // the regex takes the bare date from either tense
  const strips = band.split('words.primary.replace(/^Trial (?:ends|ended) /, \'\')').length - 1;
  assert.equal(strips, 2, 'both arms strip through the one regex');
  // the old string-literal strip is gone
  assert.ok(!band.includes("replace('Trial ends ', '')"), 'the single-prefix strip retired');
  assert.match(band, /v5\.307\.0 — the date strip reads BOTH/);
});

test('unit346 · the price sentence rides ONE home from step 1 to the review', () => {
  // the ONE home exists with both arms
  assert.ok(wizard.includes('const priceSentence ='), 'the sentence\u2019s one home');
  assert.ok(wizard.includes('? `No charge yet — ${pricePreview} / month after the trial ends`'), 'the trial arm\u2019s words');
  assert.ok(wizard.includes(': `Charged at ${pricePreview} / month`;'), 'the standard arm\u2019s words');
  // step 1's caption renders the home
  assert.ok(wizard.includes('<p id="pw-price-preview" className="mt-1 text-xs text-[#969696]">\n                    {priceSentence}\n                  </p>'), 'the caption speaks the home');
  // the review row speaks the same words
  assert.ok(wizard.includes("['Monthly price', priceSentence],"), 'the review row speaks the home');
  // the old inline ternaries are gone from both seats
  assert.ok(!wizard.includes("form.plan === 'trial'\n                      ? `No charge yet"), 'the caption\u2019s inline fork retired');
  assert.ok(!wizard.includes("['Monthly price', pricePreview],"), 'the review\u2019s bare number retired');
  // the 232 law named at the home
  assert.ok(wizard.includes('the 232 law — one phrasing,\n   * no fork'), 'the law names itself');
});

test('unit346 · the neighbours stand byte-still', () => {
  // 5.304's dashboard clock family keeps its import line and its composition
  assert.ok(
    platform.includes("import { daysUntil, planLabel, subscriptionWords, trialBucket, trialRelWords } from '../../lib/billing';"),
    'the clock family import'
  );
  assert.ok(platform.includes('const trialsUrgent = nearestTrial ? trialBucket(nearestTrial.d) === \'last\' : false;'), 'the ink law stands');
  // the 5.125/5.232 billing projection keeps its seat and its inks
  assert.ok(platform.includes("cell.urgent ? 'font-semibold text-[#B42318]' : 'text-[#6B6B6B]'"), 'the urgent ink stands');
  assert.ok(platform.includes('function billingCell(s: Subscription) {\n  return subscriptionWords(s);\n}'), 'the thin projection stands');
  // the 5.233 plan word keeps its one voice
  assert.ok(wizard.includes("const planLabel = form.plan === 'trial' ? 'Trial (14 days)' : 'Standard (active)';"), 'the plan word stands');
  // the write's own neighbours: the CHECK guard comment and the audit trail
  assert.ok(api.includes("plan_id: isTrial ? 'starter' : 'growth',"), 'the plan mapping stands');
  assert.ok(api.includes("action: 'business.provisioned',"), 'the audit trail stands');
});

test('unit346 · the feature names itself and its law', () => {
  assert.match(api, /the trial had no afterlife to convert to/);
  assert.match(platform, /The old all-rows\n   \* reduce only stayed truthful while trials were written at ₹0/);
  assert.match(billing, /the future tense\n     \* would lie to a dead trial/);
  assert.match(wizard, /wizard,\n   \* review and subscriptions room tell one truth/);
  for (const [name, src] of [['api', api], ['platform', platform], ['billing', billing], ['band', band], ['wizard', wizard]]) {
    assert.ok(src.includes('v5.307.0'), `${name} stamps its release`);
  }
});

test('unit346 · the version law — version.ts and sw.js carry the same word', () => {
  const v = version.match(/export const APP_VERSION = '([^']+)';/);
  const s = sw.match(/const VERSION = "servepoint-v([^-]+)-r(\d+)"/);
  assert.ok(v, 'version.ts must speak APP_VERSION');
  assert.ok(s, 'sw.js must bake the cache word');
  assert.equal(v[1], s[1], 'the two words must agree');
  assert.equal(v[1], '5.307.0');
});
