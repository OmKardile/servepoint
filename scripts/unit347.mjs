/* unit347 — v5.308.0 "the trial answers its door" (agreement shape)
 * 5.307 gave the trial a promised rate and the honest words said so —
 * "conversion has no in-app path yet". THE FEATURE: the conversion door.
 * A trialing row in the Subscriptions room grows a "Convert to paid"
 * door in its own status cell (desktop) and card (mobile — the 232 law,
 * both shapes one truth). The two-click law: arm, then confirm — no
 * dialogs, counter-tablet hands. The write flips status → active and
 * stamps next_billing_at at the trial window's OWN end (never a
 * mid-window double-bill), guarded to trialing rows so a second click
 * answers nothing; the promised rate columns are untouched (5.307's
 * promise survives conversion); a best-effort platform audit row rides
 * along. The MRR law (active-only, 5.307) picks the row up by itself —
 * no new arithmetic anywhere. */

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(`/home/z/my-project/${p}`, 'utf8');

const api = read('src/lib/api.ts');
const platform = read('src/components/platform/PlatformScreen.tsx');
const version = read('src/version.ts');
const sw = read('public/sw.js');

test('unit347 · the write opens the door — guarded, dated, rate-keeping', () => {
  // the door's write: active + the window's own end as the first charge
  assert.ok(
    api.includes(".update({ status: 'active', next_billing_at: sub.trial_end })"),
    'the first charge lands at the window\u2019s own end'
  );
  // the guard: only a trialing row answers (a second click writes nothing)
  assert.ok(api.includes(".eq('status', 'trialing');"), 'the trialing guard stands');
  // the promise survives: the update statement never touches the rate
  // columns (the helper's PARAMETER type names them — that's the shape,
  // not the write; the needle stays inside the .update)
  const helper = api.slice(api.indexOf('export async function convertTrialToPaid'), api.indexOf('/* ── Inventory + recipes'));
  const updateAt = helper.indexOf('.update({');
  const updateStmt = helper.slice(updateAt, helper.indexOf('})', updateAt));
  assert.ok(!updateStmt.includes('monthly_price'), 'no rate rewrite in the update');
  assert.ok(!updateStmt.includes('final_monthly_rate'), 'no final-rate rewrite in the update');
  assert.ok(updateStmt.includes("status: 'active'") && updateStmt.includes('next_billing_at: sub.trial_end'), 'the update speaks exactly the two truths');
  // the helper is scoped to the tenant (the platform\u2019s own seat)
  assert.ok(helper.includes(".eq('tenant_id', sub.tenant_id)"), 'the tenant scope stands');
  // the law names itself
  assert.match(api, /Convert a trialing subscription to paid \(v5\.308\.0\)/);
  // the why spoken (anchored on the file: the doc comment sits ABOVE the
  // export line — the helper slice starts too late to carry it)
  assert.match(api, /never a mid-window double-bill/, 'the why spoken');
});

test('unit347 · the door lives in the status cell — desktop and card speak one truth', () => {
  // both shapes carry the SAME conditional — a trialing row WITH a window
  const seats = platform.split("s.status === 'trialing' && s.trial_end && (").length - 1;
  assert.equal(seats, 2, 'exactly two seats: the belt\u2019s cell and the card');
  // the desktop seat sits inside the status cell (the chip stays first)
  const cell = platform.slice(platform.indexOf('<StatusChip status={s.status} />\n                        {/* v5.308.0'), platform.indexOf('<td className="whitespace-nowrap px-4 py-3.5 text-right align-top">'));
  assert.ok(cell.includes("Convert ${tenantNameById.get(s.tenant_id) || 'this business'} trial to paid"), 'the desktop door names the business');
  // the mobile card's door is full-width (its own shape, same words)
  assert.ok(platform.includes("'mt-3 inline-flex h-8 w-full items-center justify-center rounded-full border"), 'the card\u2019s full-width door');
  // the 232 law named at the card's seat
  assert.ok(platform.includes('the card carries the same door (the 232 law'), 'the law names the card');
});

