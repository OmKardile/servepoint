/* unit335 — v5.296.0 "the guest's search learns the shelf's own name" (agreement shape)
 * The source-shape audit found the 334 digit-law's sibling disease on the
 * guest menu: the staff shelf's filter keeps a group whose CATEGORY name
 * answers the needle (MenuScreen's clause), but the GUEST menu's filter
 * read only dish names and descriptions — a guest typing "desserts"
 * matched nothing while the Desserts shelf stood full one word away, and
 * the honest-miss card spoke truthfully about a search deaf to the
 * shelf's own name. THE FEATURE: the shelf answers to its name — a query
 * matching the category keeps the WHOLE shelf; dish needles behave
 * exactly as before; the veg toggle composes first. THE WORDS: the field
 * whispers the convention on hover and the miss card's hint line speaks
 * it, in all three guest languages. */

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(`/home/z/my-project/${p}`, 'utf8');

const guest = read('src/components/guest/GuestPages.tsx');
const i18n = read('src/lib/guest-i18n.ts');
const version = read('src/version.ts');
const sw = read('public/sw.js');

const count = (hay, needle) => hay.split(needle).length - 1;

test('unit335 · the shelf answers to its name', () => {
  // the law's ternary: the category name answers, the WHOLE shelf travels
  assert.match(guest, /c\.name\.toLowerCase\(\)\.includes\(q\)\n\s*\? c\n\s*:/);
  // the else branch keeps the dish needle — name + description, byte-still
  assert.match(guest, /\{ \.\.\.c, items: c\.items\.filter\(\(i\) => `\$\{i\.name\} \$\{i\.description \|\| ''\}`\.toLowerCase\(\)\.includes\(q\)\) \},/);
  // the law names itself and its kin
  assert.match(guest, /the shelf answers to its name: a query matching the/);
  assert.match(guest, /guest-side kin/);
});

test('unit335 · the filter\u2019s neighbours byte-still', () => {
  // the empty-query gate stands
  assert.match(guest, /if \(!q\) return cats;/);
  // the veg gate above stands, unchanged shape
  assert.match(guest, /cats = cats\n\s+\.map\(\(c\) => \(\{ \.\.\.c, items: c\.items\.filter\(\(i\) => i\.is_veg\) \}\)\)\n\s+\.filter\(\(c\) => c\.items\.length > 0\);/);
  // the trailing survivor filter stands
  assert.match(guest, /\.filter\(\(c\) => c\.items\.length > 0\);\n\s*\}, \[menu, query, vegOnly\]\);/);
  // the useMemo's own head stands
  assert.match(guest, /const filtered = useMemo\(\(\) => \{\n\s*if \(!menu\?\.categories\) return \[\];/);
});

test('unit335 · the veg toggle composes first', () => {
  // order in the useMemo: the veg narrowing BEFORE the search — a veg guest's
  // shelf answer shows the shelf's veg dishes only
  const memo = guest.slice(guest.indexOf('const filtered = useMemo'), guest.indexOf('}, [menu, query, vegOnly]);'));
  const vegAt = memo.indexOf('if (vegOnly)');
  const qAt = memo.indexOf('if (!q) return cats;');
  assert.ok(vegAt > -1 && qAt > vegAt, 'veg gate must sit before the search gate');
  // the shelf law rides the SAME memo — one filter, one voice
  assert.ok(memo.indexOf('c.name.toLowerCase().includes(q)') > qAt, 'the shelf clause inside the search half');
});

test('unit335 · the field whispers the convention', () => {
  // the hover word rides the search input (the 334 book-field's register)
  assert.match(guest, /title=\{t\('searchShelfHint'\)\}/);
  // the input's own grammar stands: the aria, the placeholder, the clear ✕
  assert.match(guest, /aria-label=\{t\('searchAria'\)\}/);
  assert.match(guest, /placeholder=\{t\('searchPh'\)\}/);
  assert.match(guest, /aria-label=\{t\('searchClear'\)\}/);
  // the whisper speaks the convention in the dictionary
  assert.match(i18n, /searchShelfHint: 'Dishes and shelves both answer — try “desserts”',/);
});

test('unit335 · the miss card speaks the same law', () => {
  // the hint line rides below the miss word, gated on a real query —
  // the veg-empty case (no query) keeps its own silence
  assert.match(guest, /\{query\.trim\(\) && <p className="mt-1\.5 text-\[12px\] text-\[#9A9A9A\]">\{t\('nothingHint'\)\}<\/p>\}/);
  // unit323's call shapes stand byte-still
  assert.match(guest, /t\('nothingMatchesVeg', \{ q: query \}\)/);
  assert.match(guest, /t\('nothingMatches', \{ q: query \}\)/);
  assert.match(guest, /t\('vegEmpty'\)/);
  // the miss card's gate stands
  assert.match(guest, /phase === 'ready' && filtered\.length === 0/);
});

test('unit335 · three languages, one law', () => {
  // every guest language carries both words — 3 dicts, 3 each
  assert.equal(count(i18n, 'searchShelfHint:'), 3, 'the whisper in EN, HI and KN');
  assert.equal(count(i18n, 'nothingHint:'), 3, 'the miss hint in EN, HI and KN');
  // the EN law words name the convention
  assert.match(i18n, /nothingHint: 'A shelf answers to its name too — try “desserts” or “starters”\.',/);
});

test('unit335 · the staff shelf\u2019s own clause byte-still', () => {
  // the cure is guest-side: the staff room's 1031 clause stands untouched
  const staff = read('src/components/menu/MenuScreen.tsx');
  assert.match(staff, /\.filter\(\(g\) => g\.list\.length > 0 \|\| \(q && g\.category && g\.category\.name\.toLowerCase\(\)\.includes\(q\)\)\);/);
  // and the guest page holds no staff-room import — the rooms stay separate
  assert.doesNotMatch(guest, /from '\.\.\/menu\/MenuScreen'/);
});

test('unit335 · the version law — version.ts and sw.js carry the same word', () => {
  const v = version.match(/export const APP_VERSION = '([^']+)';/);
  const s = sw.match(/const VERSION = "servepoint-v([^-]+)-r(\d+)"/);
  assert.ok(v, 'version.ts must speak APP_VERSION');
  assert.ok(s, 'sw.js must bake the cache word');
  assert.equal(v[1], s[1], 'the two words must agree');
  assert.equal(v[1], '5.296.0');
});
