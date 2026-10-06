/* unit320 — v5.281.0 "the diagnostics speak a pinned shape" (agreement shape)
 * The census finding (the parked hygiene item, finally home): the support
 * report's diagnostics block — the block a staffer pastes into a ticket —
 * printed its timestamp with `new Date().toString()`, the engine's own
 * grammar: "Mon Oct 06 2026 14:15:32 GMT+0800 (China Standard Time)" here,
 * a different shape on the next tablet. The doctrine was never the
 * problem — support's wall clock BELONGS to the device it diagnoses (the
 * bills/KDS family), and the block's `release` line already read the
 * service worker's cache word — but the SHAPE was unpinned, and the block
 * said "screen: Support" as a hardcoded word on a router that knows better.
 * THE ROUND: the when line speaks the house's en-IN · hour12:false shape
 * on the DEVICE'S OWN clock (no timeZone pinned — the doctrine kept), a
 * when-utc line adds the machine-readable ISO twin, `route:` replaces the
 * hardcoded screen word with the router's own truth, and a `language:`
 * line answers "what language was the device holding?" — the first
 * question of every guest-twin bug. The textarea becomes monospace the
 * moment the diagnostics land (the bare form stays a plain writing
 * surface). The census walk: zero `new Date().toString()` anywhere in
 * src/ — the last engine-grammar render is retired. */

import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(`/home/z/my-project/${p}`, 'utf8');
const walk = (dir, acc = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(tsx?|mjs)$/.test(e.name)) acc.push(p);
  }
  return acc;
};

const support = read('src/components/support/SupportScreen.tsx');
const version = read('src/version.ts');
const sw = read('public/sw.js');

test('unit320 · the shape is pinned — en-IN, hour12:false, and NO timeZone (the device keeps its own clock)', () => {
  assert.match(support, /const DIAG_CLOCK = new Intl\.DateTimeFormat\('en-IN', \{/);
  assert.match(support, /hour12: false,/);
  // the doctrine: no timeZone key in DIAG_CLOCK — the diagnostics speak the
  // device's own wall clock in the house's shape ("(device clock)" says so)
  const clockBlock = support.match(/const DIAG_CLOCK = new Intl\.DateTimeFormat\('en-IN', \{[\s\S]*?\n\}\);/);
  assert.ok(clockBlock, 'DIAG_CLOCK block must exist');
  assert.doesNotMatch(clockBlock[0], /timeZone/, 'DIAG_CLOCK must NOT pin a timeZone — the device keeps its own clock');
  assert.match(support, /\(device clock\)/);
});

test('unit320 · the engine grammar is retired — no new Date().toString() anywhere in src/', () => {
  const files = walk('/home/z/my-project/src');
  const offenders = files.filter((f) => read(f.replace('/home/z/my-project/', '')).includes('new Date().toString()'));
  assert.deepEqual(offenders, [], `engine-grammar renders remain: ${offenders.join(', ')}`);
});

test('unit320 · the machine-readable twin — when-utc speaks ISO 8601', () => {
  assert.match(support, /`when-utc: \$\{new Date\(\)\.toISOString\(\)\}`/);
});

test('unit320 · the route is the router\'s truth — the hardcoded screen word is gone', () => {
  assert.match(support, /`route: \$\{window\.location\.pathname\}`/);
  assert.doesNotMatch(support, /`screen: Support`/);
});

test('unit320 · the language line — the first question of every guest-twin bug', () => {
  assert.match(support, /`language: \$\{navigator\.language\}`/);
});

test('unit320 · the block keeps its honesty — release from the SW, the idempotent split markers', () => {
  assert.match(support, /const DIAG_BEGIN = '— ServePoint diagnostics —';/);
  assert.match(support, /const DIAG_END = '— end diagnostics —';/);
  assert.match(support, /caches\.keys\(\)/);
  assert.match(support, /d\.message\.split\(DIAG_BEGIN\)\[0\]/, 're-attaching refreshes, never stacks');
});

test('unit320 · the styling register — the surface speaks the block\'s language once it lands', () => {
  // the bare form is a plain writing surface; with diagnostics attached it
  // becomes monospace with a taller line and tabular digits
  assert.match(support, /diagAttached \? 'font-mono text-\[12\.5px\] leading-relaxed tabular-nums' : ''/);
});

test('unit320 · the doctrine stands — the device-day family untouched', () => {
  // appday's two-clock doctrine docstring stays (the census read it in 305)
  const appday = read('src/lib/appday.ts');
  assert.ok(appday.length > 500, 'appday still carries its doctrine');
  // no timezone import crept into the support screen — the device keeps its clock
  assert.doesNotMatch(support, /from '\.\.\/\.\.\/lib\/appday'/);
});

test('unit320 · the version law — version.ts and sw.js carry the same word', () => {
  const v = version.match(/export const APP_VERSION = '([^']+)';/);
  const s = sw.match(/const VERSION = "servepoint-v([^-]+)-r(\d+)"/);
  assert.ok(v, 'version.ts must speak APP_VERSION');
  assert.ok(s, 'sw.js must bake the cache word');
  assert.equal(v[1], s[1], 'the two words must agree');
  assert.equal(v[1], '5.281.0');
});
