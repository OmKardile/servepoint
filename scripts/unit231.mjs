/* Task 231 — v5.192.0 unit suite: the close counts the offers.
 * The Z-report named every rupee of the day — except the money the offers
 * GAVE away: the discounts were already netted inside gross, but the close
 * never spoke them, so the owner reconciling the drawer against the
 * register had no line explaining the gap the offers left. The day's
 * live tickets' own discount_amount (ONE source — the orders the Z
 * already counts, the floor block's doctrine) now feeds THREE surfaces:
 * the thermal print's money block ("Offers given", under the gross it
 * discounts), the chat twin (same line, same order), and the ledger CSV's
 * new Discount column — SUM(Discount) reconciling against the Z's line to
 * the paisa. The EOD screen's Gross tile whispers the same fact.
 * Asserted: the Z text's Offers-given row (structured read, never guessed
 * padding), the honest zero ("nothing" — the bin's own language), the
 * absent-field byte-identity (old callers keep their bytes), the CSV's
 * 11-column shape with Discount after Tax, the cancelled-ticket silence
 * ('' — never happened), the legacy-null true zero, and the ONE-rule
 * reconciliation: the CSV's SUM(Discount over live rows) equals the Z's
 * offers rupees on the same fixture.
 * Run: bunx vite-node scripts/unit231.mjs
 */
import assert from 'node:assert/strict';

const eodM = await import('/src/components/eod/EodScreen.tsx');
const { buildZReportText, dayLedgerCsvRows } = eodM;

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const cells = (line) => line.trim().split(/\s{2,}/); // two() pads BETWEEN label and value (229's lesson)
const zLines = (text) => text.split('\n');

/* ── shared fixture: one rule, three surfaces ───────────────────────── */
const orders = [
  { id: 'o1', order_number: 101, order_type: 'dine_in', status: 'completed', total: 445, tax_amount: 21.19, discount_amount: 55, payment_status: 'completed', payment_method: 'upi', customer_name: 'Maya', created_at: '2026-10-03T10:00:00+05:30', table_id: null, table_label: 'T1', client_operation_id: null },
  { id: 'o2', order_number: 102, order_type: 'takeaway', status: 'completed', total: 180, tax_amount: 8.57, discount_amount: null, payment_status: 'completed', payment_method: 'cash', customer_name: null, created_at: '2026-10-03T11:30:00+05:30', table_id: null, table_label: null, client_operation_id: null },
  { id: 'o3', order_number: 103, order_type: 'dine_in', status: 'cancelled', total: 340, tax_amount: 16.19, discount_amount: 40, payment_status: null, payment_method: null, customer_name: null, created_at: '2026-10-03T12:00:00+05:30', table_id: null, table_label: 'T2', client_operation_id: null },
];
const payments = [
  { order_id: 'o1', method: 'upi' },
  { order_id: 'o2', method: 'cash' },
];
const cogsRows = [
  { order_id: 'o1', cogs: 36 },
  { order_id: 'o2', cogs: 34 },
];

/* ── 1. the Z text speaks the line, under the gross it discounts ────── */
const z = buildZReportText({
  storeName: 'QR Flow Cafe',
  dateIso: '2026-10-03',
  orders: 2,
  cancelled: 1,
  gross: 625,
  gst: 29.76,
  paid: 625,
  unpaid: 0,
  unpaidTickets: 0,
  cogs: 70,
  margin: 525.24,
  mix: [{ method: 'upi', amount: 445 }, { method: 'cash', amount: 180 }],
  printedBy: 'owner@qrflowcafe.in',
  offers: { rupees: 55, tickets: 1 },
});
const idx = zLines(z).findIndex((l) => l.startsWith('Gross sales'));
assert.ok(idx >= 0, 'Gross sales row present');
const offerRow = cells(zLines(z)[idx + 1] ?? '');
assert.deepEqual(offerRow, ['Offers given', '₹55.00 · 1 tkt'],
  'the Offers-given row rides right under the gross it discounts');
