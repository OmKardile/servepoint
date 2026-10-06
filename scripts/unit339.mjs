/* unit339 — v5.300.0 "the menu remembers the guest's veg lens" (agreement shape)
 * The candidates audit (the 412×915 Android lens — the most common Android
 * phone, the QR guest's real device, never walked before this round) found
 * the house clean but the menu's memory incomplete: the language pill and
 * the chime each found their per-device home (localStorage), but the veg
 * filter — the FSSAI square-and-dot's own lens — reset on every visit
 * (useState(false)), so a veg-preferring guest re-toggled it every time.
 * THE FEATURE: the menu remembers the guest's veg lens — per DEVICE (the
 * language pill's own law, not the cart's per-tab law: a preference is the
 * guest's, not the session's), read at mount, written on every toggle;
 * private mode keeps a session-only lens. THE WORDS: the toggle whispers
 * its convention on hover — "This device remembers your veg filter" in all
 * three guest languages; the aria keeps its function. */

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(`/home/z/my-project/${p}`, 'utf8');

const guest = read('src/components/guest/GuestPages.tsx');
const i18n = read('src/lib/guest-i18n.ts');
const version = read('src/version.ts');
const sw = read('public/sw.js');

const count = (hay, needle) => hay.split(needle).length - 1;

test('unit339 · the lens\u2019 per-device home is born beside the family', () => {
  // the key rides the house's sp.guest.* grammar — one word, no token (per device)
  assert.match(guest, /const VEG_KEY = 'sp\.guest\.veg';/);
  // the reader is the language reader's own shape (try/catch, private mode → false)
  assert.match(guest, /function readVegOnly\(\): boolean \{\n\s*try \{\n\s*return localStorage\.getItem\(VEG_KEY\) === 'on';/);
  // the law names itself and its kin
  assert.match(guest, /the menu remembers the guest's veg lens/);
  assert.match(guest, /the\n \* language pill's own law, not the cart's per-tab law/);
  assert.match(guest, /private mode just keeps a session-only lens/);
});

test('unit339 · the state reads its home at mount', () => {
  // the lazy init — no token, no arguments: a device preference
  assert.match(guest, /const \[vegOnly, setVegOnly\] = useState\(readVegOnly\);/);
  // the old every-visit reset is GONE
  assert.equal(count(guest, 'const [vegOnly, setVegOnly] = useState(false)'), 0);
  // the init carries the law's comment
  assert.match(guest, /the veg lens reads its per-device home at mount/);
});

test('unit339 · the writer keeps the home current', () => {
  // the toggle computes the next value, speaks it, and writes the device's memory
  assert.match(guest, /const next = !vegOnly;\n\s*setVegOnly\(next\);/);
  assert.match(guest, /localStorage\.setItem\(VEG_KEY, next \? 'on' : 'off'\); \/\/ the device remembers/);
  // the old functional toggle is GONE
  assert.equal(count(guest, 'setVegOnly((v) => !v)'), 0);
  // the catch keeps private mode honest
  assert.match(guest, /\} catch \{\n\s*\/\* private mode — session-only lens \*\/\n\s*\}\n\s*\}\}/);
});

test('unit339 · the toggle\u2019s face stands byte-still', () => {
  // the aria keeps its function; the whisper took the title's seat
  assert.match(guest, /aria-pressed=\{vegOnly\}/);
  assert.match(guest, /aria-label=\{t\('vegOnlyAria'\)\}/);
  assert.match(guest, /title=\{t\('vegWhisper'\)\}/);
  // the FSSAI square-and-dot classes stand
  assert.match(guest, /flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border \$/);
  assert.match(guest, /vegOnly \? 'border-\[#2E7D32\] bg-\[#EAF4EB\]' : 'border-\[#9AA8A0\]'/);
  // the count chip still rides only when the lens is on and veg exists
  assert.match(guest, /\{vegOnly && vegCount > 0 && \(/);
});

test('unit339 · the neighbours byte-still', () => {
  // the filter memo still composes veg first (the 335 law's dep array — the
  // real bytes; the display layer swallows the '[m' of '[menu', the 335
  // lesson: trust char codes, never the rendered text)
  assert.match(guest, /\}, \[menu, query, vegOnly\]\);/);
  // the chime's own per-device line stands (the storage family's elder)
  assert.match(guest, /'sp\.guest\.chime'/);
  // the name's per-tab law stands untouched (the 338 law)
  assert.match(guest, /const NAME_KEY = \(token: string\) => `sp\.guest\.name\.\$\{token\}`;/);
  // the honest-miss family still speaks when the lens empties the menu
  assert.match(i18n, /vegEmpty:/);
});

test('unit339 · three languages, one whisper', () => {
  // every guest language carries the whisper — 3 dicts, 3 each
  assert.equal(count(i18n, 'vegWhisper:'), 3, 'the whisper in EN, HI and KN');
  assert.match(i18n, /vegWhisper: 'This device remembers your veg filter',/);
  assert.match(i18n, /vegWhisper: 'यह डिवाइस आपका वेज फ़िल्टर याद रखता है',/);
  assert.match(i18n, /vegWhisper: 'ಈ ಸಾಧನವು ನಿಮ್ಮ ವೆಜ್ ಫಿಲ್ಟರ್ ಅನ್ನು ನೆನಪಿಟ್ಟುಕೊಳ್ಳುತ್ತದೆ',/);
});

test('unit339 · the feature names itself and its law', () => {
  // the state comment carries the law's words
  assert.match(guest, /a returning guest sees the menu through the/);
  assert.match(guest, /lens they left it with/);
  // the key's comment names the preference's register
  assert.match(guest, /a preference is the\n \* guest's, not the session's/);
});

test('unit339 · the version law — version.ts and sw.js carry the same word', () => {
  const v = version.match(/export const APP_VERSION = '([^']+)';/);
  const s = sw.match(/const VERSION = "servepoint-v([^-]+)-r(\d+)"/);
  assert.ok(v, 'version.ts must speak APP_VERSION');
  assert.ok(s, 'sw.js must bake the cache word');
  assert.equal(v[1], s[1], 'the two words must agree');
  assert.equal(v[1], '5.300.0');
});
