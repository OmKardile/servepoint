/* Task 228 — v5.189.0 unit suite: the accountant reads the chase.
 * Covers the new pure export in BillsScreen:
 *   billsCsvRows — the accountant's twin, now row-for-row the screen's own
 *     voice on THREE new/changed counts:
 *     • the AGE column speaks the row chip's own rule (5.151: unpaid AND
 *       from an earlier day) with chaseAge as THE register — silence for
 *       today's unpaid (not aged yet), paid, and cancelled tickets;
 *     • the OPEN (INR) column speaks the chase's own math — active: what's
 *       still out (max(0, total − paid parts)); paid: '0.00' (the debt
 *       closed — true, not filler); cancelled: silence (never happened);
 *     • on the unfiltered export the Open column SUMS to the chase strip's
 *       OUT — the sheet and the screen verify each other with one SUM().
 *   Every pre-existing cell keeps its bytes (the 5.63 partial voice included).
 *   nowMs is injected — the suite owns the clock (unit201's lesson: never
 *   let a run-hour coin-flip into a fixture; the 'today' stamp is built ON
 *   the run's own local day at 09:00, and age VALUES are asserted against
 *   chaseAge itself, never a literal that the hour could flip).
 * Run: bunx vite-node scripts/unit228.mjs
 */
import assert from 'node:assert/strict';

const { billsCsvRows } = await import('/src/components/bills/BillsScreen.tsx');
const { chaseAge } = await import('/src/lib/day.ts');

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

/* ── fixtures — stamps built ON day keys, never hour offsets ── */
const now = new Date();
/* 'today' = the run's own local day at 09:00 — same-local-day for EVERY run
 * hour, so the chip-rule side of the age cell is deterministic. */
const todayStamp = new Date(now); todayStamp.setHours(9, 0, 0, 0);
/* 'older' = 3 local days back, same clock time — a different calendar day
 * by construction. */
const olderStamp = new Date(now); olderStamp.setDate(olderStamp.getDate() - 3); olderStamp.setHours(9, 0, 0, 0);
const iso = (d) => d.toISOString();

const order = (id, num, extra = {}) => ({
  id,
  order_number: num,
  status: 'active',
  payment_status: 'pending',
  payment_method: null,
  order_type: 'dine_in',
  customer_name: null,
  table_label: 'T1',
  items: [{ id: 'i1', name: 'Flat White', qty: 1, unit_price: 220, item_total: 220 }],
  subtotal: 220,
  tax_amount: 11,
  discount_amount: 0,
  total: 231,
  notes: '',
  created_at: iso(olderStamp),
  ...extra,
});

const HEADER = ['Order #', 'Placed at', 'Status', 'Age', 'Payment', 'Method', 'Type', 'Customer', 'Table', 'Items', 'Subtotal (INR)', 'GST (INR)', 'Discount (INR)', 'Total (INR)', 'Open (INR)', 'Notes'];

/* 1 — header shape: 16 columns; Age sits between Status and Payment;
 *     Open (INR) sits between Total (INR) and Notes. */
{
  const rows = billsCsvRows([order('a', 1)], new Map(), now.getTime());
  assert.equal(rows[0].length, 16);
  assert.deepEqual(rows[0], HEADER);
  ok('header shape — 16 columns, Age after Status, Open (INR) after Total (INR)');
}

/* 2 — the age cell speaks the chip's OWN rule: unpaid + earlier day →
 *     chaseAge's word; the register rides (value asserted against chaseAge
 *     itself — no run-hour literal in this suite). */
{
  const o = order('older', 66, { total: 693, subtotal: 660, tax_amount: 33 });
  const rows = billsCsvRows([o], new Map(), now.getTime());
  assert.equal(rows[1][2], 'Active');
  assert.equal(rows[1][3], chaseAge(o.created_at, now.getTime()));
  assert.ok(rows[1][3].endsWith('d old'), `expected an Nd-old register, got "${rows[1][3]}"`);
  ok('age cell — unpaid from an earlier day speaks chaseAge (ONE register with the row chip)');
}

/* 3 — today's unpaid is silent in the Age column (the chip's own silence —
 *     a ticket from today is not aged yet), and still speaks its open. */
{
  const o = order('today', 96, { created_at: iso(todayStamp) });
  const rows = billsCsvRows([o], new Map(), now.getTime());
  assert.equal(rows[1][3], '');
  assert.equal(rows[1][14], '231.00');
  ok("age cell — today's unpaid stays silent (the chip's own rule), open still speaks");
}

/* 4 — paid: age silent, open reads '0.00' (the debt closed — true, not filler). */
{
  const o = order('paid', 126, { status: 'active', payment_status: 'completed' });
  const rows = billsCsvRows([o], new Map(), now.getTime());
  assert.equal(rows[1][2], 'Paid');
  assert.equal(rows[1][3], '');
  assert.equal(rows[1][14], '0.00');
  ok("paid ticket — age silent, open '0.00' (the debt closed)");
}

