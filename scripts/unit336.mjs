/* unit336 — v5.297.0 "the menu remembers the guest's plates" (agreement shape)
 * The QA walk (the 820×1180 iPad-portrait lens — the fresh-eyes walk of this
 * round) found the house clean but the round-trip missing a word: the guest
 * who placed #132 and taps "Order more" lands back on a menu that has
 * FORGOTTEN every plate they just ordered — the ticket knows, the cart knew,
 * the rows said nothing. THE FEATURE: the room remembers the guest's plates
 * — the guest's OWN last ticket (per-tab sessionStorage, their own checkout,
 * the 5.253.0 law) is fetched once per ticket id through the same public RPC
 * the ticket page speaks, and every dish whose NAME answers lands a soft
 * gold chip on its row. Names only (the reorder manifest's own grammar —
 * case-insensitive, whitespace-tolerant; prices are the menu's truth, never
 * the memory's). Fail-soft at the offers banner's own law: a failed fetch is
 * simply no chip. THE WORDS: the chip speaks in all three guest languages,
 * the warm band's palette — zero new colors. */

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(`/home/z/my-project/${p}`, 'utf8');

const guest = read('src/components/guest/GuestPages.tsx');
const i18n = read('src/lib/guest-i18n.ts');
const version = read('src/version.ts');
const sw = read('public/sw.js');

const count = (hay, needle) => hay.split(needle).length - 1;

test('unit336 · the room\u2019s favourite chip rides the dish row', () => {
  // the conditional answers by NAME — trim + lowercase, the manifest's grammar
  assert.match(guest, /lastTicketDishes\.has\(item\.name\.trim\(\)\.toLowerCase\(\)\)/);
  // the chip wears the warm band's palette — tint bg + ink, zero new colors
  assert.match(guest, /bg-\[#FBF3E4\] px-2 py-0\.5 text-\[10\.5px\] font-semibold text-\[#8A5A16\]/);
  // the heart rides the fill, hidden from the ear; the word stays the voice
  assert.match(guest, /<Heart size=\{10\} aria-hidden className="fill-current" \/>/);
  // the hover word rides the chip (the 334/335 field-whisper register)
  assert.match(guest, /title=\{t\('onLastTicket'\)\}/);
  // the chip sits AFTER the addons chip — the row's chip family, not a stranger
  const addonsAt = guest.indexOf("{t('nAddons'");
  const chipAt = guest.indexOf('lastTicketDishes.has(item.name');
  assert.ok(addonsAt > -1 && chipAt > addonsAt, 'the favourite chip follows the addons chip');
});

test('unit336 · the memory effect — one fetch per ticket id', () => {
  // the state + the ref guard are born together
  assert.match(guest, /const \[lastTicketDishes, setLastTicketDishes\] = useState<ReadonlySet<string>>\(new Set\(\)\);/);
  assert.match(guest, /const fetchedTicketId = useRef<string \| null>\(null\);/);
  // the phase gate: the memory only speaks on a ready menu
  assert.match(guest, /if \(phase !== 'ready'\) return;\n\s*const ticket = readLastTicket\(qrToken\);/);
  // the ref guard makes a re-render free — one fetch per ticket id
  assert.match(guest, /if \(!ticket \|\| fetchedTicketId\.current === ticket\.id\) return;\n\s*fetchedTicketId\.current = ticket\.id;/);
  // the set holds NAMES (trim + lowercase) — never ids the payload predates
  assert.match(guest, /setLastTicketDishes\(new Set\(r\.order\.items\.map\(\(it\) => it\.name\.trim\(\)\.toLowerCase\(\)\)\)\);/);
  // the payload validity gate stands before the set
  assert.match(guest, /if \(!r\.is_valid \|\| !r\.order\?\.items\?\.length\) return;/);
  // the alive flag makes an unmount a no-op
  assert.match(guest, /return \(\) => \{\n\s*alive = false;\n\s*\};\n\s*\}, \[phase, qrToken\]\);/);
  // the fail-soft catch — a failed fetch is simply no chip
  assert.match(guest, /\.catch\(\(\) => \{\n\s+\/\* fail-soft: a failed fetch is simply no chip \*\/\n\s+\}\);/);
});

