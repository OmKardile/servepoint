/* unit348 — v5.309.0 "the money room learns the hunt" (agreement shape)
 * The house's own law (5.288 audit, 5.289 businesses): every room that
 * lists things learns to hunt. The Subscriptions room was the last
 * listing room without the hunt — rows spoke, the belt grew the 5.308
 * door, but the operator could not narrow three rows to the one that
 * mattered. THE FEATURE: the room's own query (business, plan, cycle)
 * and its status census read from the ROWS themselves (no invented
 * statuses, loudest first, ties alphabetical), composing exactly as the
 * businesses room's composes; the "N of M" count words; the no-match
 * card that names what was actually hunted. THE MRR PILL STAYS THE
 * WHOLE-BOOK NUMBER — the hunt narrows the rows, never the revenue. */

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(`/home/z/my-project/${p}`, 'utf8');

const platform = read('src/components/platform/PlatformScreen.tsx');
const version = read('src/version.ts');
const sw = read('public/sw.js');

test('unit348 · the money room grows its own hunt hands', () => {
  // the state, named in the 5.289 grammar
  assert.ok(platform.includes("const [subQuery, setSubQuery] = useState('');"), 'the query hand');
  assert.ok(platform.includes('const [subStatus, setSubStatus] = useState<string | null>(null);'), 'the census hand');
  // the census reads the rows themselves — no invented statuses
  assert.match(platform, /v5\.309\.0 — the money room learns the hunt/);
  assert.ok(platform.includes('for (const s of subs ?? [])'), 'the census counts the rows');
  assert.ok(platform.includes(".sort((a, b) => b.count - a.count || a.status.localeCompare(b.status));"), 'loudest first, ties alphabetical');
});

test('unit348 · the search composes with the census — AND, never either-or', () => {
  // the filter: census AND query, the businesses room's own shape
  assert.ok(platform.includes('(subStatus === null || s.status === subStatus) &&'), 'the census arm');
  // the money room's fields: business (through the id map), plan, cycle
  assert.ok(platform.includes("(tenantNameById.get(s.tenant_id) || '').toLowerCase().includes(q) ||"), 'the business arm');
  assert.ok(platform.includes('s.plan_id.toLowerCase().includes(q) ||'), 'the plan arm');
  assert.ok(platform.includes('s.billing_cycle.toLowerCase().includes(q))'), 'the cycle arm');
  // the dep array carries all three hands
  assert.ok(platform.includes('[subs, subQuery, subStatus, tenantNameById]'), 'the deps speak the composition');
});

test('unit348 · the MRR pill stays the whole-book number', () => {
  // the pill reads mrr — which the 5.307 law computes over ALL rows
  assert.ok(platform.includes('aria-label={`Monthly recurring revenue ${formatMoney(mrr)}`}'), 'the pill speaks mrr');
  // the hunt never touches the revenue arithmetic: no reduce/filter
  // revenue math rides the filtered rows anywhere in the room
  assert.ok(!platform.includes('filteredSubs.reduce'), 'no filtered revenue sum');
  assert.ok(!platform.includes('filteredSubs.filter'), 'no filtered revenue census');
  // the room's ONLY use of the filtered rows for money-adjacent shape is
  // the rows binding — the pill's own markup names no filtered source
  const pill = platform.slice(platform.indexOf('aria-label={`Monthly recurring revenue'), platform.indexOf('aria-label={`Monthly recurring revenue') + 400);
  assert.ok(!pill.includes('filteredSubs'), 'the pill markup is whole-book');
});

test('unit348 · the belt and the cards hunt — both shapes, one truth', () => {
  // the single rows binding rides the filtered derivation
  assert.ok(platform.includes('const rows = filteredSubs;'), 'the rows binding');
  // and the belt + cards keep their seats (the door lives INSIDE them)
  assert.ok(platform.includes("{rows.map((s) => (\n                    <tr key={s.id}"), 'the belt hunts');
  assert.ok(platform.includes('{rows.map((s) => (\n                <div key={s.id} className="sp-card p-4">'), 'the cards hunt');
});

test('unit348 · the no-match card names the hunt', () => {
  // the hunt words: the status chip and the query, joined like the 5.289 law
  assert.ok(platform.includes("subStatus !== null ? `the status “${subStatus}”` : '',"), 'the chip word');
  assert.ok(platform.includes("subNeedle ? `“${subNeedle}”` : '',"), 'the query word');
  // the card: honest title + the fields named for the retreating hand
  assert.ok(platform.includes('title="No subscriptions match"'), 'the card exists');
  assert.ok(platform.includes('No subscriptions match ${subHuntWords}. Try a different business, plan or cycle.'), 'the body names the hunt');
  // the whole-book empty state keeps its own words (no match ≠ no book)
  assert.ok(platform.includes('title="No subscriptions yet"'), 'the empty book keeps its card');
});

test('unit348 · the census chips ride the ONE grammar — zero drift', () => {
  // the same constants the businesses room speaks — no new chip CSS
  const chips = platform.split('subStatus === status ? HUNT_CHIP_ACTIVE : HUNT_CHIP_IDLE').length - 1;
  assert.equal(chips, 1, 'the status chip rides the shared constant');
  assert.ok(platform.includes('subStatus === null ? HUNT_CHIP_ACTIVE : HUNT_CHIP_IDLE'), 'the All chip rides it too');
  // the toggle-off law: a second tap releases the chip
  assert.ok(platform.includes('setSubStatus(subStatus === status ? null : status)'), 'the toggle-off law');
  // the group's aria names the room
  assert.ok(platform.includes('aria-label="Filter the subscriptions by status"'), 'the group is named');
});

test('unit348 · the neighbours stand byte-still', () => {
  // the 5.308 door keeps its seat inside the hunted rows
  assert.ok(platform.includes("s.status === 'trialing' && s.trial_end && ("), 'the door stands');
  assert.ok(platform.includes('`Confirm — bill from ${formatDate(s.trial_end)}`'), 'the two-click words stand');
  // the 5.307 MRR law untouched (active-only reduce + census + hint family)
  assert.match(platform, /\.filter\(\(s\) => s\.status === 'active'\)\n        \.reduce\(\(sum, s\) => sum \+ \(s\.final_monthly_rate \|\| 0\), 0\)/);
  assert.ok(platform.includes("() => (subs ?? []).filter((s) => s.status === 'active').length,"), 'the census untouched');
  // the businesses hunt keeps its own bytes (the older sibling untouched)
  assert.ok(platform.includes('const [businessQuery, setBusinessQuery] = useState(\'\');'), 'the businesses query stands');
  assert.ok(platform.includes('placeholder="Search name, slug, city"'), 'the businesses search stands');
  // the belt keeps its seven columns
  const capAt = platform.indexOf('<caption className="sr-only">All business subscriptions</caption>');
  const beltEnd = platform.indexOf('Mobile stacked cards', capAt);
  const cols = platform.slice(capAt, beltEnd).split('<th scope="col"').length - 1;
  assert.equal(cols, 7, 'the belt keeps its seven columns');
});

test('unit348 · the version law — the two words agree at 5.309.0', () => {
  assert.match(platform, /v5\.309\.0 — the money room's own hunt hands/);
  const v = version.match(/export const APP_VERSION = '([^']+)';/);
  const s = sw.match(/const VERSION = "servepoint-v([^-]+)-r(\d+)"/);
  assert.ok(v, 'version.ts must speak APP_VERSION');
  assert.ok(s, 'sw.js must bake the cache word');
  assert.equal(v[1], s[1], 'the two words must agree');
  assert.equal(v[1], '5.309.0');
});