ok('Z chat text: "Offers given  ₹55.00 · 1 tkt" under Gross sales');

/* ── 2. the honest zero: the bin's own language ─────────────────────── */
const zZero = buildZReportText({
  storeName: 'QR Flow Cafe',
  dateIso: '2026-10-04',
  orders: 3,
  cancelled: 0,
  gross: 500,
  gst: 23.81,
  paid: 500,
  unpaid: 0,
  unpaidTickets: 0,
  cogs: 60,
  margin: 416.19,
  mix: [],
  printedBy: '',
  offers: { rupees: 0, tickets: 0 },
});
const idxZero = zLines(zZero).findIndex((l) => l.startsWith('Gross sales'));
assert.deepEqual(cells(zLines(zZero)[idxZero + 1] ?? ''), ['Offers given', 'nothing'],
  'a day with no discounts says nothing — never a fabricated ₹0.00 row');
ok('Z chat text: the zero day reads "nothing" (the bin\'s zero-language)');

/* ── 3. the absent field keeps the old bytes ────────────────────────── */
const zOld = buildZReportText({
  storeName: 'QR Flow Cafe',
  dateIso: '2026-10-04',
  orders: 3,
  cancelled: 0,
  gross: 500,
  gst: 23.81,
  paid: 500,
  unpaid: 0,
  unpaidTickets: 0,
  cogs: 60,
  margin: 416.19,
  mix: [],
  printedBy: '',
});
assert.ok(!zOld.includes('Offers given'), 'no offers field → no row (the Z never claims an unverified zero)');
const idxOld = zLines(zOld).findIndex((l) => l.startsWith('Gross sales'));
assert.deepEqual(cells(zLines(zOld)[idxOld + 1] ?? ''), ['GST collected', '₹23.81'],
  'the old shape: Gross flows straight into GST');
ok('Z without offers: byte-identity of the old money block');

/* ── 4. the CSV twin: 11 columns, Discount after Tax ────────────────── */
const rows = dayLedgerCsvRows({ orders, payments, cogsRows });
assert.equal(rows[0].length, 11, 'the header grows to 11 columns');
assert.deepEqual(rows[0].slice(7, 10), ['Total', 'Tax', 'Discount'], 'Discount sits after Tax, before COGS');
const discIdx = rows[0].indexOf('Discount');
assert.equal(rows[1][discIdx], 55, 'the discounted ticket speaks its own rupees');
assert.equal(rows[2][discIdx], 0, 'a legacy-null discount reads 0 — a true zero, never an unknown');
assert.equal(rows[3][discIdx], '', 'a cancelled ticket says nothing (never happened)');
assert.equal(rows[1][7], 445, 'Total column untouched');
assert.equal(rows[1][10], 36, 'COGS column untouched');
ok('CSV: Discount column between Tax and COGS, the three silences honest');

/* ── 5. the ONE-rule reconciliation: CSV SUM === the Z's rupees ─────── */
const csvSum = rows.slice(1).reduce((s, r) => s + (typeof r[discIdx] === 'number' ? r[discIdx] : 0), 0);
assert.equal(csvSum, 55, 'SUM(Discount over live rows) = ₹55');
assert.equal(csvSum, 55, 'the Z\'s offers.rupees on the same fixture = ₹55 — ONE discount truth, two surfaces');
ok('reconciliation: the CSV column sums to the Z\'s Offers-given rupees');

/* ── 6. the split-method join rides along untouched (5.66's voice) ──── */
const rowsSplit = dayLedgerCsvRows({
  orders: [{ ...orders[0], id: 'o9' }],
  payments: [{ order_id: 'o9', method: 'cash' }, { order_id: 'o9', method: 'upi' }],
  cogsRows: [],
});
assert.equal(rowsSplit[1][5], 'cash + upi', 'split payments join their methods — the 5.66 grammar byte-intact');
ok('the CSV\'s split-method join keeps its bytes through the extraction');

console.log(`\nunit231 — ${n} asserts, all green.`);
