/* unit319 — v5.280.0 "the paise keeps one rounder" (agreement shape)
 * The census finding (opened by a half-done cron round, finished by this
 * one): the money register's ARITHMETIC — `Math.round(n * 100) / 100` —
 * was rolled by hand in ELEVEN homes beside lib/money.ts, the very lib
 * that owns the digit voice:
 *   offerFit's local; the staff cart's capped discount; the dish modal
 *   AND the menu screen beside it (a private round2, three call sites);
 *   the guest book; api.ts's written order item_total and the drawer
 *   movement's p_amount; the offers' write path (twice); the EOD drawer's
 *   open/close floats; the waste card's quantities and rupees (four
 *   sites); and one dead local on the floor that nothing ever called.
 * AND the house's GST rate — 5%, the standard F&B slab — lived in FOUR
 * files with no single owner: api.ts held `const taxRate = 0.05` where
 * staff orders are written; the staff cart and the guest cart each
 * re-rolled `(base) * 0.05` for their previews; and the receipt's legal
 * labels spoke "CGST 2.5%" as a BARE LITERAL while its money was derived
 * — label and math could disagree the day the slab moves.
 * THE ROUND: money.ts gains round2 (the ONE arithmetic home — same file
 * that owns the voice, because the digit shape and its rounding are one
 * truth); lib/tax.ts is the rate's ONE home (GST_RATE, gstTax, the
 * display-only cgstSgstSplit, and PERCENT WORDS DERIVED, never typed);
 * the guest's three translations carry "GST {rate}%" as a variable.
 * A preview and its written order can never disagree again. */

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

const money = read('src/lib/money.ts');
const tax = read('src/lib/tax.ts');
const api = read('src/lib/api.ts');
const cart = read('src/store/cart.ts');
const menu = read('src/components/menu/MenuScreen.tsx');
const floor = read('src/components/floor/FloorScreen.tsx');
const itemModal = read('src/components/food/ItemDetailModal.tsx');
const staffCart = read('src/components/food/FoodDrinksScreen.tsx');
const guest = read('src/components/guest/GuestPages.tsx');
const guestI18n = read('src/lib/guest-i18n.ts');
const customers = read('src/components/customers/CustomersScreen.tsx');
const eod = read('src/components/eod/EodScreen.tsx');
const reports = read('src/components/reports/ReportsScreen.tsx');
const receipt = read('src/components/bills/ReceiptPrint.tsx');
const bills = read('src/components/bills/BillsScreen.tsx');
const offerFit = read('src/lib/offerFit.ts');
const version = read('src/version.ts');
const sw = read('public/sw.js');

test('unit319 · the arithmetic has ONE home — money.ts exports round2, the exact census byte', () => {
  assert.match(money, /export function round2\(n: number\): number \{\s*\n\s*return Math\.round\(n \* 100\) \/ 100;\s*\n\}/);
  // MATH, not voice — the docstring says so; the rounder computes, never renders.
  assert.match(money, /MATH, not voice/);
  // It lives in the SAME file that owns the digit voice — one truth, not two.
  assert.match(money, /export function moneyNum/);
});

test('unit319 · census law — no hand-rolled paise rounder anywhere in src/ but the lib', () => {
  const files = walk('/home/z/my-project/src');
  const offenders = [];
  for (const f of files) {
    if (f.endsWith('lib/money.ts')) continue;
    const src = read(f.replace('/home/z/my-project/', ''));
    // the WIDE census byte: Math.round through the closing paren, then the
    // * 100) / 100 run — catches nested-paren shapes the narrow walk missed
    // (the 318 precedent: the census law earns its keep on its own first run).
    if (/Math\.round\([^;]*?\*\s*100\)\s*\/\s*100/.test(src)) offenders.push(f);
  }
  assert.deepEqual(offenders, [], `hand-rolled rounders remain: ${offenders.join(', ')}`);
  // the bill's ways-split keeps its deliberate Math.floor (each way rounds
  // DOWN so the parts never overpay) — a judgment, not this rounder's twin.
  assert.match(bills, /Math\.floor\(\(balance \/ remainingWays\) \* 100\) \/ 100/);
});

