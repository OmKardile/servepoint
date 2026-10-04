/* Task 248 — v5.209.0 unit suite: the drill speaks the guest's side.
 * The guest drill could say who a guest IS (tier, ladder, book promise,
 * the usual, their tickets) but never what the house GAVE them: the
 * ledger that 5.206 opened on the offer card, 5.207 named on the paper
 * and 5.208 carried out in the file still had no voice in the drawer the
 * counter opens face-to-face. v5.209.0 grows the drill a GIVEN AWAY
 * block — the 5.208 phone bucket rendered at guest scale (the drawer
 * grammar 5.206 taught, crossed to a guest whose rows cross OFFERS —
 * the offer's own name is the row's distinguishing fact, "via").
 * Zero new reads: the ledgerByPhone memo already rides in GuestsInner
 * (ONE read, FIVE facts — the date 5.190, the cost 5.197, the ledger
 * 5.206, the file 5.208, the drill 5.209).
 * Asserted: guestGiveaway's arithmetic (hand-re-addable — the born
 * suite lesson); empty rows → null (structural silence, never a
 * fabricated ₹0 — the chip's own rule); string paise coerced; the
 * THREE-SURFACE agreement — the drill's given == the file's given cell
 * (guestsCsvRows) == the bucket's own sum, one arithmetic across drill,
 * file and chips; source guards — the prop passes the 5.208 bucket
 * (no new read), the double-null render guard (unread ledger → null,
 * empty bucket → null), the aria names the money and the count, the
 * orphan keeps the ticket's silence in the title, the block renders the
 * read's own order (no .sort), the Tag voice.
 * Run: bunx vite-node scripts/unit248.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const { guestGiveaway, redemptionsByPhone, guestsCsvRows } = await import(
  '/src/components/customers/CustomersScreen.tsx'
);

const strip = (p) =>
  readFileSync(new URL(p, import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l))
    .join('\n');
const scrCode = strip('../src/components/customers/CustomersScreen.tsx');

/* ── the fixture — Maya's own shape: 2 rows on one phone, ₹50 each ── */
const r1 = { offerId: 'o1', discountAmount: 50, customerPhone: '98765 43210', createdAt: '2026-10-04T11:28:00+05:30' };
const r2 = { offerId: 'o2', discountAmount: 50, customerPhone: '9876543210', createdAt: '2026-10-02T12:13:00+05:30' };

/* ── 1 — the arithmetic (hand-re-addable) ── */
const give = guestGiveaway([r1, r2]);
assert.equal(give.count, 2);
assert.equal(give.given, 100);
const one = guestGiveaway([{ discountAmount: 44 }]);
assert.equal(one.count, 1);
assert.equal(one.given, 44);
ok('guestGiveaway: 50+50 → 2/₹100; single row → 1/₹44');

/* ── 2 — structural silence: empty bucket → null ── */
assert.equal(guestGiveaway([]), null);
assert.equal(guestGiveaway(null), null);
ok('empty bucket → null (the block never renders, never a fabricated ₹0)');

/* ── 3 — the boundary coerces: string paise still sum ── */
assert.equal(guestGiveaway([{ discountAmount: '50' }, { discountAmount: '44' }]).given, 94);
ok('string paise coerced at the boundary');

/* ── 4 — the THREE-SURFACE agreement: drill == file == bucket ──
 * The counter opens the drill (5.209), carries the file out (5.208),
 * and reads the offers tab's chips (5.197) — all three must quote the
 * same money for the same guest. */
const bucket = redemptionsByPhone([r1, r2, { offerId: 'o2', discountAmount: 50, customerPhone: null, createdAt: '2026-10-01T09:00:00+05:30' }]).get('9876543210');
const guests = [{ g: { name: 'Asha', phone: '98765 43210', created_at: '2026-01-10T10:00:00+05:30' }, s: null }];
const fileCell = guestsCsvRows(guests, redemptionsByPhone([r1, r2]))[1][10];
assert.equal(guestGiveaway(bucket).given, Number(fileCell), 'the drill speaks the file\'s cell');
assert.equal(guestGiveaway(bucket).given, bucket.reduce((s, r) => s + Number(r.discountAmount ?? 0), 0), 'the drill speaks the bucket\'s own sum');
ok("three-surface agreement: the drill's given == the file's cell == the bucket's sum (one arithmetic)");

/* ── 5 — source guards: the bucket rides, silence is structural ── */
assert.ok(scrCode.includes('ledger={ledgerByPhone ? (ledgerByPhone.get(phoneDigits(detailFor.phone)) ?? null) : null}'), 'the drill receives the 5.208 bucket — no new read');
assert.ok(scrCode.includes('if (!ledger) return null;'), 'unread ledger → the block stays silent');
assert.ok(scrCode.includes('const give = guestGiveaway(ledger);') && scrCode.includes('if (!give) return null;'), 'empty bucket → the block stays silent (structural, not a rendering accident)');
assert.ok(scrCode.includes('aria-label={`Given away ${formatMoney(give.given)} across ${give.count}'), 'the aria names the money and the count');
assert.ok(scrCode.includes("r.orderTotal != null ? ` on a ${formatMoney(Number(r.orderTotal))} ticket` : ''"), 'the orphan keeps the ticket\'s silence in the title (a missing total is not a ₹0 ticket)');
assert.ok(scrCode.includes('via {r.title}'), "the row names the offer it went through ('via' — the distinguishing fact at guest scale)");
assert.ok(scrCode.includes('{ledger.map((r, i) => ('), 'the block renders the bucket in the read\'s own order');
assert.ok(!/ledger\.map\([^)]*\)\.sort/.test(scrCode) && !/\.sort\(\)[^;]*ledger/.test(scrCode), 'no local re-sort — the .order IS the clock');
ok('source guards: the bucket rides, silence structural, aria + orphan + order honest');

console.log(`\nunit248 — ${n} groups green`);
