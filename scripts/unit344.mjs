/* unit344 — v5.305.0 "the cards become doors" (agreement shape)
 * The dashboard's four KPI cards were dead paint: they answered the
 * walking questions with numbers and hints, but clicking them did
 * nothing — the operator read the number and then had to find the room
 * themselves. THE FEATURE: each card grows a door — the whole card is a
 * button that opens the room its number speaks for, landed in the state
 * that makes its own number TRUE: Total businesses opens the businesses
 * room with the census reset to All (a filtered room would answer "1 of
 * 2" to a card that said 2); the money cards open the subscriptions room;
 * Trials opens the businesses room at the trial chip the room's OWN
 * census derives (never an invented status word), and without any trial
 * in the data the door honestly forgets the filter. The room's setTab
 * carries the URL sync. THE WORDS (styling): the card keeps its seat and
 * its look — the hairline warms to the sage hover tone, the gold whisper
 * ("View all" ink) appears at the top-right on hover AND keyboard focus,
 * the global focus ring answers the Tab key — zero new colors. */

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(`/home/z/my-project/${p}`, 'utf8');

const platform = read('src/components/platform/PlatformScreen.tsx');
const version = read('src/version.ts');
const sw = read('public/sw.js');

test('unit344 · the door prop exists and the card renders both shapes', () => {
  // the signature grows the door, optional — the card can still be dead paint
  assert.match(platform, /door\?: \{ onClick: \(\) => void; aria: string \};/);
  // the doorless shape keeps its div seat
  assert.ok(platform.includes('if (!door) return <div className="sp-card p-5">{body}</div>;'));
  // the doored shape is a real button with the house's card class
  assert.match(platform, /<button\n      type="button"\n      onClick=\{door\.onClick\}\n      aria-label=\{door\.aria\}/);
  assert.ok(
    platform.includes('className="sp-card group relative block w-full cursor-pointer p-5 text-left transition-colors duration-200 hover:border-[#D9E2DD]"'),
    'the button keeps the card\u2019s look — hairline warms to the sage hover tone'
  );
});

test('unit344 · each door lands the room in the state that makes its number true', () => {
  // Total businesses → the census reset to All — a filtered room would
  // answer "1 of 2" to a card that said 2
  assert.ok(
    platform.includes("onClick: () => {\n                    setBusinessStatus(null);\n                    setTab('businesses');\n                  },\n                  aria: 'Open the businesses room — all businesses',"),
    'the Total door resets the census to All'
  );
  // the money cards → the subscriptions room
  const moneyDoors = platform.split("onClick: () => setTab('subscriptions'),").length - 1;
  assert.equal(moneyDoors, 2, 'Active subscriptions AND MRR both open the subscriptions room');
  assert.ok(platform.includes("aria: 'Open the subscriptions room',"));
});

test('unit344 · the Trials door speaks the room\u2019s own census word, never an invention', () => {
  // the filter word comes from the chips' own derivation — 'trial' or
  // 'trialing' as the data speaks it, null when no trial exists
  assert.ok(
    platform.includes("businessStatuses.find((b) => b.status === 'trial' || b.status === 'trialing')?.status ?? null;"),
    'trialChipStatus derives from the room\u2019s own census'
  );
  assert.ok(
    platform.includes('setBusinessStatus(trialChipStatus);'),
    'the door sets the census\u2019s own word'
  );
  // no trial in the data → the door forgets the filter and says so
  assert.ok(
    platform.includes("setBusinessStatus(null);\n                          setTab('businesses');\n                        },\n                        aria: 'Open the businesses room',"),
    'the doorless-of-trials shape honestly drops the filter'
  );
  assert.ok(platform.includes("aria: 'Open the businesses room filtered to trials',"));
});

test('unit344 · the URL sync rides the room\u2019s own setTab', () => {
  // every door goes through setTab — the history discipline is not re-invented
  assert.equal(platform.split("setTab('businesses')").length >= 5, true, 'the businesses doors ride setTab');
  assert.ok(platform.includes("const setTab = useCallback((next: PlatformTab) => {"), 'the useCallback setTab stands untouched');
});

test('unit344 · the gold whisper — hover AND keyboard focus see the same door', () => {
  // the arrow is the "View all" ink — the room's own affordance color
  assert.ok(platform.includes('import {\n  AlertTriangle,\n  ArrowUpRight,'), 'ArrowUpRight joins the lucide family');
  assert.ok(
    platform.includes('className="absolute right-4 top-4 text-[#967221] opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"'),
    'the whisper appears on hover AND focus, on the house\u2019s transition'
  );
  assert.ok(platform.includes('size={16}\n        aria-hidden'), 'the whisper is decoration — aria-hidden');
  // zero new colors: the two hexes are the app's own
  assert.ok(platform.includes('#967221'), 'the gold ink');
  assert.ok(platform.includes('#D9E2DD'), 'the sage tone');
});

test('unit344 · the neighbours stand — the body and the hints byte-still', () => {
  // the card body kept its anatomy: icon row, the big number, the 5.232/5.304 hint slot
  assert.ok(platform.includes('<p className="mt-4 text-3xl font-bold tracking-tight text-[#1A1A1A]" aria-label={label}>'));
  assert.ok(platform.includes("hintTone === 'urgent' ? 'font-semibold text-[#B42318]' : 'font-medium text-[#969696]'"), 'the 5.304 ink law untouched');
  assert.ok(platform.includes('title={hint}'), 'the tooltip law untouched');
  // the skeletons are still skeletons — not doors
  assert.ok(platform.includes('<KpiSkeleton />'));
  // the "View all" buttons keep their own seats (the doors did not eat them)
  assert.ok(platform.includes("onClick={() => setTab('businesses')}\n                className=\"text-xs font-semibold text-[#967221] hover:underline\""));
});

test('unit344 · the feature names itself and its law', () => {
  assert.match(platform, /the cards become doors/);
  assert.match(platform, /landed in the state that makes its\n               \* own number TRUE/);
  assert.match(platform, /never an invented word/, 'the census-word law named');
  assert.match(platform, /v5\.305\.0/, 'the screen stamps its release');
});

test('unit344 · the version law — version.ts and sw.js carry the same word', () => {
  const v = version.match(/export const APP_VERSION = '([^']+)';/);
  const s = sw.match(/const VERSION = "servepoint-v([^-]+)-r(\d+)"/);
  assert.ok(v, 'version.ts must speak APP_VERSION');
  assert.ok(s, 'sw.js must bake the cache word');
  assert.equal(v[1], s[1], 'the two words must agree');
  assert.equal(v[1], '5.305.0');
});