test('unit319 · the adopters ride the lib — no private twins left (nineteen sites, eleven files)', () => {
  // the menu screen's private round2 is GONE; it imports the lib instead
  assert.doesNotMatch(menu, /const round2 = \(n: number\) => Math\.round\(n \* 100\) \/ 100;/);
  assert.match(menu, /import \{ round2 \} from '\.\.\/\.\.\/lib\/money';/);
  assert.match(menu, /round2\(priceNum\)/);
  // the floor's dead local is retired — no definition, no import it never needed
  assert.doesNotMatch(floor, /const round2 = /);
  // the dish modal rides the lib (adopted by the half-done round, pinned now)
  assert.match(itemModal, /import \{ signedMoney, round2 \} from '\.\.\/\.\.\/lib\/money';/);
  // offerFit rides the lib
  assert.match(offerFit, /import \{ round2 \} from '\.\/money';/);
  assert.doesNotMatch(offerFit, /const round2 = /);
  // the staff cart's capped discount
  assert.match(cart, /import \{ round2 \} from '\.\.\/lib\/money';/);
  assert.match(cart, /Math\.min\(round2\(raw\), subtotal\)/);
  // api.ts: the written order's item_total and the drawer movement's p_amount
  assert.match(api, /item_total: round2\(it\.qty \* it\.unitPrice\)/);
  assert.match(api, /p_amount: round2\(amount\)/);
  // the offers' write path
  assert.match(customers, /discount_value: round2\(v\)/);
  assert.match(customers, /min_order_amount: round2\(m\)/);
  // the EOD drawer's open/close floats
  assert.match(eod, /openDrawerSession\(round2\(amount\)\)/);
  assert.match(eod, /closeDrawerSession\(drawerActive\.id, round2\(amount\), note\)/);
  // the waste card's quantities and rupees — v5.282.0: the edge grew to
  // carry moneyBare (the books' bare paise voice joined the same import),
  // the round2 math and its voice ride ONE edge now
  assert.match(reports, /import \{ round2, moneyBare \} from '\.\.\/\.\.\/lib\/money';/);
  assert.match(reports, /formatMoney\(round2\(wasteAgg\.total\)\)/);
  assert.match(reports, /formatMoney\(round2\(wasteAgg\.reasons\[r\]\.rupees\)\)/);
  assert.match(reports, /\{round2\(it\.qty\)\} \{it\.unit\}/);
  assert.match(reports, /formatMoney\(round2\(it\.rupees\)\)/);
  // the census walk's later catches (the wide byte found them):
  // the staff cart's own total
  assert.match(cart, /round2\(lines\.reduce\(\(s, l\) => s \+ l\.qty \* l\.unitPrice, 0\)\)/);
  // the EOD drawer's variance
  assert.match(eod, /round2\(parsed! - expected\)/);
  // the bill's balance (the ways-split's Math.floor stays — its own judgment)
  // v5.282.0: the edge grew to carry moneyBare alongside round2
  assert.match(bills, /import \{ round2, moneyBare \} from '\.\.\/\.\.\/lib\/money';/);
  assert.match(bills, /Math\.max\(0, round2\(selectedTotal - paidSum\)\)/);
  // the addon snapshot's base price
  assert.match(customers, /round2\(addonSnap\.reduce\(\(s, a\) => s \+ a\.price, 0\)\)/);
  assert.match(customers, /round2\(Number\(it\.unit_price\) - addonSum\)/);
});