test('unit336 · the memory\u2019s source is the guest\u2019s own checkout', () => {
  // the reader stands byte-still (5.253.0): per-tab, own-checkout only
  assert.match(guest, /const LAST_ORDER_KEY = \(token: string\) => `sp\.guest\.lastOrder\.\$\{token\}`;/);
  assert.match(guest, /const raw = sessionStorage\.getItem\(LAST_ORDER_KEY\(token\)\);/);
  // the writer stands byte-still (the checkout's own hand)
  assert.match(guest, /sessionStorage\.setItem\(LAST_ORDER_KEY\(qrToken\), JSON\.stringify\(\{ id: res\.order\.id, n: res\.order\.order_number \}\)\);/);
  // the fetch rides the SAME public RPC the ticket page speaks
  assert.match(guest, /fetchPublicOrder\(ticket\.id\)/);
});

test('unit336 · the neighbours byte-still', () => {
  // the addons chip's own shape stands (the chip joined, nothing moved)
  assert.match(guest, /\{item\.addons\.length > 0 && \(\n\s*<span className="rounded-full bg-\[#FDF9F0\] px-2 py-0\.5 text-\[10\.5px\] font-medium text-\[#8A5A16\]">\n\s*\{t\('nAddons', \{ n: item\.addons\.length, s: item\.addons\.length > 1 \? 's' : '' \}\)\}/);
  // the reorder landing word's state stands
  assert.match(guest, /const \[reorderNote, setReorderNote\] = useState<\{ orderNumber: number; matched: number; dropped: number \} \| null>\(null\);/);
  // the offers fetch stands (fail-soft family, unchanged)
  assert.match(guest, /fetchPublicOffers\(r\.tenant\.slug\)\.then\(\(o\) => \{\n\s*if \(alive\) setOffers\(o\);\n\s*\}\);/);
  // the load chain's head stands
  assert.match(guest, /const \[loadBusy, setLoadBusy\] = useState\(false\);/);
});

test('unit336 · the heart rides the lucide block', () => {
  // the import is real and alphabetical (Heart before HeartHandshake)
  assert.match(guest, /^  Heart,\n  HeartHandshake,$/m);
  // and the component family is otherwise untouched — one new icon, no churn
  assert.match(guest, /^  Copy,\n  Heart,\n  HeartHandshake,$/m);
});

test('unit336 · three languages, one word', () => {
  // every guest language carries the chip's word — 3 dicts, 3 each
  assert.equal(count(i18n, 'onLastTicket:'), 3, 'the chip word in EN, HI and KN');
  // the EN law word names the ticket, not the dish
  assert.match(i18n, /onLastTicket: 'On your last ticket',/);
  assert.match(i18n, /onLastTicket: 'आपकी पिछली टिकट पर',/);
  assert.match(i18n, /onLastTicket: 'ನಿಮ್ಮ ಕೊನೆಯ ಟಿಕೆಟ್‌ನಲ್ಲಿ',/);
});

test('unit336 · the feature names itself and its law', () => {
  // the state comment carries the law's words
  assert.match(guest, /the room remembers the guest's plates/);
  assert.match(guest, /fresh or reopened link claims nothing/);
  assert.match(guest, /Names only/);
  // the chip's comment names the palette's kin
  assert.match(guest, /The warm band's\n\s+palette \(bg tint \+ ink\) — zero new colors/);
});

test('unit336 · the version law — version.ts and sw.js carry the same word', () => {
  const v = version.match(/export const APP_VERSION = '([^']+)';/);
  const s = sw.match(/const VERSION = "servepoint-v([^-]+)-r(\d+)"/);
  assert.ok(v, 'version.ts must speak APP_VERSION');
  assert.ok(s, 'sw.js must bake the cache word');
  assert.equal(v[1], s[1], 'the two words must agree');
});
