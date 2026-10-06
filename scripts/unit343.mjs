/* unit343 — v5.304.0 "the trial names its clock" (agreement shape)
 * The dashboard's Trials card was the ONE billing surface that didn't speak
 * the clock's whole sentence: it named a bare date while the rows and the
 * subscription cells spoke name-less urgency through lib/billing. THE
 * FEATURE: the card now composes the sentence through the ONE clock — which
 * business, the same relative words the rows speak (trialRelWords, the 232
 * lesson: no third phrasing), the date in the owner's grammar, the urgent
 * ink only when the shared bucket law says 'last'. The nearest is the
 * nearest LIVE window when one exists; a passed window is named only when
 * every window has passed, and the words still say "window passed" — the
 * sentence never lies about a dead trial. THE WORDS: the hint's tone slot
 * wears the cell's own colors (zero new hexes), the tooltip carries the
 * full sentence so a truncated line never hides its own words, and the
 * swap repaints on the house's transition instead of snapping. */

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(`/home/z/my-project/${p}`, 'utf8');

const billing = read('src/lib/billing.ts');
const platform = read('src/components/platform/PlatformScreen.tsx');
const version = read('src/version.ts');
const sw = read('public/sw.js');

test('unit343 · the relative words have ONE home and the row grammar borrows it', () => {
  // the clock's voice is exported — one phrasing everywhere the clock speaks
  assert.match(billing, /export function trialRelWords\(d: number\): string/);
  assert.ok(
    billing.includes("return d === 0 ? 'ends today' : d === 1 ? '1 day left' : d > 1 ? `${d} days left` : 'window passed';"),
    'the ONE relative-words copy stands in the lib'
  );
  // subscriptionWords no longer carries its own inline copy — the old
  // second phrasing is gone by byte-law
  assert.equal(
    billing.includes("const rel =\n      d === 0 ? 'ends today'"),
    false,
    'the inline ternary in subscriptionWords moved out'
  );
  assert.ok(billing.includes('const rel = trialRelWords(d);'), 'the row grammar borrows the ONE home');
  // the grammar around it is byte-still: same primary, same no-charge suffix
  assert.ok(billing.includes('primary: `Trial ends ${formatBillingDate(s.trial_end)}`'));
  assert.ok(billing.includes('secondary: d >= 0 ? `${rel} · no charge yet` : rel,'));
});

test('unit343 · the dashboard composes the sentence through the ONE clock', () => {
  // the borrow: the whole clock family rides one import line
  assert.ok(
    platform.includes("import { daysUntil, planLabel, subscriptionWords, trialBucket, trialRelWords } from '../../lib/billing';"),
    'PlatformScreen borrows daysUntil + trialBucket + trialRelWords'
  );
  // the sentence: which business · the rows' own words · the owner's date
  assert.ok(
    platform.includes(
      '`${tenantNameById.get(nearestTrial.sub.tenant_id) || \'—\'} · ${trialRelWords(nearestTrial.d)} · ${formatDate(nearestTrial.end)}`'
    ),
    'name · rel words · date — no third phrasing'
  );
  // the clocks come from trialing subs with a real trial_end, NaN-refused
  assert.ok(
    platform.includes(".filter((s) => (s.status === 'trialing' || s.status === 'trial') && !!s.trial_end)"),
    'the trial family, scoped'
  );
  assert.ok(platform.includes('.filter((t) => !Number.isNaN(t.d));'), 'an unparsable window never speaks');
});

test('unit343 · the nearest is the nearest LIVE window — the selection law', () => {
  // live windows first: soonest end wins; a passed window is named only
  // when every window has passed, and then the latest passed one
  assert.ok(
    platform.includes('.filter((t) => t.d >= 0).sort((a, b) => a.end.localeCompare(b.end))'),
    'live trials, soonest first'
  );
  assert.ok(
    platform.includes('.filter((t) => t.d < 0).sort((a, b) => b.end.localeCompare(a.end))'),
    'passed trials, most recently passed first'
  );
  assert.ok(platform.includes('const nearestTrial = liveTrials[0] ?? passedTrials[0];'), 'live first, passed as fallback');
});

