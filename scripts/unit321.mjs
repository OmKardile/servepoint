/* unit321 — v5.282.0 "the bare paise keeps one shape, the money holds still"
 * (agreement shape)
 * The census finding: 319's walk was statement-bounded to the
 * `Math.round(... * 100) / 100` byte — the books' OTHER money shape, the
 * bare `toFixed(2)`, was not in the walk. A fresh census found it rolled
 * by hand in FIVE files beside lib/money — forty-three call sites strong
 * (Bills' CSV ×7, Reports' twelve CSV exports ×28, the guests book ×2,
 * Inventory's cost columns ×3) — and the close-out day book speaking NO
 * shape at all: four raw `Number()` cells whose float dust could walk
 * straight into the owner's ledger. THE ROUND: lib/money gains
 * moneyBare — round2's MATH first, the pad second, no ₹ and no grouping
 * (csv.ts's doctrine: numbers travel naked so the spreadsheet owns the
 * formatting) — and every books' cell rides it. The standing registers
 * are named and deliberately left: tax.ts's percent voice (the legal
 * 2.50% CGST label), the Dashboard KPI's percent voice, the rating
 * average's one-decimal voice, the inventory quantity voice, the SVG
 * geometry. THE ANTI-JITTER LAW rides the same round: the last money
 * renders without tabular-nums wear it now — the menu card's price (the
 * staff app's most-seen money), the variant deltas, the addon pills and
 * chips, the bills drawer's line money (whose fallback unit × qty product
 * also rides round2), the guests book's top-spender and paid-total, the
 * shelf row's cost word. */

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
const bills = read('src/components/bills/BillsScreen.tsx');
const reports = read('src/components/reports/ReportsScreen.tsx');
const customers = read('src/components/customers/CustomersScreen.tsx');
const inventory = read('src/components/inventory/InventoryScreen.tsx');
const eod = read('src/components/eod/EodScreen.tsx');
const menu = read('src/components/menu/MenuScreen.tsx');
const version = read('src/version.ts');
const sw = read('public/sw.js');