test('unit319 · the rate has ONE home — lib/tax.ts owns GST_RATE, the census byte', () => {
  assert.match(tax, /export const GST_RATE = 0\.05;/);
  // no live rate literal anywhere else (comments naming the history are honest; code is not)
  const files = walk('/home/z/my-project/src').filter((f) => !f.endsWith('lib/tax.ts'));
  for (const f of files) {
    const src = read(f.replace('/home/z/my-project/', ''));
    // strip line comments and block comments before the walk — the law binds CODE
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(code, /\* 0\.05|taxRate = 0\.05|base \* 0\.05/, `${f} still hard-codes the rate`);
  }
  // the tax math is ONE function — paise-true, never negative
  assert.match(tax, /export function gstTax\(base: number\): number \{\s*\n\s*return round2\(Math\.max\(0, base\) \* GST_RATE\);/);
});

test('unit319 · a preview and its written order can never disagree — both ride gstTax', () => {
  // the write path
  assert.match(api, /import \{ gstTax \} from '\.\/tax';/);
  assert.match(api, /const taxAmount = gstTax\(subtotal - discount\);/);
  // the staff cart's preview rides the same math
  assert.match(staffCart, /gstTax\(/);
  // the guest cart's preview rides the same math
  assert.match(guest, /gstTax\(/);
  // the GST register's own split rides cgstSgstSplit — the twin it never knew it had
  assert.match(reports, /import \{ cgstSgstSplit \} from '\.\.\/\.\.\/lib\/tax';/);
  assert.match(reports, /const \{ cgst, sgst \} = cgstSgstSplit\(tax\);/);
});

test('unit319 · the percent words are DERIVED, never typed — labels speak what the math computes', () => {
  assert.match(tax, /export function gstPercentWord\(\): string \{/);
  assert.match(tax, /export function cgstPercentWord\(\): string \{/);
  // the receipt's legal labels import the derived words
  assert.match(receipt, /from '\.\.\/\.\.\/lib\/tax'/);
  assert.match(bills, /from '\.\.\/\.\.\/lib\/tax'/);
  // the split halves the ORDER'S OWN stored tax and gives the odd paise to SGST
  assert.match(tax, /const cgst = round2\(tax \/ 2\);/);
  assert.match(tax, /const sgst = round2\(tax - cgst\);/);
});

test('unit319 · the guest hears one truth — three translations carry the rate as a variable', () => {
  // "GST {rate}%" — the variable grammar, not a baked literal, in all three languages
  const hits = guestI18n.match(/gst: 'GST \{rate\}%'/g) || [];
  assert.ok(hits.length >= 3, `expected the {rate} grammar in all three languages, found ${hits.length}`);
  assert.doesNotMatch(guestI18n, /gst: 'GST 5%'/);
});

test("unit319 · the doctrine stands — moneyNum's digit shape is still the ONE voice byte", () => {
  // the digit-shape byte appears exactly once in src (money.ts), untouched by this round
  const files = walk('/home/z/my-project/src');
  let hits = 0;
  for (const f of files) {
    const src = read(f.replace('/home/z/my-project/', ''));
    if (/toLocaleString\('en-IN', \{ minimumFractionDigits: 2, maximumFractionDigits: 2 \}\)/.test(src)) hits += 1;
  }
  assert.equal(hits, 1, `the digit shape must live in exactly one src file, found ${hits}`);
  // the signed delta register keeps the house's typographic minus
  assert.match(money, /return `−\$\{money\(-n\)\}`;/);
  assert.match(money, /return '±₹0\.00';/);
});

test('unit319 · the version law — version.ts and sw.js carry the same word', () => {
  const v = version.match(/export const APP_VERSION = '([^']+)';/);
  const s = sw.match(/const VERSION = "servepoint-v([^-]+)-r(\d+)"/);
  assert.ok(v, 'version.ts must speak APP_VERSION');
  assert.ok(s, 'sw.js must bake the cache word');
  /* v5.281.0 re-pin per the unit308 precedent: the version literal belongs
   * to the current round's unit — the agreement (both words equal) is the
   * law, the word itself belongs to the round that owns it. */
  assert.equal(v[1], s[1], 'the two words must agree');
});
