/* unit322 — v5.283.0 "the day-month keeps one shape, the tenure rides the
 * reporting day" (agreement shape)
 * The census finding: the DEVICE-day family's day-month voice — "6 Oct",
 * `en-IN · day:'numeric' · month:'short'` — was rolled by hand in SIX
 * render sites across FOUR files (the food shelf's last-seen, the guests
 * book's when-words ×2 surfaces, the messages dividers and full stamp, the
 * inventory stocktake note's default name ×2), each spelling the same
 * option objects by hand; the guests book's today-branch also let the ICU
 * default answer for hour12 (an unpinned OPTION, if not an unpinned
 * clock); and the Dashboard's team card named a DB enrollment instant with
 * `en-GB` and NO timezone at all — a month-boundary drift that reads
 * "Nov 2025" on an IST tablet and "Oct 2025" on a UTC-8 one. THE ROUND:
 * lib/appday gains the device-day shape voices — deviceDayTag,
 * deviceDayFullTag, deviceClockWord — pinning the SHAPE (en-IN, the
 * options spelled once) and pinning NO timezone, because the doctrine
 * hands those surfaces the DEVICE's wall clock ("a cashier's wall clock
 * belongs to the device they hold") and a timezone here would silently
 * move them onto the reporting day — the diary's one-clock lesson
 * (v5.266.0) from the other side. appFormatters gains monthYear — the
 * tenure voice riding the REPORTING day (timeZone: tz), the team card's
 * en-GB drift closed. The standing registers are named and left: the two
 * weekday voices (bookingDayTag, appTzTag) keep their deliberate en-GB
 * short names, and api.ts's report anchors keep their UTC-pinned keys. */

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

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const appday = read('src/lib/appday.ts');
const food = read('src/components/food/FoodDrinksScreen.tsx');
const customers = read('src/components/customers/CustomersScreen.tsx');
const messages = read('src/components/messages/MessagesScreen.tsx');
const inventory = read('src/components/inventory/InventoryScreen.tsx');
const api = read('src/lib/api.ts');
const version = read('src/version.ts');
const sw = read('public/sw.js');