test('unit321 · moneyBare is the ONE bare voice — round2 math first, the pad second', () => {
  assert.match(money, /export function moneyBare\(amount: number\): string \{/);
  // the one-truth split: MATH (round2) computes, the formatter pads —
  // never a bare toFixed doing the rounding itself
  assert.match(money, /return round2\(Number\(amount\)\)\.toFixed\(2\);/);
  // the docstring tells the census truth: five files, the day book's raw
  // Number() cells, and the bare-on-purpose WHY (grouping breaks a sheet)
  assert.match(money, /FIVE files beside this lib, forty-three\s*\n?\s*\* call sites strong/);
  assert.match(money, /raw\s*\n?\s*\* `Number\(\)` cells/);
  assert.match(money, /a comma\s*\n?\s*\* inside a CSV money cell is a lie the spreadsheet parses wrong/);
});

test('unit321 · the census law — toFixed(2) lives in exactly the named homes', () => {
  const files = walk('/home/z/my-project/src');
  const offenders = [];
  for (const f of files) {
    const rel = f.replace('/home/z/my-project/', '');
    const body = read(rel);
    // the lib's own docstring MENTIONS the byte — count only code, not comments
    const code = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const hits = (code.match(/\.toFixed\(2\)/g) || []).length;
    if (hits === 0) continue;
    const isMoneyLib = rel === 'src/lib/money.ts';
    const isTaxPercent = rel === 'src/lib/tax.ts';
    const isDashPercent = rel === 'src/components/dashboard/DashboardScreen.tsx';
    if (!isMoneyLib && !isTaxPercent && !isDashPercent) offenders.push(`${rel} ×${hits}`);
  }
  assert.deepEqual(offenders, [], `hand-rolled bare money remains: ${offenders.join(', ')}`);
  // the three named homes, each with its own word
  assert.match(read('src/lib/money.ts'), /round2\(Number\(amount\)\)\.toFixed\(2\)/, 'money.ts: the bare money voice');
  assert.match(read('src/lib/tax.ts').replace(/\/\*[\s\S]*?\*\//g, ''), /\.toFixed\(2\)/, 'tax.ts: the legal percent label');
  assert.match(read('src/components/dashboard/DashboardScreen.tsx'), /Math\.abs\(pct\)\.toFixed\(2\)/, 'Dashboard: the KPI percent voice');
});

test('unit321 · the bills book rides moneyBare — the partial word, the open cell, the paise columns', () => {
  assert.match(bills, /import \{ round2, moneyBare \} from '\.\.\/\.\.\/lib\/money';/);
  assert.match(bills, /`partial \(\$\{moneyBare\(partPaid\)\} of \$\{moneyBare\(Number\(o\.total \?\? 0\)\)\} in\)`/);
  assert.match(bills, /moneyBare\(Math\.max\(0, Number\(o\.total \?\? 0\) - partPaid\)\)/);
  assert.match(bills, /moneyBare\(Number\(o\.subtotal \?\? 0\)\)/);
  assert.match(bills, /moneyBare\(Number\(o\.tax_amount \?\? 0\)\)/);
  assert.match(bills, /moneyBare\(Number\(o\.discount_amount \?\? 0\)\)/);
  assert.match(bills, /moneyBare\(Number\(o\.total \?\? 0\)\)/);
});

test('unit321 · the reports books ride moneyBare — twelve exports, one voice', () => {
  assert.match(reports, /import \{ round2, moneyBare \} from '\.\.\/\.\.\/lib\/money';/);
  // top items: money rides the lib, percents keep their own voice
  assert.match(reports, /moneyBare\(it\.revenue\)/);
  assert.match(reports, /moneyBare\(it\.cost\)/);
  assert.match(reports, /moneyBare\(margin\)/);
  // daily + hourly + pay mix
  assert.match(reports, /moneyBare\(d\.gross\)/);
  assert.match(reports, /moneyBare\(d\.avg\)/);
  assert.match(reports, /moneyBare\(h\.gross\)/);
  assert.match(reports, /moneyBare\(m\.total\)/);
  assert.match(reports, /moneyBare\(payMix\.unpaidAmt\)/);
  // the GST register and its TOTAL row
  assert.match(reports, /moneyBare\(r\.taxable\)/);
  assert.match(reports, /moneyBare\(r\.cgst\)/);
  assert.match(reports, /moneyBare\(r\.sgst\)/);
  assert.match(reports, /moneyBare\(gstTotals\.gross\)/);
  // the margin book and the service mix
  assert.match(reports, /moneyBare\(agg\.paidNet\)/);
  assert.match(reports, /moneyBare\(agg\.cogs\)/);
  assert.match(reports, /moneyBare\(agg\.margin\)/);
  assert.match(reports, /moneyBare\(v\.total\)/);
  // the drawer shifts book and its NET row
  assert.match(reports, /moneyBare\(Number\(s\.variance\)\)/);
  assert.match(reports, /rows\.push\(\['NET', moneyBare\(sumExp\), moneyBare\(sumCnt\), moneyBare\(shiftAgg\.net\), '', ''\]\)/);
});

test('unit321 · the guests book and the inventory cost columns ride moneyBare', () => {
  assert.match(customers, /import \{ round2, moneyBare \} from '\.\.\/\.\.\/lib\/money';/);
  assert.match(customers, /moneyBare\(Number\(s\?\.total_spent \?\? 0\)\)/);
  assert.match(customers, /ledger \? moneyBare\(given\) : ''/);
  assert.match(inventory, /import \{ moneyBare \} from '\.\.\/\.\.\/lib\/money';/);
  assert.match(inventory, /l\.costUnit == null \? '' : moneyBare\(l\.need \* l\.costUnit\)/);
  assert.match(inventory, /moneyBare\(Number\(r\.item\.cost_per_unit \?\? 0\)\)/);
  assert.match(inventory, /moneyBare\(q \* Number\(r\.item\.cost_per_unit \?\? 0\)\)/);
  // the quantity voice stands — recipe precision, trailing zeros stripped
  assert.match(inventory, /Number\(l\.perServe\.toFixed\(3\)\)/);
});

test('unit321 · the close-out day book speaks a shape — no raw Number() money cells', () => {
  assert.match(eod, /import \{ round2, moneyBare \} from '\.\.\/\.\.\/lib\/money';/);
  assert.match(eod, /moneyBare\(Number\(ord\.total\)\)/);
  assert.match(eod, /moneyBare\(Number\(ord\.tax_amount\)\)/);
  assert.match(eod, /moneyBare\(Number\(ord\.discount_amount \?\? 0\)\)/);
  assert.match(eod, /cogsByOrder\.get\(ord\.id\) == null \? '' : moneyBare\(cogsByOrder\.get\(ord\.id\)!\)/);
  // the old bare cells are gone from the ledger builder
  const ledgerBlock = eod.match(/export function dayLedgerCsvRows[\s\S]*?^\}/m);
  assert.ok(ledgerBlock, 'dayLedgerCsvRows must exist');
  assert.doesNotMatch(ledgerBlock[0].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''), /Number\(ord\.total\),/, 'the raw Number() cell is retired');
});

test('unit321 · the anti-jitter register — the last money renders hold still', () => {
  // the menu card's price — the staff app's most-seen money
  assert.match(menu, /text-\[14\.5px\] font-bold tabular-nums" style=\{\{ color: '#B88E2F' \}\}/);
  // the variant delta and the addon pill
  assert.match(menu, /text-\[13px\] font-bold tabular-nums" style=\{\{ color: v\.price_delta/);
  assert.match(menu, /tabular-nums \$\{on \? 'text-\[#E7C878\]' : 'text-\[#B88E2F\]'\}/);
  // the addon chip inside the customizer
  assert.match(menu, /<span className="tabular-nums">\{a\.name\} \{formatMoney\(a\.price\)\}<\/span>/);
  // the bills drawer's line money — still digits AND paise-true math
  assert.match(bills, /shrink-0 text-\[13px\] font-semibold tabular-nums text-\[#1A1A1A\]/);
  assert.match(bills, /formatMoney\(it\.item_total \?\? round2\(it\.unit_price \* it\.qty\)\)/);
  // the guests book's two cards
  assert.match(customers, /text-\[12px\] font-semibold tabular-nums text-\[#B88E2F\]/);
  assert.match(customers, /text-\[14px\] font-bold tabular-nums \$\{spent > 0/);
  // the shelf row's cost word
  assert.match(inventory, /hidden text-\[11px\] tabular-nums text-\[#969696\] sm:block/);
});

test('unit321 · the standing registers are named — the lib tells what it deliberately left', () => {
  assert.match(money, /tax\.ts's\s*\n?\s*\* `?\.?toFixed\(2\)`? percent voice|percent voice/);
  assert.match(money, /rating average's one-decimal voice/);
  assert.match(money, /quantity voice|toFixed\(3\)/);
  // tax.ts's percent label stands unadopted (a percent, not money)
  assert.match(read('src/lib/tax.ts'), /\(\(GST_RATE \/ 2\) \* 100\)\.toFixed\(2\)/);
  // csv.ts's bare-numbers doctrine is the WHY the voice is bare
  const csv = read('src/lib/csv.ts');
  assert.match(csv, /Numbers travel as bare decimals so the spreadsheet owns the formatting/);
});

test('unit321 · the doctrine stands — round2 still the math, moneyNum still the grouped shape', () => {
  assert.match(money, /export function round2\(n: number\): number \{\s*\n\s*return Math\.round\(n \* 100\) \/ 100;\s*\n\}/);
  assert.match(money, /export function moneyNum\(amount: number\): string \{/);
  assert.match(money, /export function money\(amount: number\): string \{/);
  assert.match(money, /export function signedMoney\(amount: number\): string \{/);
});

test('unit321 · the version law — version.ts and sw.js carry the same word', () => {
  const v = version.match(/export const APP_VERSION = '([^']+)';/);
  const s = sw.match(/const VERSION = "servepoint-v([^-]+)-r(\d+)"/);
  assert.ok(v, 'version.ts must speak APP_VERSION');
  assert.ok(s, 'sw.js must bake the cache word');
  assert.equal(v[1], s[1], 'the two words must agree');
  assert.equal(v[1], '5.282.0');
});