/* 5 — cancelled: both cells silent (never happened — silence, not a dash). */
{
  const o = order('x', 127, { status: 'cancelled', payment_status: 'void' });
  const rows = billsCsvRows([o], new Map(), now.getTime());
  assert.equal(rows[1][2], 'Cancelled');
  assert.equal(rows[1][3], '');
  assert.equal(rows[1][14], '');
  ok('cancelled ticket — age and open both silent');
}

/* 6 — the open cell is the chase's own math: partial payments subtract;
 *     a paid part ABOVE the total clamps at zero (max(0, ·), never negative). */
{
  const part = new Map([['p1', 100]]);
  const o = order('p1', 96, { total: 231, subtotal: 220, tax_amount: 11 });
  assert.equal(billsCsvRows([o], part, now.getTime())[1][14], '131.00');
  const over = new Map([['p1', 400]]);
  assert.equal(billsCsvRows([o], over, now.getTime())[1][14], '0.00');
  ok('open cell — total minus paid parts, clamped at zero (the chase math)');
}

/* 7 — the SUM() pairing: on the unfiltered export the Open column sums to
 *     the chase total — the sheet verifies against the strip with one SUM.
 *     (The chase math itself: active rows, max(0, total − paid).) */
{
  const list = [
    order('o1', 96, { total: 231, created_at: iso(olderStamp) }),
    order('o2', 69, { total: 231, created_at: iso(olderStamp) }),
    order('o3', 66, { total: 693, subtotal: 660, tax_amount: 33, created_at: iso(olderStamp) }),
    order('o4', 126, { total: 294, payment_status: 'completed' }),
    order('o5', 127, { status: 'cancelled', total: 231, payment_status: 'void' }),
  ];
  const part = new Map([['o3', 100]]);
  const rows = billsCsvRows(list, part, now.getTime());
  const sumOpen = rows.slice(1).reduce((s, r) => s + Number(r[14] === '' ? 0 : r[14]), 0);
  const chaseTotal = list
    .filter((o) => o.status === 'active' && o.payment_status !== 'completed')
    .reduce((s, o) => s + Math.max(0, o.total - (part.get(o.id) ?? 0)), 0);
  assert.equal(Math.round(sumOpen * 100) / 100, chaseTotal);
  assert.equal(chaseTotal, 1055); /* 231 + 231 + (693 − 100 in) — the o3 partial rides */
  ok(`Open column sums to the chase total (₹${chaseTotal.toFixed(2)}) — sheet and strip verify each other`);
}

/* 8 — the partial voice keeps its 5.63 bytes; the injected clock shows:
 *     the same list at two nows can age differently (no hidden Date.now). */
{
  const o = order('clock', 96, { created_at: iso(olderStamp) });
  const part = new Map([['clock', 30]]);
  const r1 = billsCsvRows([o], part, now.getTime())[1];
  assert.equal(r1[4], 'partial (30.00 of 231.00 in)');
  const later = now.getTime() + 24 * 3600_000;
  const a1 = billsCsvRows([o], part, now.getTime())[1][3];
  const a2 = billsCsvRows([o], part, later)[1][3];
  assert.notEqual(a1, a2);
  ok('partial voice byte-intact; the injected clock drives the age (two nows, two ages)');
}

/* 9 — sort the sheet by Age and the chase list falls out oldest-first, the
 *     strip's own order: an age-descending read of the age column equals the
 *     oldest-first chase order on the fixture. */
{
  const d1 = new Date(now); d1.setDate(d1.getDate() - 2); d1.setHours(9, 0, 0, 0);
  const d5 = new Date(now); d5.setDate(d5.getDate() - 6); d5.setHours(9, 0, 0, 0);
  const list = [
    order('young', 96, { created_at: iso(d1), order_number: 96 }),
    order('oldest', 66, { created_at: iso(d5), order_number: 66 }),
    order('mid', 69, { created_at: iso(olderStamp), order_number: 69 }),
  ];
  const rows = billsCsvRows(list, new Map(), now.getTime());
  const ages = rows.slice(1).map((r) => r[3]);
  const sortedIdx = rows.slice(1).map((r, i) => ({ i, age: r[3] }))
    .sort((a, b) => parseInt(b.age) - parseInt(a.age))
    .map((x) => x.i);
  assert.equal(sortedIdx[0], rows.slice(1).findIndex((r) => r[0] === 66));
  assert.ok(ages.every((a) => a.endsWith('d old')));
  ok('age column sorted desc reproduces the strip\u2019s oldest-first chase order');
}

console.log(`\n  ${n} asserts — unit228 (v5.189.0 the accountant reads the chase)`);
