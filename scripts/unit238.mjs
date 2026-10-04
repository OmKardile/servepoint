/* Task 238 — v5.199.0 unit suite: the usual names its money.
 * The guest drill carried two rupee figures one line apart and only
 * one said what it was: the header's PAID TOTAL is the TICKET register
 * (the ticket's own total — offers taken, GST added) while THE USUAL's
 * rupees are the MENU-LINE register (qty × the ledger's frozen menu
 * price, before offers and GST). Maya read "₹440.00 of everything
 * they've rung" above "PAID TOTAL ₹409.50" — the same word "rung"
 * answering two questions ₹30.50 apart. The clause now speaks exported
 * register words (the paymentWords pattern): ONE register, ONE owner.
 * Asserted: the exported tails verbatim; the banned collision words
 * ("rung", "everything they") absent from the register words AND from
 * comment-stripped live copy; the wiring (money clause, share aria,
 * the start-the-usual aria now at the ledger's frozen price); and the
 * WORDS-MATCH-THE-ARITHMETIC guard — computeUsual's rupees ARE line
 * money (qty × unit_price on paid tickets only), the fact the new
 * clause names.
 * Run: bunx vite-node scripts/unit238.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const cust = await import('/src/components/customers/CustomersScreen.tsx');
const usualM = await import('/src/lib/usual.ts');
const { USUAL_MONEY_TAIL, USUAL_SHARE_TAIL, computeUsual } = { ...cust, computeUsual: usualM.computeUsual };

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

/* 1–2 — the register words, verbatim. */
assert.equal(USUAL_MONEY_TAIL, 'of menu rings, before offers and GST');
ok('USUAL_MONEY_TAIL names the menu-line register (before offers and GST)');
assert.equal(USUAL_SHARE_TAIL, 'percent of their menu rings');
ok('USUAL_SHARE_TAIL speaks the same register');

/* 3 — the banned collision words stay out of the register. */
assert.ok(!/rung|everything they/i.test(USUAL_MONEY_TAIL), 'the tail never says "rung"');
assert.ok(!/rung|everything they/i.test(USUAL_SHARE_TAIL), 'nor the share tail');
ok('the collision word is banned from the register');

/* 4–6 — THE ROUND GUARD on live copy (comment-blind, 233's lesson). */
const live = readFileSync(
  new URL('../src/components/customers/CustomersScreen.tsx', import.meta.url),
  'utf8',
);
const code = live
  .split('\n')
  .filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l))
  .join('\n');

assert.ok(
  code.includes('{formatMoney(usual.rupees)}</span> {USUAL_MONEY_TAIL}'),
  'the money clause rides the exported tail',
);
assert.ok(!code.includes("of everything they've rung"), 'the old clause is gone from live copy');
assert.ok(!/everything they/i.test(code), 'no "everything they" anywhere in live copy');
ok('live copy: money clause wired, old wording extinct');

assert.ok(
  code.includes('${Math.round(usual.share * 100)} ${USUAL_SHARE_TAIL}'),
  'the share aria rides the exported tail',
);
assert.ok(!code.includes('percent of everything they have rung'), 'the old aria is gone');
ok('live copy: share aria wired');

assert.ok(code.includes("at the ledger's frozen price"), 'the start-the-usual aria names the ledger register');
assert.ok(!code.includes('at the last price they paid'), 'the old "price they paid" is gone');
ok('live copy: start-the-usual aria at the ledger register');

/* 7–9 — WORDS MATCH THE ARITHMETIC: computeUsual's rupees ARE the line
 * register the clause names (qty × frozen unit_price, paid only), so the
 * sentence's plain reading and the reducer can never fork. */
const FW = 'fw';
const paid = (id, items) => ({ id, status: 'ready', payment_status: 'completed', items });
const unpaid = (id, items) => ({ id, status: 'preparing', payment_status: 'pending', items });
{
  const u = computeUsual([
    paid('p1', [{ menu_item_id: FW, name: 'Flat White', qty: 2, unit_price: 220 }]),
    unpaid('u1', [{ menu_item_id: FW, name: 'Flat White', qty: 3, unit_price: 220 }]),
  ]);
  assert.ok(u, 'a paid ticket names a usual');
  assert.equal(u.units, 2, 'unpaid lines stay out of the habit');
  assert.equal(u.rupees, 440, 'rupees = qty × frozen menu price — line money, before offers and GST');
  assert.equal(u.share, 1, 'share divides by paid lines only');
  ok('computeUsual speaks the line register the clause names');
}
{
  const u = computeUsual([unpaid('u1', [{ menu_item_id: FW, name: 'Flat White', qty: 3, unit_price: 220 }])]);
  assert.equal(u, null, 'unpaid-only ledger names nothing — silence');
  ok('unpaid-only ledger: no usual, no clause, silence');
}

console.log(`\nunit238 — ${n} asserts, ALL GREEN`);
