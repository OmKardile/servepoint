/* unit323 — v5.284.0 "the search learns the phone" (agreement shape)
 * The fresh-eyes QA walk found the finding at the device the QR menu
 * actually lives on: the menu header's search row held search + Veg +
 * languages in ONE flex line, and at 390px the two shrink-0 neighbours
 * squeezed the flex-1 field to a seven-pixel whisper — "Se" was all the
 * placeholder could say (the before screenshot: scripts/qa323-menu-phone.png).
 * THE ROUND, two halves:
 *   1. THE FIX — the field takes its OWN row on narrow screens
 *      (flex-wrap + w-full; the filters follow below) and returns to the
 *      single line at sm+ (the desktop look byte-untouched);
 *      sm:min-w-0 keeps it honest at every width between.
 *   2. THE FEATURE — the field learned to let go: a non-empty query grows
 *      a one-tap clear ✕ (32px hit, the guest's word in all three
 *      languages) that empties AND refocuses; the house's own ✕ grammar —
 *      the webkit cancel hidden, the custom button speaking — the same
 *      register Header/Notifications/Inventory/Messages already wear; the
 *      text never runs under the ✕ (pr-11 while it speaks, pr-4 when it
 *      rests). */

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

const guest = read('src/components/guest/GuestPages.tsx');
const i18n = read('src/lib/guest-i18n.ts');
const version = read('src/version.ts');
const sw = read('public/sw.js');

test('unit323 · the wrap law — the search row takes its own row on the phone, the filters follow', () => {
  // the container learned to wrap
  assert.match(guest, /mx-auto mt-4 flex max-w-xl flex-wrap items-center gap-2/);
  // the old single-line grammar is retired (no non-wrap twin left)
  assert.doesNotMatch(
    guest,
    /mx-auto mt-4 flex max-w-xl items-center gap-2/,
    'the crushing one-line row must be gone'
  );
  // the field's responsive shape: full row on the phone, flex-1 at sm+,
  // min-w-0 so it can always shrink WITHIN its own space
  assert.match(guest, /className="relative w-full sm:w-auto sm:flex-1 sm:min-w-0"/);
});

test('unit323 · the clear affordance — the field lets go in one tap, the house ✕ grammar', () => {
  // the webkit native cancel is hidden (the same byte the four staff
  // search inputs wear) — one ✕, never two
  assert.match(guest, /\[&::-webkit-search-cancel-button\]:hidden/);
  assert.match(guest, /\[&::-webkit-search-decoration\]:hidden/);
  // the custom ✕ exists only while the query speaks, is the guest's word,
  // and empties AND refocuses
  const clearBlock = guest.match(/\{query\.length > 0 && \(\s*\n\s*<button[\s\S]*?<\/button>\s*\n\s*\)\}/);
  assert.ok(clearBlock, 'the conditional clear button block must exist');
  assert.match(clearBlock[0], /aria-label=\{t\('searchClear'\)\}/);
  assert.match(clearBlock[0], /title=\{t\('searchClear'\)\}/);
  assert.match(clearBlock[0], /setQuery\(''\);/);
  assert.match(clearBlock[0], /searchInputRef\.current\?\.focus\(\);/);
  // a real hit target: h-8 w-8 (32px), never a 12px crumb
  assert.match(clearBlock[0], /h-8 w-8/);
  // the ref is a real state handle on the input
  assert.match(guest, /ref=\{searchInputRef\}/);
  assert.match(guest, /const searchInputRef = useRef<HTMLInputElement>\(null\);/);
  // the text never runs under the ✕ — the room is rented only while it speaks
  assert.match(guest, /query\.length > 0 \? 'pr-11' : 'pr-4'/);
});

test('unit323 · the three-language promise — the clear word speaks in all three dicts', () => {
  const en = i18n.match(/searchClear: '([^']+)'/);
  const all = i18n.match(/searchClear:/g) || [];
  assert.equal(all.length, 3, `searchClear must live in all three dicts, found ${all.length}`);
  assert.equal(en[1], 'Clear search');
  assert.match(i18n, /searchClear: 'खोज साफ़ करें'/);
  assert.match(i18n, /searchClear: 'ಹುಡುಕಾಟ ತೆರವುಗೊಳಿಸಿ'/);
});

test('unit323 · the ✕ register is a FAMILY — the four staff search inputs keep their own grammar', () => {
  const homes = [
    'src/components/shell/Header.tsx',
    'src/components/notifications/NotificationsScreen.tsx',
    'src/components/inventory/InventoryScreen.tsx',
    'src/components/messages/MessagesScreen.tsx',
  ];
  for (const h of homes) {
    assert.match(
      read(h),
      /\[&::-webkit-search-cancel-button\]:hidden/,
      `${h} must keep the house ✕ grammar`
    );
  }
});

test("unit323 · the doctrine stands — the menu's live machinery untouched by the row", () => {
  // the session ribbon, the warm/ended verdicts and the one 1s tick keep
  // their posts (the row is presentation; the window arithmetic is law)
  assert.match(guest, /function SessionRibbon\(/);
  assert.match(guest, /const windowEnded = msLeft !== null && msLeft <= 0;/);
  assert.match(guest, /const windowWarmMs = msLeft !== null && msLeft > 0 && msLeft < WARM_WINDOW_MS \? msLeft : null;/);
  // the filtered search still matches name + description (the one query rule)
  assert.match(
    guest,
    /`\$\{i\.name\} \$\{i\.description \|\| ''\}`\.toLowerCase\(\)\.includes\(q\)/
  );
  // the honest empty states stand (three words, three situations)
  assert.match(guest, /t\('nothingMatchesVeg', \{ q: query \}\)/);
  assert.match(guest, /t\('vegEmpty'\)/);
  assert.match(guest, /t\('nothingMatches', \{ q: query \}\)/);
});

test('unit323 · the version law — version.ts and sw.js carry the same word', () => {
  const v = version.match(/export const APP_VERSION = '([^']+)';/);
  const s = sw.match(/const VERSION = "servepoint-v([^-]+)-r(\d+)"/);
  assert.ok(v, 'version.ts must speak APP_VERSION');
  assert.ok(s, 'sw.js must bake the cache word');
  assert.equal(v[1], s[1], 'the two words must agree');
  assert.equal(v[1], '5.284.0');
});
