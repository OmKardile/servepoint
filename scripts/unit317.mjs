/* unit317 — v5.278.0 "the money keeps one register" (agreement shape)
 * The census finding: the house's money voice — lib/prefs' formatMoney
 * (290 calls, the en-IN two-decimal register since the 5.233.0 era) — was
 * re-rolled BY HAND in four files beside its lib:
 *   1. the guest book carried its own `money` helper (24 uses) — prefs
 *      are a staff surface, so the guest re-rolled the exact digit shape
 *      with a hardcoded ₹ — AND one raw straggler `₹${round2(a.price)}`
 *      whose paise voice was broken ("₹15.5", no lakh grouping);
 *   2. the dashboard re-rolled the digit shape inline THREE times (the
 *      trending card's title attr, its render, the week footer);
 *   3. the staff customizer's variant pills ran a `% 1 === 0` grammar
 *      that DROPPED the paise voice on whole-rupee deltas ("+₹15" beside
 *      a modal whose totals read "₹115.50") and rendered a ±₹0 pill the
 *      guest's twin never showed — twins disagreeing about the register;
 *   4. and the track page's copy-link still stacked its own 1600ms timer
 *      outside the ack lib (316's census walked the staff surfaces).
 * THE ROUND: lib/money.ts — the register's ONE home. moneyNum is the
 * digit shape (the census byte, in exactly ONE src file); money is the
 * house's ₹-pinned word, PREFS-FREE on purpose (the guest renders where
 * no staff prefs exist); signedMoney is the delta register the twins now
 * share ("+₹15.00" / "−₹5.50" / "±₹0.00"). prefs.formatMoney keeps its
 * own door (the staff's configured symbol) but rides moneyNum's digits.
 * The staff modal adopts the guest's zero-gate (a free variant reads its
 * name alone); the addon line regains its paise and its grouping; and
 * the last hand-rolled ack rides useCopyAck(1600) — the breath law and
 * the fail word (three languages) reach the guest. */

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

const moneyLib = read('src/lib/money.ts');
const prefs = read('src/lib/prefs.ts');
const guest = read('src/components/guest/GuestPages.tsx');
const dashboard = read('src/components/dashboard/DashboardScreen.tsx');
const modal = read('src/components/food/ItemDetailModal.tsx');
const i18n = read('src/lib/guest-i18n.ts');
const useCopyAck = read('src/lib/useCopyAck.ts');
const clipboard = read('src/lib/clipboard.ts');
const offerLabel = read('src/lib/offerLabel.ts');
const version = read('src/version.ts');
const sw = read('public/sw.js');

function check(name, fn) {
  test(name, () => fn());
  console.log(`  running — ${name}`);
}

/* ── 1. the lib speaks the census ─────────────────────────────────────── */
check('the money lib exists and speaks its census — the shape, the word, the register', () => {
  assert.ok(moneyLib.includes('v5.278.0'), 'the lib carries the version word');
  assert.ok(moneyLib.includes('export function moneyNum('), 'the digit shape is exported');
  assert.ok(moneyLib.includes('export function money('), 'the house word is exported');
  assert.ok(moneyLib.includes('export function signedMoney('), 'the delta register is exported');
  assert.ok(moneyLib.includes("toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })"), 'the census byte lives HERE');
  assert.ok(moneyLib.includes('return `₹${moneyNum(amount)}`;'), 'the word pins ₹ through the ONE shape');
  assert.ok(moneyLib.includes("if (n > 0) return `+${money(n)}`;") && moneyLib.includes("if (n < 0) return `−${money(-n)}`;") && moneyLib.includes("return '±₹0.00';"), 'the register speaks the whole signed voice');
  assert.ok(!moneyLib.includes('import '), 'the lib imports NOTHING — prefs-free by design (the guest renders where no staff prefs exist)');
});

/* ── 2. the census law: the digit shape is spoken once ────────────────── */
check('the en-IN 2dp digit shape lives in exactly ONE src file — the money lib', () => {
  const holders = walk('/home/z/my-project/src')
    .map((f) => [f, readFileSync(f, 'utf8')])
    .filter(([, src]) => src.includes("toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })"));
  assert.deepEqual(holders.map(([f]) => f), ['/home/z/my-project/src/lib/money.ts'], `the shape is still re-rolled in: ${holders.map(([f]) => f).join(', ')}`);
  assert.ok(prefs.includes('moneyNum(amount)'), 'prefs.formatMoney rides the ONE shape for its digits');
  assert.ok(prefs.includes("const sym = currency || getPrefs().currency;"), 'the staff symbol door stands — formatMoney keeps the configured currency');
});

/* ── 3. the guest book rides home ─────────────────────────────────────── */
check('the guest book rides the one register — its own helper and the raw straggler are gone', () => {
  assert.ok(!guest.includes('const money = ('), 'the guest\u2019s local money helper is retired');
  assert.ok(!guest.includes('₹${round2('), 'the raw ₹-interpolation straggler is gone — the broken paise voice with it');
  assert.ok(guest.includes("import { money, signedMoney } from '../../lib/money';"), 'the guest imports the ONE register');
  assert.ok(guest.includes('money(a.price)'), 'the addon line speaks the register — paise and grouping restored');
  assert.ok(guest.includes('tabular-nums text-[#6B6B6B]'), 'the addon line wears the tabular voice');
  assert.ok(guest.includes('signedMoney(v.price_delta)'), 'the guest pill rides the signed register');
  assert.ok(guest.includes('round2(item.price + (variant?.price_delta || 0)'), 'round2 stays — it is MATH (line-total arithmetic), not voice');
  assert.ok(!guest.includes("from '../../lib/clipboard'"), 'the guest no longer imports the door directly — the ack lib does');
});

