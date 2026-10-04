/* Task 247 — v5.208.0 unit suite: the file carries the guest's side.
 * The book's CSV could say who a guest IS (name, phone, tier, spend) but
 * not what the house GAVE them: the redemption ledger that 5.206 opened
 * on the card and 5.207 named on the paper stayed silent in the file the
 * counter carries out. v5.208.0 grows the file three columns — 'Offer
 * redemptions', 'Given away (INR)', 'Last redemption' — joined by the
 * CRM's identity key since v5.5 (phoneDigits both sides; the echo never
 * guesses), riding the SAME read the offers tab holds (ONE read, FOUR
 * facts). The row shape grew customerPhone straight from the same orders
 * embed — a free derivation (5.197), never a second read.
 * Asserted: redemptionsByPhone's join (formatting variants are ONE guest;
 * an anonymous ticket never claims a guest — counted in the take, silent
 * in the book; buckets preserve the read's own newest-first order — the
 * .order IS the clock); the file's full content via the EXPORTED PURE
 * builder (228's billsCsvRows pattern) — hand-re-addable cells, the 9
 * original columns byte-identical (5.201's contract holds); the
 * landed-vs-null register grammar (a landed read speaks 0/0.00/'', a
 * null read stays '' — the unread ledger never becomes an invented
 * number, 5.190 at file scale); string paise coerced; the family
 * agreement (guest side + anonymous = the whole-book take the paper and
 * the chips speak); source guards — the select carries the phone, the
 * button passes the ledger, the memo slices the same ride.
 * Run: bunx vite-node scripts/unit247.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const { redemptionsByPhone, guestsCsvRows, offerGivenAway } = await import(
  '/src/components/customers/CustomersScreen.tsx'
);

const strip = (p) =>
  readFileSync(new URL(p, import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l))
    .join('\n');
const scrCode = strip('../src/components/customers/CustomersScreen.tsx');
const apiCode = strip('../src/lib/api.ts');

/* ── the fixture — the live CheeseBurg ledger's own shape, two guests ──
 * r1/r2 are the SAME guest ("98765 43210" == "9876543210" — 5.5's echo);
 * r3 a second guest; r4 an anonymous ticket (no phone on the order).
 * Newest-first, as the api's .order delivers. 50+50+44+50 = 194 — the
 * paper's own number (5.207). */
const r1 = { offerId: 'o1', discountAmount: 50, customerPhone: '98765 43210', createdAt: '2026-10-04T11:28:00+05:30' };
const r2 = { offerId: 'o1', discountAmount: 50, customerPhone: '9876543210', createdAt: '2026-10-02T12:13:00+05:30' };
const r3 = { offerId: 'o2', discountAmount: 44, customerPhone: '9000011111', createdAt: '2026-10-02T10:55:00+05:30' };
const r4 = { offerId: 'o2', discountAmount: 50, customerPhone: null, createdAt: '2026-10-01T09:00:00+05:30' };
const ledgerRows = [r1, r2, r3, r4];

/* ── 1 — the join: digits both sides, formatting variants are ONE guest ── */
const byPhone = redemptionsByPhone(ledgerRows);
assert.equal(byPhone.size, 2, 'two guests, the anonymous row claims nobody');
assert.deepEqual([...byPhone.get('9876543210')], [r1, r2], 'the echo lands in one bucket');
assert.deepEqual([...byPhone.get('9000011111')], [r3]);
ok('redemptionsByPhone: formatting variants are one guest; anonymous claims nobody');

/* ── 2 — the order IS the clock: buckets preserve the read's order ── */
const bucket = byPhone.get('9876543210');
assert.equal(bucket[0], r1, 'newest first, no local re-sort');
assert.ok(new Date(bucket[0].createdAt) > new Date(bucket[1].createdAt));
ok("bucket order == the read's order (the .order contract is the clock)");

