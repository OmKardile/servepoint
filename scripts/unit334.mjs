/* unit334 — v5.295.0 "the guests book learns its own digits" (agreement shape)
 * The source-shape audit found the parked phone-key normalization REAL and
 * worse than parked: the guests book keys its ledger buckets, its merges
 * and its offer registers through phoneDigits ("98765 43210" and
 * "9876543210" are the same guest — the book's own 483 law), but the
 * book's SEARCH read the phone as raw substring — "98765 43210".includes(
 * "9876543210") is false — so a needle typed without the stored spaces
 * found NOTHING, and the honest-miss card LIED: "No guest matches …"
 * while the guest stood on the books. THE FEATURE: the digit needle rides
 * beside the raw one (any query carrying digits also matches through the
 * digits-only form; a needle with no digits behaves exactly as before;
 * empty stays empty). THE WORDS: the field whispers its convention on
 * hover and the miss card's body speaks the same sentence. */

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(`/home/z/my-project/${p}`, 'utf8');

const book = read('src/components/customers/CustomersScreen.tsx');
const version = read('src/version.ts');
const sw = read('public/sw.js');

const count = (hay, needle) => hay.split(needle).length - 1;

test('unit334 · the digit needle rides beside the raw one', () => {
  // the needle: digits-only form of the query
  assert.match(book, /const qDigits = q\.replace\(\/\\D\/g, ''\);/);
  // the digit clause rides the filter — beside the raw phone clause, never instead of it
  assert.match(book, /g\.phone\.toLowerCase\(\)\.includes\(q\) \|\|/);
  assert.match(book, /\(qDigits\.length > 0 && phoneDigits\(g\.phone\)\.includes\(qDigits\)\) \|\|/);
  // the law names itself: the 483 law, the lie it cures
  assert.match(book, /the search learns the book's own digit language/);
  assert.match(book, /honest-miss card LIED/);
});

test('unit334 · the empty-phone law stands — the 483 word', () => {
  // the normalizer's own law: empty stays empty — the comment above it, the body beside it
  assert.match(book, /Empty stays empty: an empty phone never matches\./);
  assert.match(book, /function phoneDigits\(p: string \| null \| undefined\): string \{\n  return \(p \|\| ''\)\.replace\(\/\\D\/g, ''\);\n\}/);
  // the book's other phoneDigits readers stand byte-still: the offer registers, the ledger bucket, the merges
  assert.equal(count(book, 'phoneDigits(') >= 6, true, 'the law\u2019s other readers untouched');
  assert.match(book, /ledgerByPhone\.get\(phoneDigits\(detailFor\.phone\)\)/);
});

test('unit334 · the field whispers the convention', () => {
  // the hover word rides the search input
  assert.match(book, /title="A phone matches however it's written — spaces and dashes never hide a guest"/);
  // the input's own grammar stands: the aria, the placeholder, the class
  assert.match(book, /aria-label="Search guests"/);
  assert.match(book, /placeholder="Search name, phone, email, notes…"/);
  assert.match(book, /className="sp-input h-11 w-full pl-10 pr-3 text-\[13\.5px\]"/);
});

test('unit334 · the miss card speaks the same sentence', () => {
  // the body gained the digit sentence — the miss that IS true explains the convention that forgives it
  assert.match(book, /A phone matches\s*\n\s*\*? however it's written — spaces and dashes never hide a guest\.|A phone matches\n?\s*however it's written — spaces and dashes never hide a guest\./);
  // the miss card's own words stand: the title, the email clause, the tier clause, the way out
  assert.match(book, /No guest matches “\$\{query\.trim\(\)\}”/);
  assert.match(book, /an email match keeps its row/);
  assert.match(book, /The \{TIER_META\[tier\]\.label\} tile is also in play — either can miss\./);
  assert.match(book, /\{tier \? 'Clear both' : 'Clear search'\}/);
});

test('unit334 · the filter\u2019s neighbours byte-still', () => {
  // the tier gate below the filter stands
  assert.match(book, /\.filter\(\(\{ s \}\) => !tier \|\| tierKeyOf\(s\?\.visits \?\? 0, Number\(s\?\.total_spent \?\? 0\)\) === tier\)/);
  // the whisper (the census line) stands — it reads rows.length, now digit-honest for free
  assert.match(book, /aria-live="polite"/);
  assert.match(book, /\{rows\.length\}/);
  // the search meta word stands
  assert.match(book, /setSearchMeta\(\{ placeholder: 'Search guests…' \}\)/);
});

test('unit334 · the ONE raw needle retired — no sibling disease', () => {
  // the book's was the only raw phone substring search in the house
  const guests = read('src/components/customers/CustomersScreen.tsx');
  const bills = read('src/components/bills/BillsScreen.tsx');
  for (const [name, src] of [['book', guests], ['bills', bills]]) {
    const raw = src.match(/\.phone\.toLowerCase\(\)\.includes\([^)]+\) \|\|\n[^\n]*\|\|/);
    if (raw) {
      // if a raw needle exists, the digit needle must ride beside it
      assert.match(src, /qDigits/, `${name}: a raw needle without the digit language`);
    }
  }
  assert.match(book, /qDigits\.length > 0 && phoneDigits\(g\.phone\)\.includes\(qDigits\)/);
});

test('unit334 · the family law — the search meta and the drill stand', () => {
  // the drill's own phone reads already normalized (the 350 law) — untouched
  assert.match(book, /const d = phoneDigits\(r\.customerPhone\);/);
  assert.match(book, /const bucket = ledger \? ledger\.get\(phoneDigits\(g\.phone\)\) : undefined;/);
});

test('unit334 · the version law — version.ts and sw.js carry the same word', () => {
  const v = version.match(/export const APP_VERSION = '([^']+)';/);
  const s = sw.match(/const VERSION = "servepoint-v([^-]+)-r(\d+)"/);
  assert.ok(v, 'version.ts must speak APP_VERSION');
  assert.ok(s, 'sw.js must bake the cache word');
  assert.equal(v[1], s[1], 'the two words must agree');
});