test('unit322 · deviceDayTag is the ONE device-day day-month voice — the shape pinned, the clock NOT', () => {
  assert.match(appday, /export function deviceDayTag\(iso: string\): string \{/);
  // the one-spelling body: en-IN, day numeric, month short
  assert.match(
    appday,
    /return new Intl\.DateTimeFormat\('en-IN', \{ day: 'numeric', month: 'short' \}\)\.format\(new Date\(iso\)\);/
  );
  // THE DOCTRINE ASSERT: the voice pins NO timezone — handing one a tz
  // would silently move a device-day surface onto the reporting day
  const body = appday.match(/export function deviceDayTag[\s\S]*?\n\}/)[0];
  assert.doesNotMatch(body, /timeZone/, 'deviceDayTag must NOT pin a timezone');
  // the docstring tells the doctrine why (the cashier's wall clock)
  assert.match(appday, /a cashier's wall clock belongs to\s*\n?\s*\* the device they hold/);
  assert.match(appday, /the diary's one-clock lesson\s*\(v5\.266\.0\) from the other\s*\n?\s*\* side|one-clock lesson/);
});

test('unit322 · deviceDayFullTag adds the year; deviceClockWord says hour12 OUT LOUD', () => {
  assert.match(appday, /export function deviceDayFullTag\(iso: string\): string \{/);
  assert.match(appday, /day: 'numeric',\s*\n\s*month: 'short',\s*\n\s*year: 'numeric',/);
  const fullBody = appday.match(/export function deviceDayFullTag[\s\S]*?\n\}/)[0];
  assert.doesNotMatch(fullBody, /timeZone/, 'deviceDayFullTag must NOT pin a timezone');
  assert.match(appday, /export function deviceClockWord\(iso: string\): string \{/);
  assert.match(appday, /hour: 'numeric',\s*\n\s*minute: '2-digit',\s*\n\s*hour12: true,/);
  const clockBody = appday.match(/export function deviceClockWord[\s\S]*?\n\}/)[0];
  assert.doesNotMatch(clockBody, /timeZone/, 'deviceClockWord must NOT pin a timezone');
});

test('unit322 · appFormatters.monthYear — the tenure voice rides the REPORTING day', () => {
  assert.match(appday, /monthYear: Intl\.DateTimeFormat;/);
  assert.match(
    appday,
    /monthYear: new Intl\.DateTimeFormat\('en-IN', \{\s*\n\s*timeZone: tz,\s*\n\s*month: 'short',\s*\n\s*year: 'numeric',\s*\n\s*\}\),/
  );
  // the docstring names the reporting day and the team card
  assert.match(appday, /the tenure voice \(v5\.283\.0\): the team card's since/);
  assert.match(appday, /Rides the REPORTING day/);
});

test('unit322 · the census law — no hand-rolled day-month or device clock renders in the components', () => {
  const files = walk('/home/z/my-project/src/components');
  const offenders = [];
  for (const f of files) {
    const rel = f.replace('/home/z/my-project/', '');
    const code = stripComments(read(rel));
    const hits =
      (code.match(/toLocaleDateString\(/g) || []).length +
      (code.match(/toLocaleTimeString\(/g) || []).length;
    if (hits > 0) offenders.push(`${rel} ×${hits}`);
  }
  assert.deepEqual(offenders, [], `hand-rolled date renders remain in components: ${offenders.join(', ')}`);
  // the lib owns the shape now; en-GB's month-year drift is retired from api
  assert.doesNotMatch(stripComments(api), /en-GB/, 'the team card must not speak en-GB');
  assert.match(api, /appFormatters\(\)\.monthYear\.format\(new Date\(e\.created_at\)\)/);
  // the walk's own widening (the 318/319/320 precedent): day.ts's LOCAL
  // branch — the seventh site, a lib the component walk never reached —
  // rides deviceDayTag now; only the two lib homes may spell the shape:
  // appday (the voice itself) and day.ts's tz-PARAMETERIZED branch (a
  // per-zone formatter the caller's word drives — cannot ride a fixed
  // cache)
  const day = read('src/lib/day.ts');
  assert.match(day, /import \{ deviceDayTag \} from '\.\/appday';/);
  assert.match(day, /return deviceDayTag\(iso\);/);
  const dayCode = stripComments(day);
  const daySpells = (dayCode.match(/new Intl\.DateTimeFormat\('en-IN', \{ day: 'numeric', month: 'short' \}\)/g) || []).length;
  assert.equal(daySpells, 0, "day.ts's local branch must ride deviceDayTag, not hand-spell");
  const dayTzSpell = (dayCode.match(/new Intl\.DateTimeFormat\('en-IN', \{ day: 'numeric', month: 'short', timeZone: tz \}\)/g) || []).length;
  assert.equal(dayTzSpell, 1, 'the tz-parameterized register stands — one per-zone formatter');
});

test('unit322 · the adopters ride the lib — one import edge per file', () => {
  assert.match(food, /import \{ deviceDayTag \} from '\.\.\/\.\.\/lib\/appday';/);
  assert.match(food, /return deviceDayTag\(iso\);/);
  assert.match(
    customers,
    /import \{ appStampLabel, appTodayIso, appFormatters, appTzTag, deviceClockWord, deviceDayTag, lastNDaysMs \} from '\.\.\/\.\.\/lib\/appday';/
  );
  assert.match(customers, /`today \$\{deviceClockWord\(ts\)\}`/);
  assert.match(customers, /return deviceDayTag\(ts\);/);
  assert.match(messages, /import \{ deviceClockWord, deviceDayFullTag, deviceDayTag \} from '\.\.\/\.\.\/lib\/appday';/);
  assert.match(messages, /return deviceDayFullTag\(iso\);/);
  assert.match(messages, /const clockLabel = \(iso: string\): string => deviceClockWord\(iso\);/);
  assert.match(messages, /\? 'Yesterday'\s*\n\s*: deviceDayTag\(iso\);/);
  assert.match(inventory, /import \{ appTodayIso, appFormatters, appTzTag, deviceDayTag \} from '\.\.\/\.\.\/lib\/appday';/);
  assert.match(inventory, /`Stocktake — \$\{deviceDayTag\(new Date\(\)\.toISOString\(\)\)\}`/g);
});

test('unit322 · the standing registers are named — the weekday voices and the parse engine keep their deliberate en-GB', () => {
  // en-GB appears in exactly THREE lib homes, all deliberate, none a
  // month-year render voice: the two weekday SHORT-NAME registers
  // (bookingDayTag, appTzTag) and day.ts's partsIn PARSE ENGINE (a
  // formatToParts y/m/h/m extractor, never shown to a human)
  const files = walk('/home/z/my-project/src');
  const gbHomes = [];
  for (const f of files) {
    const rel = f.replace('/home/z/my-project/', '');
    const code = stripComments(read(rel));
    if (/en-GB/.test(code)) gbHomes.push(rel);
  }
  assert.deepEqual(
    gbHomes.sort(),
    ['src/lib/appday.ts', 'src/lib/bookingday.ts', 'src/lib/day.ts'],
    `en-GB must live only in the three named homes, found: ${gbHomes.join(', ')}`
  );
  // each keeps its shape and its documented why
  const booking = read('src/lib/bookingday.ts');
  assert.match(booking, /en-GB parts — the weekday rides/);
  assert.match(appday, /en-GB/); // appTzTag's weekday voice
  const day = read('src/lib/day.ts');
  assert.match(day, /hourCycle: 'h23',/, 'partsIn is the parse engine, not a voice');
});

test('unit322 · the doctrine stands — the tz-pinned family untouched, the booking clock untouched', () => {
  // appFormatters' reporting voices still pin the timezone
  assert.match(appday, /dt: new Intl\.DateTimeFormat\('en-IN', \{\s*\n\s*timeZone: tz,/);
  assert.match(appday, /dayLabel: new Intl\.DateTimeFormat\('en-IN', \{\s*\n\s*timeZone: tz,/);
  assert.match(appday, /export function appStampLabel\(iso: string, tz: string = appTimezone\(\)\): string \{/);
  // the booking lib's own voices stand (the diary's one clock, v5.266.0)
  const booking = read('src/lib/bookingday.ts');
  assert.match(booking, /export function bookingClockLabel\(iso: string\): string \{/);
  assert.match(booking, /hour12: false,/);
  assert.match(booking, /export function bookingDayTag\(iso: string\): string \{/);
});

test('unit322 · the styling register — the day grammar\'s digits hold still', () => {
  // the guests book's Last ticket cell and the drawer's order meta rows
  assert.match(customers, /text-\[12\.5px\] font-semibold tabular-nums text-\[#1A1A1A\]">\{fmtWhen\(s\?\.last_visit_at \?\? null\)\}/);
  assert.match(customers, /text-\[11\.5px\] tabular-nums text-\[#969696\]">\s*\n\s*<span>\s*\n\s*\{fmtWhen\(o\.created_at\)\}/);
  // the food shelf's regular-guest meta line (visits · ₹ · last seen)
  assert.match(food, /text-\[11\.5px\] tabular-nums text-\[#6B6B6B\]/);
});

test('unit322 · the version law — version.ts and sw.js carry the same word', () => {
  const v = version.match(/export const APP_VERSION = '([^']+)';/);
  const s = sw.match(/const VERSION = "servepoint-v([^-]+)-r(\d+)"/);
  assert.ok(v, 'version.ts must speak APP_VERSION');
  assert.ok(s, 'sw.js must bake the cache word');
  assert.equal(v[1], s[1], 'the two words must agree');
  assert.equal(v[1], '5.283.0');
});