/* ── 3 — the file's full content: hand-re-addable cells ── */
const guests = [
  { g: { name: 'Asha', phone: '98765 43210', created_at: '2026-01-10T10:00:00+05:30' }, s: { visits: 6, total_spent: 5210 } },
  { g: { name: 'Bunty', phone: '9000011111', created_at: '2026-02-02T10:00:00+05:30' }, s: { visits: 2, total_spent: 640 } },
  { g: { name: 'Champa', phone: '7000000000', created_at: '2026-03-03T10:00:00+05:30' }, s: null },
];
const map = new Map([
  ['9876543210', [r1, r2]],
  ['9000011111', [r3]],
]);
const lines = guestsCsvRows(guests, map);
assert.equal(lines[0].length, 12, '9 original + 3 ledger columns');
assert.deepEqual(
  lines[0].slice(0, 9),
  ['Name', 'Phone', 'Tier', 'Paid visits', 'Paid total (INR)', 'Last ticket', 'On the book since', 'Email', 'Notes'],
  'the 9 original columns byte-identical (5.201 contract holds)',
);
assert.deepEqual(lines[0].slice(9), ['Offer redemptions', 'Given away (INR)', 'Last redemption']);
const asha = lines[1];
assert.equal(asha[9], 2, 'Asha: 2 redemptions');
assert.equal(asha[10], '100.00', 'Asha: 50 + 50 given');
assert.equal(asha[11], new Date(r1.createdAt).toLocaleString(), 'Asha: last = the bucket head, no re-sort');
const bunty = lines[2];
assert.equal(bunty[9], 1);
assert.equal(bunty[10], '44.00');
const champa = lines[3];
assert.equal(champa[9], 0, 'a landed read: no rows is a PROVABLE zero (the register all surfaces share)');
assert.equal(champa[10], '0.00', 'the money agrees with the count — one fact, two registers');
assert.equal(champa[11], '', 'no row, no date — never an invented never (5.190 at file scale)');
ok("the file's guest side: 2/₹100.00, 1/₹44.00, the untouched guest speaks a provable 0/0.00/''");

/* ── 4 — the null register: an unread ledger never becomes a number ── */
const silent = guestsCsvRows(guests, null);
for (const row of silent.slice(1)) {
  assert.equal(row[9], '');
  assert.equal(row[10], '');
  assert.equal(row[11], '');
}
ok('ledger null → all three cells silent (the unread ledger never becomes an invented 0)');

/* ── 5 — the boundary coerces: string paise still sum ── */
const strMap = new Map([['8000000000', [{ discountAmount: '50' }, { discountAmount: '44', customerPhone: '8000000000' }]]]);
assert.equal(guestsCsvRows([{ g: { name: 'X', phone: '8000000000', created_at: '2026-01-01' }, s: null }], strMap)[1][10], '94.00');
ok('string paise coerced at the boundary');

/* ── 6 — the family agreement: guest side + anonymous = the whole book ──
 * The paper (offersTake) and the chips (offerGivenAway) speak the
 * WHOLE-book take; the file speaks the phoned side. The anonymous row is
 * counted in the take and silent in the book (5.206's orphan discipline
 * at phone scale). */
const wholeBook = [...offerGivenAway(ledgerRows).values()].reduce((s, v) => s + v, 0);
assert.equal(wholeBook, 194, 'the family sum is the paper ₹194');
const guestSide = [...map.values()].flat().reduce((s, r) => s + Number(r.discountAmount ?? 0), 0);
assert.equal(guestSide, 144, 'the phoned side: 50+50+44');
assert.equal(wholeBook - guestSide, 50, 'the anonymous ₹50 speaks in the take, silent in every book row');
ok('family agreement: take 194 = guests 144 + anonymous 50 (counted in the take, silent in the book)');

/* ── 7 — source guards: the phone rides the read, the file rides the memo ── */
assert.ok(apiCode.includes('orders(total, customer_phone)'), 'the select grew the phone on the SAME orders embed');
assert.ok(apiCode.includes('customerPhone: r.orders?.customer_phone ?? null'), 'the row maps the phone (null on anonymous)');
assert.ok(scrCode.includes('if (!d) continue; // an anonymous ticket never claims a guest'), 'the slicer skips empty digits');
assert.ok(scrCode.includes('export function guestsCsvRows'), 'the builder is exported pure (the suite owns the file)');
assert.ok(scrCode.includes('downloadCsv(`servepoint-guests-${appTodayIso()}.csv`, guestsCsvRows(rows, ledger))'), 'the wrapper carries the builder out');
assert.ok(scrCode.includes('exportGuestsCsv(rows, ledgerByPhone)'), 'the button passes the ledger');
assert.ok(scrCode.includes('redemptions ? redemptionsByPhone(redemptions) : null'), 'the memo slices the SAME read (one read, four facts)');
ok('source guards: the phone rides the read, the file rides the memo, one read four facts');

console.log(`\nunit247 — ${n} groups green`);
