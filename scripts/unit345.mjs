/* unit345 — v5.306.0 "the strip's rows become doors" (agreement shape)
 * Task 344 made the dashboard's KPI cards doors; the Recent businesses
 * strip right below them stayed dead paint — the only exit was the
 * "View all" link. THE FEATURE: each strip row is now a button that opens
 * the businesses room AT that very business — landed in the state that
 * makes the row true: the named business VISIBLE (the hunt reset — a
 * filtered room could hide the very row the operator clicked) and
 * EXPANDED (the details panel open), then the room's own setTab carries
 * the URL sync. THE WORDS (styling): the row keeps its anatomy and its
 * seat — the hover warms to the house's own soft row tone (#F6F5F2, the
 * wizard's row hover) with the tint bleeding a breath past the text so
 * the whole row reads as one target; the global focus ring answers the
 * Tab key. Zero new colors. */

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(`/home/z/my-project/${p}`, 'utf8');

const platform = read('src/components/platform/PlatformScreen.tsx');
const version = read('src/version.ts');
const sw = read('public/sw.js');

test('unit345 · the row door exists and both render shapes stand', () => {
  // the signature grows the optional door — a doorless row is still a div
  assert.match(platform, /\/\* v5\.306\.0 — the row door: when carried, the whole row is a button that/);
  assert.ok(platform.includes('door?: { onClick: () => void; aria: string };'), 'the row\u2019s door prop');
  // the doorless shape keeps the original div byte-shape
  assert.ok(platform.includes('if (!door) return <div className="flex items-center gap-3 py-3.5">{body}</div>;'));
  // the doored shape is a real button with the soft-row hover
  assert.match(platform, /<button\n      type="button"\n      onClick=\{door\.onClick\}\n      aria-label=\{door\.aria\}/);
  assert.ok(
    platform.includes('className="-mx-2 flex w-[calc(100%+16px)] items-center gap-3 rounded-lg px-2 py-3.5 text-left transition-colors duration-150 hover:bg-[#F6F5F2]"'),
    'the hover bleeds a breath past the text — one whole target'
  );
});

test('unit345 · the landing law — visible, expanded, URL-synced', () => {
  // the hunt reset: a filtered room could hide the very row that was clicked
  assert.ok(platform.includes("setBusinessQuery('');"), 'the query resets');
  assert.ok(platform.includes('setBusinessStatus(null);'), 'the census chip resets');
  // the named business opens expanded
  assert.ok(platform.includes('setExpandedTenantId(t.id);'), 'the details panel opens for the named business');
  // the room's own setTab carries the URL sync — no second router
  assert.ok(platform.includes("setTab('businesses');"), 'the rides on setTab');
  // the landing order in the file: reset, reset, expand, navigate
  const q = platform.indexOf("setBusinessQuery('');");
  const s = platform.indexOf('setBusinessStatus(null);', q);
  const e = platform.indexOf('setExpandedTenantId(t.id);', s);
  const n = platform.indexOf("setTab('businesses');", e);
  assert.ok(q > 0 && s > q && e > s && n > e, 'the four moves ride in the honest order');
});

test('unit345 · the aria names the business, never a placeholder when a name exists', () => {
  assert.ok(
    platform.includes('aria: `Open ${t.name || \'business\'} in the businesses room`,'),
    'the row\u2019s own name is the door\u2019s word'
  );
});

test('unit345 · the strip\u2019s anatomy byte-still inside the door', () => {
  // the 5.232 clock clause keeps its exact seat and ink
  assert.ok(
    platform.includes("const trialClause = cell && (sub?.status === 'trialing' || sub?.status === 'trial') && cell.primary !== '—' ? cell.primary : null;"),
    'the trial clause gate untouched'
  );
  assert.ok(platform.includes("{(tenant.name || '?').charAt(0).toUpperCase()}"), 'the avatar initial');
  assert.ok(platform.includes('<SlugChip slug={tenant.slug} />'), 'the slug chip');
  assert.ok(
    platform.includes("cell?.urgent ? 'font-semibold text-[#B42318]' : 'font-medium text-[#6B6B6B]'"),
    'the strip\u2019s urgent ink untouched'
  );
  assert.ok(platform.includes('<StatusChip status={tenant.status} />'), 'the status chip');
});

test('unit345 · zero new colors — the soft row tone is the house\u2019s own', () => {
  // #F6F5F2 was already the wizard\u2019s row hover; the strip borrows it, not invents
  const uses = platform.split('hover:bg-[#F6F5F2]').length - 1;
  assert.ok(uses >= 5, `the tone already lived in this file (now ${uses} uses)`);
  assert.ok(platform.includes('#D9E2DD'), 'the avatar tone stands');
});

test('unit345 · the neighbours stand — the cards and the activity rows byte-still', () => {
  // 344's doors keep their seats
  assert.ok(platform.includes('the cards become doors'), 'the KPI door law comment stands');
  assert.ok(platform.includes("door={{\n                  onClick: () => setTab('subscriptions'),"), 'the money doors untouched');
  // the activity rows were NOT wrapped — they carry the copy verb, a nested
  // button inside a button would be a lie to the DOM
  const activityRows = platform.split('<ActivityRow key={log.id} log={log} />').length - 1;
  assert.equal(activityRows, 1, 'the activity row renders exactly once, undoorable honestly');
  // the View-all exits keep their own seats
  assert.ok(platform.includes('onClick={() => setTab(\'businesses\')}\n                className="text-xs font-semibold text-[#967221] hover:underline"'));
});

test('unit345 · the feature names itself and its law', () => {
  assert.match(platform, /the row door lands the room in the state\n                       \* that makes the row true/);
  assert.match(platform, /the hunt reset — a filtered room could hide the very\n                       \* row the operator clicked/);
  assert.match(platform, /v5\.306\.0/, 'the file stamps its release');
});

test('unit345 · the version law — version.ts and sw.js carry the same word', () => {
  const v = version.match(/export const APP_VERSION = '([^']+)';/);
  const s = sw.match(/const VERSION = "servepoint-v([^-]+)-r(\d+)"/);
  assert.ok(v, 'version.ts must speak APP_VERSION');
  assert.ok(s, 'sw.js must bake the cache word');
  assert.equal(v[1], s[1], 'the two words must agree');
  // v5.307.0 — the version literal relaxed per the unit308 precedent (the
  // 320→…→346 chain): the agreement is the law, the exact word is the
  // newest unit's to pin.
});