test('unit343 · the ink law — urgent only when the bucket says last', () => {
  // the shared bucket law decides, not a private threshold
  assert.ok(
    platform.includes("const trialsUrgent = nearestTrial ? trialBucket(nearestTrial.d) === 'last' : false;"),
    'the bucket\u2019s own threshold (≤3 days) decides the ink'
  );
  // the card passes the tone and nothing else
  assert.ok(platform.includes("hintTone={trialsUrgent ? 'urgent' : undefined}"), 'the Trials card carries the tone');
  // KpiCard's slot: the cell's own colors — zero new hexes
  assert.ok(
    platform.includes("hintTone === 'urgent' ? 'font-semibold text-[#B42318]' : 'font-medium text-[#969696]'"),
    'the urgent red and the grey voice are the app\u2019s existing hexes'
  );
  // the other three cards never grow a tone
  assert.ok(platform.includes('<KpiCard icon={Building2} label="Total businesses" value={tenantsError ? \'—\' : tenants?.length ?? 0} hint={businessesHint} />'));
  assert.ok(platform.includes('<KpiCard icon={CreditCard} label="Active subscriptions" value={subsError ? \'—\' : activeSubscriptions} hint={activeSubsHint} />'));
  assert.ok(platform.includes('<KpiCard icon={TrendingUp} label="Monthly recurring revenue" value={subsError ? \'—\' : formatMoney(mrr)} hint={mrrHint} />'));
});

test('unit343 · the full words never hidden, the swap never snapping', () => {
  // the tooltip carries the whole sentence — a truncated line still tells
  assert.ok(platform.includes('title={hint}'), 'the hint\u2019s own words ride the tooltip');
  assert.ok(
    platform.includes('transition-colors duration-300'),
    'the tone swap repaints on the house\u2019s transition'
  );
  // the slot keeps its size and seat
  assert.ok(platform.includes('mt-1.5 truncate text-[11.5px]'));
});

test('unit343 · the neighbours stand — hints and rows byte-still', () => {
  // the 5.232 hint family keeps its own compositions
  assert.ok(
    platform.includes("mrrHint = `from ${tenantNameById.get(payingSubs[0].tenant_id) || '—'} · ${planLabel(payingSubs[0].plan_id)}`;"),
    'the MRR hint\u2019s own sentence'
  );
  assert.ok(
    platform.includes('`next charge ${formatDate(nextCharges[0])}`'),
    'the next-charge hint\u2019s own sentence'
  );
  assert.ok(platform.includes('cities.length === 1 ? cities[0] : cities.length > 1 ? cities.join(\' · \') : undefined'), 'the cities hint untouched');
  // the recent-business strip's urgent clause keeps its own colors (the
  // dashboard's new ink mirrors it — no second law)
  assert.ok(
    platform.includes("cell?.urgent ? 'font-semibold text-[#B42318]' : 'font-medium text-[#6B6B6B]'"),
    'the strip\u2019s urgent clause untouched'
  );
  // the row grammar keeps the no-charge suffix and the trial-pill classes
  assert.ok(platform.includes("case 'trialing':\n    case 'trial':\n      return 'bg-[#F3E8CF] text-[#8A6A1F]';"), 'the trial pill\u2019s own ink');
});

test('unit343 · the feature names itself and its law', () => {
  assert.match(platform, /the Trials card hears the clock's WHOLE sentence/);
  assert.match(platform, /the sentence never lies about a dead trial/);
  assert.match(billing, /phrase a third sentence/, 'the lib names the phrasing law');
  assert.match(billing, /v5\.304\.0/, 'the lib stamps its release');
  assert.match(platform, /v5\.304\.0/, 'the screen stamps its release');
});

test('unit343 · the version law — version.ts and sw.js carry the same word', () => {
  const v = version.match(/export const APP_VERSION = '([^']+)';/);
  const s = sw.match(/const VERSION = "servepoint-v([^-]+)-r(\d+)"/);
  assert.ok(v, 'version.ts must speak APP_VERSION');
  assert.ok(s, 'sw.js must bake the cache word');
  assert.equal(v[1], s[1], 'the two words must agree');
  assert.equal(v[1], '5.304.0');
});
