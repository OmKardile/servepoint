/* Task 234 — v5.195.0 unit suite: the drill speaks paid.
 * The guest drill's ticket rows wear the kitchen's own status chip
 * (preparing / ready / completed) AND a stamp "when · payment" — but
 * the stamp spoke the DB payment_status enum raw ("completed"), so a
 * PAID ticket still in the kitchen read "preparing · completed": two
 * registers colliding on one line, the plain reading a contradiction.
 * paymentWords translates the payment into the register this screen
 * already speaks everywhere else ("₹409.50 paid", "Paid visits",
 * "Paid total"): completed → paid, pending/blank → unpaid (Bills' own
 * word), refunded stays refunded, unseen enums pass through honest.
 * Asserted: the truth table (paid / unpaid / refunded / passthrough,
 * case-insensitive, null-safe); THE REGISTER GUARD — no input the
 * drill can receive ever yields 'completed' from paymentWords (that
 * word belongs to the ticket's kitchen status, one word one owner);
 * THE ROUND GUARD — the old raw-enum stamp absent from live copy
 * (comment lines stripped, 233's lesson: a docstring may quote the
 * collision it fixes, a literal may not); the new wiring present.
 * Run: bunx vite-node scripts/unit234.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const cust = await import('/src/components/customers/CustomersScreen.tsx');
const { paymentWords } = cust;

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

/* 1–4 — the truth table, the money register the screen already speaks. */
assert.equal(paymentWords('completed'), 'paid');
ok("completed → paid (the DB enum joins the screen's own register)");

assert.equal(paymentWords('pending'), 'unpaid');
assert.equal(paymentWords(null), 'unpaid');
assert.equal(paymentWords(undefined), 'unpaid');
assert.equal(paymentWords(''), 'unpaid');
assert.equal(paymentWords('PENDING'), 'unpaid');
ok('pending / blank / null → unpaid (Bills\u2019 own word for money owed)');

assert.equal(paymentWords('refunded'), 'refunded');
assert.equal(paymentWords('partially_refunded'), 'refunded');
ok('refunded stays refunded — the DB word IS the payment truth there');

assert.equal(paymentWords('failed'), 'failed');
assert.equal(paymentWords('paid'), 'paid');
ok('an unseen enum passes through honest, never renamed');

/* 5 — THE REGISTER GUARD: sweep every plausible payment_status value the
 *     drill can receive; none may yield 'completed'. That word belongs
 *     to the ticket's kitchen status — the collision this round kills. */
const sweep = [
  'completed', 'pending', 'refunded', 'partially_refunded',
  '', null, undefined, 'PAID', 'Unpaid', 'failed', 'authorized',
];
for (const v of sweep) {
  assert.notEqual(paymentWords(v), 'completed', `input ${String(v)} must not yield 'completed'`);
}
ok('the register guard — paymentWords never yields "completed" (one word, one owner)');

/* 6–7 — THE ROUND GUARD on live copy (comment lines stripped first:
 *     233's lesson — a docstring may quote the collision it fixes). */
const src = readFileSync(
  new URL('../src/components/customers/CustomersScreen.tsx', import.meta.url),
  'utf8',
);
const live = src
  .split('\n')
  .filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l))
  .join('\n');
assert.ok(
  !live.includes("{String(o.payment_status || 'pending')}"),
  'the raw-enum stamp must be gone from live copy',
);
ok('the round guard — the raw DB-enum stamp absent from live copy');

assert.ok(live.includes('· {paymentWords(o.payment_status)}') || live.includes('{paymentWords(o.payment_status)}'));
ok('the stamp now wires paymentWords(o.payment_status)');

/* 8 — the unpaid word wears the amber nudge (the styling affordance). */
assert.ok(live.includes("paymentWords(o.payment_status) === 'unpaid'"));
assert.ok(live.includes('font-semibold text-[#8A5A00]'));
ok("the unpaid word wears the amber service nudge (#8A5A00)");

console.log(`\nunit234: ${n} asserts — the drill speaks the payment's register, not the DB's.`);
