/* Task 217 — v5.178.0 unit suite: the tax till.
 * Covers the new pure voice in ReportsScreen:
 *   buildGstRegister(rows, dayKey, methodByOrder?) — the GST register over
 *   COLLECTED money only (paid tickets, the money doctrine's own
 *   population): cancelled never happened, unpaid owes still; taxable is
 *   the aggregate's own net formula, GST is each ticket's own tax_amount,
 *   and the CGST/SGST split is the receipt's own display halving
 *   (round(tax/2), remainder to SGST). Day key rides the injected appday
 *   grammar; method rides the payments ledger's first part with the
 *   stored fallback.
 * Run: bunx vite-node scripts/unit217.mjs
 */
import assert from 'node:assert/strict';

const { buildGstRegister } = await import('/src/components/reports/ReportsScreen.tsx');

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const dayKey = (iso) => iso.slice(0, 10); /* test stand-in for appDayKey */
const o = (over = {}) => ({
  id: 't1',
  order_number: 55,
  order_type: 'dine_in',
  status: 'completed',
  subtotal: 280,
  tax_amount: 14,
  discount_amount: 20,
  total: 294,
  payment_status: 'completed',
  payment_method: 'upi',
  created_at: '2026-10-03T11:28:00+05:30',
  ...over,
});

/* 1 — the paid-only population: cancelled never happened, unpaid owes still. */
const rows = buildGstRegister(
  [
    o({ id: 'a' }),
    o({ id: 'b', status: 'cancelled' }),
    o({ id: 'c', payment_status: 'pending' }),
    o({ id: 'd', payment_status: null }),
  ],
  dayKey,
);
assert.equal(rows.length, 1);
assert.equal(rows[0].id ?? rows[0].ticket, 55);
ok('population: paid tickets only — cancelled and unpaid stay out');

/* 2 — per-row arithmetic: the aggregate's own net formula, the receipt's halving. */
const [r] = rows;
assert.equal(r.taxable, 260); /* 280 − 20 */
assert.equal(r.gst, 14);
assert.equal(r.cgst, 7);
assert.equal(r.sgst, 7);
assert.equal(r.gross, 294);
ok("row: taxable subtotal−discount, GST the ticket's own, CGST=SGST=7");

/* 3 — the odd-paise halving: remainder goes to SGST (the receipt's rule). */
const [odd] = buildGstRegister([o({ id: 'odd', tax_amount: 0.03, subtotal: 0.6, discount_amount: 0, total: 0.63 })], dayKey);
assert.equal(odd.cgst, 0.02); /* round(1.5 paise) → 2 */
assert.equal(odd.sgst, 0.01); /* the remainder */
assert.equal(odd.cgst + odd.sgst, 0.03);
ok('odd paise: CGST rounds, SGST keeps the remainder — split always sums');

/* 4 — the day key rides the injected grammar. */
const [d] = rows;
assert.equal(d.day, '2026-10-03');
ok('day key: the appday grammar decides the reporting day');

/* 5 — sort: chronological, then ticket order. */
const many = buildGstRegister(
  [
    o({ id: 'x', order_number: 2, created_at: '2026-10-04T09:00:00+05:30' }),
    o({ id: 'y', order_number: 9, created_at: '2026-10-03T10:00:00+05:30' }),
    o({ id: 'z', order_number: 1, created_at: '2026-10-03T08:00:00+05:30' }),
  ],
  dayKey,
);
assert.deepEqual(many.map((r) => r.ticket), [1, 9, 2]);
ok('sort: day asc, then ticket asc — a register reads chronologically');

/* 6 — method: the ledger's first part wins, stored method is the fallback. */
const ledger = new Map([
  ['a', 'cash'],
  ['q', 'upi'],
]);
const [wm] = buildGstRegister([o({ id: 'a' })], dayKey, ledger);
assert.equal(wm.method, 'cash');
const [fm] = buildGstRegister([o({ id: 'fb', payment_method: 'card' })], dayKey, ledger);
assert.equal(fm.method, 'card');
const [nm] = buildGstRegister([o({ id: 'nope', payment_method: null })], dayKey, ledger);
assert.equal(nm.method, 'cash');
ok('method: ledger part first, stored fallback, cash last resort');

/* 7 — service words: the screen's own TYPE_LABEL. */
const [din] = rows;
assert.equal(din.service, 'Dine-in');
const [tak] = buildGstRegister([o({ id: 't', order_type: 'takeaway' })], dayKey);
assert.equal(tak.service, 'Takeaway');
ok("service: 'Dine-in' / 'Takeaway' — the screen's own words");

/* 8 — empty range → empty register (silence, never zeros). */
assert.deepEqual(buildGstRegister([], dayKey), []);
ok('empty range → empty register');

console.log(`\nunit217 — ${n} asserts born (the tax till)`);
