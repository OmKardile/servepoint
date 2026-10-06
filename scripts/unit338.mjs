/* unit338 — v5.299.0 "the drawer remembers the guest's name" (agreement shape)
 * The candidates audit (the QHD 2560×1440 lens — the fresh-eyes walk of this
 * round, where the max-width containers met 2× the design width for the first
 * time) found the house clean but the drawer's memory asymmetric: the cart
 * and the note each found their per-tab home (5.254's law), but the NAME —
 * the guest's own word, not the order's — started empty on every mount, so a
 * guest ordering a second round retyped it. THE FEATURE: the drawer remembers
 * the guest's name — per-tab sessionStorage beside the cart, read at mount,
 * written on every keystroke, riding every checkout, and STAYING at checkout
 * (the same person is ordering again); only the token's death takes the name
 * with it, and a fresh or reopened link claims nothing. THE WORDS: the field
 * whispers its convention on hover, in all three guest languages. */

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(`/home/z/my-project/${p}`, 'utf8');

const guest = read('src/components/guest/GuestPages.tsx');
const i18n = read('src/lib/guest-i18n.ts');
const version = read('src/version.ts');
const sw = read('public/sw.js');

const count = (hay, needle) => hay.split(needle).length - 1;

test('unit338 · the name\u2019s per-tab home is born beside the note\u2019s law', () => {
  // the key rides the family grammar (sp.guest.name.<token>)
  assert.match(guest, /const NAME_KEY = \(token: string\) => `sp\.guest\.name\.\$\{token\}`;/);
  // the reader is the note reader's own shape (try/catch, private mode → '')
  assert.match(guest, /function readGuestName\(token: string\): string \{\n\s*try \{\n\s*const raw = sessionStorage\.getItem\(NAME_KEY\(token\)\);/);
  // the law names itself and its kin
  assert.match(guest, /the drawer remembers the guest's name/);
  assert.match(guest, /a fresh or reopened link claims\n \* nothing/);
  assert.match(guest, /only the token's death takes the name with it/);
});

test('unit338 · the state reads its home at mount', () => {
  // the lazy init — the same law the note speaks
  assert.match(guest, /const \[customerName, setCustomerName\] = useState\(\(\) => readGuestName\(qrToken\)\);/);
  // the old empty-start for THIS state is GONE (other components' empty-starts are theirs)
  assert.equal(count(guest, "const [customerName, setCustomerName] = useState('')"), 0);
  // the init carries the law's comment
  assert.match(guest, /the name reads its per-tab home at mount/);
});

test('unit338 · the writer keeps the home current', () => {
  // the helper rides the note writer's shape
  assert.match(guest, /const changeName = \(v: string\) => \{\n\s*setCustomerName\(v\);/);
  assert.match(guest, /sessionStorage\.setItem\(NAME_KEY\(qrToken\), v\); \/\/ kept with the guest/);
  // the input rides the helper now
  assert.match(guest, /onChange=\{\(e\) => changeName\(e\.target\.value\)\}/);
  // the old direct setter on this input is GONE (the writer is the one hand)
  assert.equal(count(guest, 'onChange={(e) => setCustomerName(e.target.value)}'), 0);
});

test('unit338 · the field\u2019s face stands byte-still', () => {
  // the input keeps its id, cap, placeholder and classes — only the writer and the whisper joined
  assert.match(guest, /id="g-name"\n\s*type="text"\n\s*value=\{customerName\}/);
  assert.match(guest, /maxLength=\{60\}/);
  assert.match(guest, /placeholder=\{t\('namePh'\)\}/);
  assert.match(guest, /className="sp-input h-11 w-full px-3 text-\[13\.5px\]"/);
  // the field still only renders with food in the cart
  assert.match(guest, /\{lines\.length > 0 && \(\n\s*<div className="mt-4">\n\s*<label htmlFor="g-name"/);
});

test('unit338 · checkout keeps the name; the token\u2019s death takes it', () => {
  // the success wipe removes cart + note and NOTHING else — the name stays
  const successIdx = guest.indexOf("sessionStorage.removeItem(ORDER_NOTE_KEY(qrToken)); // the note rode to the server — the field starts fresh");
  assert.ok(successIdx > -1, 'the success wipe stands');
  assert.ok(guest.slice(successIdx, successIdx + 400).includes('the NAME stays (v5.299.0)'), 'the success path speaks why the name stays');
  assert.equal(count(guest, 'sessionStorage.removeItem(NAME_KEY'), 1, 'exactly ONE wipe site — the token\u2019s death');
  // and that one is the INVALID_TOKEN path
  const wipeIdx = guest.indexOf('sessionStorage.removeItem(NAME_KEY');
  const invalidIdx = guest.indexOf("if (res.error === 'INVALID_TOKEN') {");
  assert.ok(wipeIdx > invalidIdx && invalidIdx > -1, 'the name wipe lives on the token-death path');
  assert.match(guest, /sessionStorage\.removeItem\(NAME_KEY\(qrToken\)\); \/\/ the name is the guest's — it goes with the token/);
});

test('unit338 · the neighbours byte-still', () => {
  // the note's own law stands untouched
  assert.match(guest, /const ORDER_NOTE_KEY = \(token: string\) => `sp\.guest\.orderNote\.\$\{token\}`;/);
  assert.match(guest, /const changeNote = \(v: string\) => \{/);
  // the last-ticket memory's writer stands (the 336 law)
  assert.match(guest, /sessionStorage\.setItem\(LAST_ORDER_KEY\(qrToken\), JSON\.stringify\(\{ id: res\.order\.id, n: res\.order\.order_number \}\)\);/);
  // the checkout still hands the name to the server
  assert.match(guest, /customerName: customerName \|\| null,/);
  // the ticket still speaks the name in its header
  assert.match(guest, /\{order\.customer_name \? ` · \$\{order\.customer_name\}` : ''\}/);
});

test('unit338 · three languages, one whisper', () => {
  // every guest language carries the whisper — 3 dicts, 3 each
  assert.equal(count(i18n, 'nameWhisper:'), 3, 'the whisper in EN, HI and KN');
  assert.match(i18n, /nameWhisper: 'This tab remembers your name for the next order',/);
  assert.match(i18n, /nameWhisper: 'यह टैब अगले ऑर्डर के लिए आपका नाम याद रखता है',/);
  assert.match(i18n, /nameWhisper: 'ಈ ಟ್ಯಾಬ್ ಮುಂದಿನ ಆರ್ಡರ್‌ಗಾಗಿ ನಿಮ್ಮ ಹೆಸರನ್ನು ನೆನಪಿಟ್ಟುಕೊಳ್ಳುತ್ತದೆ',/);
  // the input whispers it on hover
  assert.match(guest, /title=\{t\('nameWhisper'\)\}/);
});

test('unit338 · the version law — version.ts and sw.js carry the same word', () => {
  const v = version.match(/export const APP_VERSION = '([^']+)';/);
  const s = sw.match(/const VERSION = "servepoint-v([^-]+)-r(\d+)"/);
  assert.ok(v, 'version.ts must speak APP_VERSION');
  assert.ok(s, 'sw.js must bake the cache word');
  assert.equal(v[1], s[1], 'the two words must agree');
});