/* ── 4. the staff modal speaks the register ───────────────────────────── */
check('the staff customizer adopts the register — paise held, the zero pill retired, the twins agree', () => {
  assert.ok(!modal.includes('+₹$'), 'the hand-rolled +₹ template is gone');
  assert.ok(!modal.includes("'±₹0'"), 'the bare ±₹0 code literal is gone');
  assert.ok(!/price_delta\)\s*% 1 === 0/.test(modal), 'the % 1 === 0 grammar is gone from the code');
  assert.ok(modal.includes('signedMoney(Number(v.price_delta))'), 'the pill rides the signed register');
  assert.ok(modal.includes('v.price_delta !== 0 && ('), 'the zero pill is gated — the guest twin\u2019s shape (a free variant reads its name alone)');
  assert.ok(modal.includes('import { signedMoney } from \'../../lib/money\';'), 'the modal imports the register');
  assert.ok(modal.includes('Update · {formatMoney(round2(runningUnit * qty))}'), 'the CTA\u2019s own law (unit311) stands untouched');
});

/* ── 5. the dashboard rides the lib ───────────────────────────────────── */
check('the dashboard\u2019s three inline re-rolls ride the one word', () => {
  assert.ok(!dashboard.includes('minimumFractionDigits'), 'no inline digit-shape re-roll remains');
  assert.ok(dashboard.includes('import { money } from \'../../lib/money\';'), 'the dashboard imports the register');
  assert.ok(dashboard.includes('{money(Number(dish.revenue) || 0)}'), 'the trending card renders the word');
  assert.ok(dashboard.includes('${money(Number(dish.revenue) || 0)} carried by'), 'the title attr speaks the same word');
  assert.ok(dashboard.includes('{money(weekRevenue)}'), 'the week footer speaks the word');
  assert.ok(dashboard.includes('carried by ${dish.orders} ${dish.orders === 1 ? \'plate\' : \'plates\'}'), 'the honest singular/plural title stands (unit270\u2019s law)');
});

/* ── 6. the last hand-rolled ack is home ──────────────────────────────── */
check('the track page\u2019s copy-link rides the ack breath — and the refusal speaks three languages', () => {
  assert.ok(guest.includes('const [copyAck, runCopy] = useCopyAck(1600);'), 'the ack rides the ONE breath — the 1600 breath kept');
  assert.ok(guest.includes('runCopy(window.location.href);'), 'the honest door drives the word');
  assert.ok(!guest.includes('setCopied'), 'the hand-rolled boolean and its stacked timer are gone');
  assert.ok(guest.includes('aria-live="polite"'), 'the guest\u2019s ack announces like every ack in the house');
  assert.ok(guest.includes("border-[#8A5A00]/50 text-[#8A5A00]"), 'the refusal wears the house\u2019s warning amber');
  assert.ok(guest.includes("copyAck === 'ok' ? t('copied') : copyAck === 'fail' ? t('copyBlocked') : t('copyLink')"), 'the word is the guest\u2019s own i18n — ok, fail, and idle');
  assert.ok(i18n.split('copyBlocked:').length - 1 === 3, 'the fail word speaks exactly three languages (en/hi/kn)');
  assert.ok(i18n.includes("copyBlocked: 'Copy blocked'") && i18n.includes("copyBlocked: 'कॉपी नहीं हो सका'") && i18n.includes("copyBlocked: 'ನಕಲಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ'"), 'each language carries its own honest refusal');
});

/* ── 7. the doctrine stands ───────────────────────────────────────────── */
check('the doctrine is not vandalized — the door, the breath, the paise tradition stay standing', () => {
  assert.ok(clipboard.includes('export async function copyText'), 'the one door stands');
  assert.ok(useCopyAck.includes('v5.277.0'), 'the ack lib stands untouched — 316\u2019s home keeps its word');
  assert.ok(offerLabel.includes('register never rounds'), 'the paise tradition\u2019s own words stand — a money register never rounds');
  assert.ok(walk('/home/z/my-project/src').filter((f) => !f.endsWith('lib/clipboard.ts') && /navigator\.clipboard|execCommand/.test(readFileSync(f, 'utf8'))).length === 0, 'the clipboard census law holds — the raw API is spoken once');
  assert.ok(!prefs.includes("₹${"), 'prefs never re-rolls the ₹ word itself — the symbol is data, the digits are the lib\u2019s');
});

/* ── 8. the version law ───────────────────────────────────────────────── */
check('APP_VERSION and sw.js agree — the agreement shape', () => {
  const v = version.match(/APP_VERSION = '([^']+)'/)?.[1];
  assert.ok(v, 'version.ts speaks a version');
  assert.match(v, /^5\.278\.0$/, 'this round\u2019s word is 5.278.0');
  assert.ok(sw.includes(`const VERSION = "servepoint-v${v}-r1";`), 'the service worker bakes the SAME word');
});
