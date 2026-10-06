/* unit326 — v5.287.0 "the console's tables learn their belt" (agreement shape)
 * The round's lens: the Platform console at the NARROW axis — 768 tablet
 * portrait, a band no recent round had walked (the phone 390 and the porch
 * 320 were walked; the console's own tables were not). THE FINDING, at
 * /businesses and /subscriptions: both desktop tables' cards spoke
 * `hidden overflow-hidden md:block` while the rail ate 228px at that same
 * breakpoint — measured live at 768: 474px of card vs 696px of table, so
 * Status/Created (businesses) and Final rate/Status/Next charge
 * (subscriptions) clipped SILENTLY: no scrollbar, no ellipsis, columns
 * that simply did not exist. THE FIX (the belt): the stacked cards —
 * already proven live at the phone — own everything below lg; the tables
 * own lg and above; and each table wears an inner overflow-x-auto belt
 * (the EOD escape's own convention, EodScreen's wide-table wrapper) so any
 * future crunch degrades to a scroll, never a silent clip. THE FEATURE
 * (the handover): the businesses table's owner-email cell learns to copy —
 * CopyValueButton rides beside the truncated address with stopRowClick (the
 * row's expand must not fire), one tap hands the email to the clipboard
 * through the house's ONE copy breath (useCopyAck, v5.277.0) — zero new
 * clipboard code. */

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(`/home/z/my-project/${p}`, 'utf8');

const platform = read('src/components/platform/PlatformScreen.tsx');
const eod = read('src/components/eod/EodScreen.tsx');
const css = read('src/index.css');
const version = read('src/version.ts');
const sw = read('public/sw.js');

const count = (hay, needle) => hay.split(needle).length - 1;

test('unit326 · the crossover climbs — the cards own below lg, the tables own lg+', () => {
  // both desktop tables crossed at once — no half-climbed pair
  assert.equal(
    count(platform, '<div className="sp-card hidden overflow-hidden lg:block">'),
    2,
    'both desktop tables must speak the lg crossover'
  );
  assert.equal(
    count(platform, '<div className="space-y-3 lg:hidden">'),
    2,
    'both stacked-card grammars must climb with their tables'
  );
  // the old pair is fully retired from the screen — no half-climb
  assert.equal(
    count(platform, 'overflow-hidden md:block'),
    0,
    'no md-crossover table may remain'
  );
  assert.equal(
    count(platform, 'space-y-3 md:hidden'),
    0,
    'no md-crossover card stack may remain'
  );
});

test('unit326 · the belt — every desktop table keeps a horizontal escape', () => {
  // the belt's own bytes, once per table
  assert.equal(
    count(platform, 'overflow-x-auto [scrollbar-width:thin]'),
    2,
    'the belt speaks twice — businesses and subscriptions'
  );
  // each belt DIRECTLY wraps its <table — the escape is the table's own
  const belts = platform.split('overflow-x-auto [scrollbar-width:thin]').length - 1;
  assert.equal(belts, 2);
  for (const indent of ['            ', '              ']) {
    const needle = `${indent}<div className="overflow-x-auto [scrollbar-width:thin]">\n${indent}<table className="w-full text-left text-sm">`;
    assert.equal(
      count(platform, needle),
      1,
      'each belt must sit immediately on its table (no drift between them)'
    );
  }
  // the convention it rides: the EOD escape stands (the house's wide-table law)
  assert.match(eod, /overflow-x-auto/, "the EOD escape's own convention must stand");
  // the quiet register: the scrollbar is thin, not a shout
  assert.match(platform, /\[scrollbar-width:thin\]/);
});

test('unit326 · the handover — the email leaves the row on one tap', () => {
  // the cell keeps its bounds: the td's max-width stays
  assert.match(platform, /<td className="max-w-\[220px\] px-4 py-3\.5 text-\[#6B6B6B\]">/);
  // the quiet flex pair: the address truncates, the verb never squeezes
  assert.match(platform, /<span className="flex items-center gap-1">/);
  assert.match(platform, /<span className="min-w-0 truncate" title=\{t\.owner_email \|\| undefined\}>/);
  // the verb in the row carries stopRowClick — the row's expand must not fire
  assert.match(
    platform,
    /<CopyValueButton value=\{t\.owner_email\} label="Owner email" stopRowClick \/>/,
    'the row verb must opt out of the row click'
  );
  // the detail panel's verb keeps its own shape (no stopRowClick there —
  // the panel is not inside the row)
  assert.match(platform, /label="Owner email" \/>/);
});

test('unit326 · stopRowClick — one optional prop, the expand law untouched', () => {
  assert.match(
    platform,
    /stopRowClick\?: boolean/,
    'the prop is optional — every existing use stays byte-unchanged'
  );
  assert.match(platform, /if \(stopRowClick\) e\.stopPropagation\(\);/);
  // the row's expand still stands: the verb opts out, the row keeps its law
  assert.match(
    platform,
    /onClick=\{\(\) => setExpandedTenantId\(expanded \? null : t\.id\)\}/,
    "the row's own expand handler must remain"
  );
});

test('unit326 · the one copy breath — no new clipboard code', () => {
  // the verb rides the ONE home (v5.277.0); the page hand-rolls nothing
  assert.match(platform, /const \[copied, runCopy\] = useCopyAck\(\);/);
  assert.equal(
    count(platform, 'navigator.clipboard'),
    0,
    'the platform screen must never touch the clipboard directly'
  );
});

test('unit326 · the doctrine stands — ring, rail, and the rest of the house', () => {
  // the global keyboard ring (v5.107.0) still answers every Tab
  assert.match(css, /:where\(button, a, \[role='button'\]/);
  assert.match(css, /outline: 2px solid var\(--sp-gold\);/);
  // the rail keeps its OWN crossover — the belt is table-local, not a global md→lg sweep
  assert.match(platform, /md:w-\[228px\]/);
  assert.match(platform, /md:w-\[228px\] md:px-3/);
});

test('unit326 · the cards keep their words — no data lost to the crossover', () => {
  // the businesses card stack still ends in the shared detail fields
  // (the copy verbs for email + business id live there for BOTH grammars)
  assert.match(platform, /const renderBusinessDetailFields = \(t: Tenant\) =>/);
  assert.match(platform, /<dt className="text-\[11px\] font-medium uppercase tracking-wide text-\[#969696\]">Owner email<\/dt>/);
  // the subscriptions cards still speak all seven words (business, status,
  // plan, cycle, price, final rate, next charge)
  assert.match(platform, /<dt className="text-\[#969696\]">Final rate<\/dt>/);
  assert.match(platform, /<dt className="text-\[#969696\]">Next charge<\/dt>/);
  assert.match(platform, /<dt className="text-\[#969696\]">Billing cycle<\/dt>/);
});

test('unit326 · the version law — version.ts and sw.js carry the same word', () => {
  const v = version.match(/export const APP_VERSION = '([^']+)';/);
  const s = sw.match(/const VERSION = "servepoint-v([^-]+)-r(\d+)"/);
  assert.ok(v, 'version.ts must speak APP_VERSION');
  assert.ok(s, 'sw.js must bake the cache word');
  assert.equal(v[1], s[1], 'the two words must agree');
  /* the literal moved to the current round's unit (the unit308 precedent,
   * followed by 321→322→323→324→325→326): this suite asserts the AGREEMENT, not the age. */
});