test('unit347 · the two-click law — arm, confirm, one armed door at a time', () => {
  // arm on the first click, answer on the second
  assert.ok(platform.includes('if (armedConvertId !== sub.id) {\n        setArmedConvertId(sub.id);\n        return;\n      }'), 'arm, then confirm');
  // arming replaces (one armed door at a time) — the state is a single id
  assert.ok(platform.includes('const [armedConvertId, setArmedConvertId] = useState<string | null>(null);'), 'one armed door at a time');
  // the busy law: the row mid-write is disabled and says so
  assert.ok(platform.includes("convertingIds.has(s.id)"), 'the busy seat');
  assert.ok(platform.includes("'Converting…'"), 'the busy word');
  // the reload: the room retells the truth after the write
  assert.ok(platform.includes('await convertTrialToPaid('), 'the door rides the api');
  assert.ok(platform.includes('await load();'), 'the room reloads after the write');
});

test('unit347 · a date-less trial refuses the door', () => {
  // the handler returns honestly
  assert.ok(platform.includes('if (!sub.trial_end) return; // a date-less trial cannot promise a charge date'), 'the handler refuses');
  // the render never offers a date-less door (the conditional carries trial_end)
  assert.ok(platform.includes("s.status === 'trialing' && s.trial_end && ("), 'the render refuses');
});

test('unit347 · the words keep the promise — the tooltip and the confirm label', () => {
  // the tooltip carries the promised date and the rate's survival
  const tooltips = platform.split('title={`Charges begin ${formatDate(s.trial_end)} — the promised rate stands`}').length - 1;
  assert.equal(tooltips, 2, 'both seats speak the promise');
  // the confirm label names the date it bills from
  assert.ok(platform.includes('`Confirm — bill from ${formatDate(s.trial_end)}`'), 'the confirm label names the date');
  // the honest error line: the room says what happened
  assert.ok(platform.includes('{convertError && ('), 'the error line exists');
  assert.ok(platform.includes('<p role="alert" className="text-sm text-[#B42318]">'), 'the error speaks in the house\u2019s urgent ink');
});

test('unit347 · the audit rides along — the room can retell the conversion', () => {
  assert.ok(api.includes("action: 'subscription.trial_converted',"), 'the verb stands');
  assert.ok(api.includes('[convert] audit insert failed:'), 'best-effort, honestly warned');
  assert.ok(api.includes("actor_email: user?.email || 'platform@servepoint.app'"), 'the actor fallback');
  // the details carry the business and the from-date
  assert.ok(api.includes("/mo from the trial's end`"), 'the details speak the from-date');
});

test('unit347 · the neighbours stand byte-still', () => {
  // the belt keeps its seven columns — the door lives INSIDE the cell
  // (search from the caption: the businesses room wears the same v5.287
  // mobile-cards comment, so the needle must start at THIS belt)
  const capAt = platform.indexOf('<caption className="sr-only">All business subscriptions</caption>');
  const beltEnd = platform.indexOf('Mobile stacked cards', capAt);
  const belt = platform.slice(capAt, beltEnd);
  const cols = belt.split('<th scope="col"').length - 1;
  assert.equal(cols, 7, 'the belt keeps its seven columns');
  // the 5.307 MRR law untouched (active-only, the census, the hint family)
  assert.match(platform, /\.filter\(\(s\) => s\.status === 'active'\)\n        \.reduce\(\(sum, s\) => sum \+ \(s\.final_monthly_rate \|\| 0\), 0\)/);
  assert.ok(platform.includes("() => (subs ?? []).filter((s) => s.status === 'active').length,"), 'the census untouched');
  // the 5.304 clock family import stands
  assert.ok(platform.includes("import { daysUntil, planLabel, subscriptionWords, trialBucket, trialRelWords } from '../../lib/billing';"), 'the clock family import');
  // the thin projection stands
  assert.ok(platform.includes('function billingCell(s: Subscription) {\n  return subscriptionWords(s);\n}'), 'the thin projection stands');
});

test('unit347 · the feature names itself and the version law holds', () => {
  assert.match(platform, /the conversion door's hands/);
  assert.match(platform, /no dialogs, counter-tablet hands/);
  for (const [name, src] of [['api', api], ['platform', platform]]) {
    assert.ok(src.includes('v5.308.0'), `${name} stamps its release`);
  }
  const v = version.match(/export const APP_VERSION = '([^']+)';/);
  const s = sw.match(/const VERSION = "servepoint-v([^-]+)-r(\d+)"/);
  assert.ok(v, 'version.ts must speak APP_VERSION');
  assert.ok(s, 'sw.js must bake the cache word');
  assert.equal(v[1], s[1], 'the two words must agree');
  assert.equal(v[1], '5.308.0');
});
