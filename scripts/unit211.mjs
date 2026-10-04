/* Task 211 — v5.172.0 unit suite: the shelf's days.
 * Covers the new pure voices:
 *   src/lib/movers.ts — computePaceByItem: the WHOLE-menu paid pace (the
 *   rail's rank is a top-5 question; pace is not). Same ledger, same rules,
 *   minus the cap; computeTopMovers' cap regression-covered too.
 *   src/lib/shelf.ts — shelfDays (the NUMBER, one math) and shelfDaysClause
 *   (the WORDS), and counterShelfLine's optional pace: the answer grows a
 *   days clause only when BOTH sides answer; byte-identical text otherwise.
 * Run: bunx vite-node scripts/unit211.mjs
 */
import assert from 'node:assert/strict';

const { computeTopMovers, computePaceByItem } = await import('/src/lib/movers.ts');
const { shelfDays, shelfDaysClause, counterShelfLine, shelfVoice, shelfTone } = await import(
  '/src/lib/shelf.ts'
);

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const cov = (coverage, thin = null, unknown = false) => ({ coverage, thin, unknown });
const flour = { id: 'f', name: 'Flour' };
const row = (menu_item_id, qty) => ({ order_id: 'o1', menu_item_id, name: 'Dish', qty, unit_price: 100 });

/* ── computePaceByItem — the pace the days voice divides by ── */

/* 1 — units sum per dish across rows. */
const pace = computePaceByItem([row('a', 34), row('a', 6), row('b', 12)]);
assert.equal(pace.get('a'), 40);
assert.equal(pace.get('b'), 12);
ok('pace sums units per dish');

/* 2 — lines without a live dish are skipped (legacy/deleted rows). */
const pace2 = computePaceByItem([row(null, 99), row('a', 5)]);
assert.equal(pace2.size, 1);
assert.equal(pace2.get('a'), 5);
ok('null menu_item lines never masquerade as pace');

/* 3 — NO CAP: pace answers for the whole menu, beyond the rail's five. */
const many = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => row(id, i + 1));
assert.equal(computePaceByItem(many).size, 6);
ok('whole-menu pace: 6 dishes read, no top-5 cap');

/* 4 — quiet week: empty ledger, empty pace. */
assert.equal(computePaceByItem([]).size, 0);
ok('empty ledger → empty pace map');

/* 5 — computeTopMovers regression: the cap survives the refactor. */
assert.equal(computeTopMovers(many).length, 5);
ok('computeTopMovers still pins exactly five');

/* ── shelfDays — the NUMBER (one math) ── */

/* 6 — the join: coverage 59 at 34 units/week → 59·7/34 ≈ 12.147. */
const d = shelfDays(59, 34);
assert.ok(Math.abs(d - 59 * 7 / 34) < 1e-9);
ok('shelfDays = coverage × window ÷ units (59@34 → ~12.15)');

/* 7 — silence when either side stays home. */
assert.equal(shelfDays(59, 0), null);
assert.equal(shelfDays(59, null), null);
assert.equal(shelfDays(59, undefined), null);
assert.equal(shelfDays(0, 34), null);
assert.equal(shelfDays(null, 34), null);
assert.equal(shelfDays(-3, 34), null);
ok('no pace or no coverage → the shelf refuses to speak time');

/* ── shelfDaysClause — the WORDS ── */

/* 8 — the ordinary voice: floored days. */
assert.equal(shelfDaysClause(59, 34), '~12 days at this pace');
ok('59@34 → "~12 days at this pace"');

/* 9 — the singular boundary: exactly 1.0 day reads one day, not days. */
assert.equal(shelfDaysClause(5, 35), '~1 day at this pace');
ok('5@35 = exactly 1.0 → "~1 day" singular');

/* 10 — under a day speaks honestly. */
assert.equal(shelfDaysClause(3, 34), 'less than a day at this pace');
ok('3@34 ≈ 0.62 → "less than a day at this pace"');

/* 11 — past a fortnight the voice moves to weeks. */
assert.equal(shelfDaysClause(100, 7), '~14 weeks at this pace');
assert.equal(shelfDaysClause(14, 7), '~2 weeks at this pace');
assert.equal(shelfDaysClause(13, 7), '~13 days at this pace');
ok('14 days boundary: weeks above, days below');

/* 12 — the clause is silent exactly when the number is. */
assert.equal(shelfDaysClause(59, 0), null);
assert.equal(shelfDaysClause(0, 34), null);
ok('clause silence mirrors the number (no re-answering)');

/* ── counterShelfLine with pace — the contract grows a clause ── */

/* 13 — comfortable: voice + days, tone unchanged. */
const comfy = counterShelfLine(cov(59, flour), 34);
assert.equal(comfy.text, '~59 more on the shelf — ~12 days at this pace');
assert.equal(comfy.tone, '#2E7D32');
assert.equal(comfy.tone, shelfTone(cov(59, flour)));
ok('comfortable + pace: clause rides, tone is the family green');

/* 14 — low: the amber voice, timed. */
const lowTimed = counterShelfLine(cov(4, flour), 34);
assert.equal(lowTimed.text, '~4 more left — less than a day at this pace');
assert.equal(lowTimed.tone, '#8A5A00');
ok('low + pace: amber "~4 more left — less than a day"');

/* 15 — backward compat: NO pace → byte-identical to the pace-less call.
 * The no-recipe state is SILENCE (null line) at every arity — asserted too. */
for (const c of [cov(0, flour), cov(4, flour), cov(59, flour), cov(null, null, true)]) {
  assert.equal(counterShelfLine(c).text, shelfVoice(c));
  assert.equal(counterShelfLine(c, null).text, shelfVoice(c));
  assert.equal(counterShelfLine(c).tone, shelfTone(c));
}
assert.equal(counterShelfLine(cov(null)), null);
assert.equal(counterShelfLine(cov(null), 34), null);
ok('pace absent/null → text and tone byte-identical to 5.170.0');

/* 16 — zero coverage never gains a clause (it already said its piece). */
const zeroTimed = counterShelfLine(cov(0, flour), 34);
assert.equal(zeroTimed.text, "can't make another — Flour is out");
ok('zero: the out voice stands alone — no days appended');

/* 17 — unknown never gains a clause. */
const unkTimed = counterShelfLine(cov(null, null, true), 34);
assert.equal(unkTimed.text, "shelf can't answer");
ok('unknown: "can\'t answer" stands alone — no days appended');

console.log(`\nunit211: ${n} asserts PASS`);
