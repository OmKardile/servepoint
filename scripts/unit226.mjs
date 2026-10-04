/* Task 226 — v5.187.0 unit suite: the shelf's last touch.
 * The inventory row has always spoken the FUTURE (days of cover at the
 * dishes' burn — shelfDaysClause, 5.176's noun swap) but never the PAST:
 * a count you can't date is a count you can't trust. shelfTouch reads the
 * row's trigger-bumped updated_at (ONE writer: a sale's guarded deduction,
 * a delivery, a hand move, a correction — every shelf write) and answers
 * days + words + stale in ONE parse.
 * Asserted: the shelf's own word register ('today' | 'Nd ago' — debts
 *   stand "Nd old", shelf events pass "Nd ago"; deliberate, named, never
 *   mixed); the 24h boundary (23h59 today, 24h01 → 1d ago); the max(0,·)
 *   clamp's real promise (a clock-skewed future stamp → today); the floor
 *   of full days (49h → 2d); the stale bucket at SHELF_STALE_DAYS with the
 *   >= boundary exact (6d fresh, 7d stale); ONE-parse agreement (words =
 *   'today' iff days = 0, stale iff days >= threshold); the arithmetic
 *   rides chaseAge's clamp-and-floor (day.ts) while the words differ —
 *   both registers asserted side by side so the deliberate difference can
 *   never silently collapse.
 * Run: bunx vite-node scripts/unit226.mjs
 */
import assert from 'node:assert/strict';

const { shelfTouch, SHELF_STALE_DAYS } = await import('/src/lib/shelf.ts');
const { chaseAge } = await import('/src/lib/day.ts');

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const NOW = Date.parse('2026-10-04T15:00:00Z');

/* 1 — the register: a shelf written this morning reads "today" */
assert.equal(shelfTouch('2026-10-04T09:00:00Z', NOW).words, 'today');
ok('a row written this morning: "moved today" — the shelf\'s calm register');

/* 2 — the floor of full days: 49h is 2d ago */
assert.equal(shelfTouch('2026-10-02T14:00:00Z', NOW).words, '2d ago');
ok('49h floors to "2d ago" — full days only, the chase arithmetic');

/* 3 — the 24h boundary is exact */
assert.equal(shelfTouch('2026-10-03T15:00:00Z', NOW).words, '1d ago');
assert.equal(shelfTouch('2026-10-03T14:59:00Z', NOW).words, '1d ago');
assert.equal(shelfTouch('2026-10-03T15:01:00Z', NOW).words, 'today');
ok('the 24h boundary holds (23h59 today, 24h01 → 1d ago)');

/* 4 — the clamp's real promise: a clock-skewed FUTURE stamp never goes negative */
const skew = shelfTouch('2026-10-04T18:00:00Z', NOW);
assert.equal(skew.days, 0);
assert.equal(skew.words, 'today');
assert.equal(skew.stale, false);
ok('a future stamp (clock skew) clamps to "today", never a negative age');

/* 5 — the stale bucket: >= SHELF_STALE_DAYS, boundary exact */
assert.equal(SHELF_STALE_DAYS, 7);
const six = shelfTouch('2026-09-28T15:00:00Z', NOW); // exactly 6d
const seven = shelfTouch('2026-09-27T15:00:00Z', NOW); // exactly 7d
assert.equal(six.days, 6);
assert.equal(six.stale, false);
assert.equal(seven.days, 7);
assert.equal(seven.stale, true);
ok('stale at the >= boundary: 6d fresh, 7d stale — a week is the trust line');

/* 6 — ONE parse: days, words and stale always agree */
for (const d of [0, 1, 3, 6, 7, 12, 30]) {
  const iso = new Date(NOW - d * 86_400_000).toISOString();
  const t = shelfTouch(iso, NOW);
  assert.equal(t.days, d);
  assert.equal(t.words, d === 0 ? 'today' : `${d}d ago`);
  assert.equal(t.stale, d >= 7);
}
ok('ONE parse: words = "today" iff days = 0, stale iff days >= 7 — all three agree at every age');

/* 7 — the two registers stand side by side, deliberately different words,
 *    identical arithmetic (the difference can never silently collapse) */
const debtIso = '2026-10-02T14:00:00Z'; // 49h before NOW
assert.equal(chaseAge(debtIso, NOW), '2d old');
assert.equal(shelfTouch(debtIso, NOW).words, '2d ago');
ok('debts stand "2d old", shelf events pass "2d ago" — same math, named registers');

/* 8 — the row's aria grammar: "shelf moved " + the words, verbatim */
const row = { name: 'Coffee beans', qty: '1.2 kg', words: shelfTouch('2026-09-20T15:00:00Z', NOW).words };
assert.equal(`${row.name}: ${row.qty}, shelf moved ${row.words}`, 'Coffee beans: 1.2 kg, shelf moved 14d ago');
ok('the row aria speaks the past: "…, shelf moved 14d ago"');

console.log(`\nunit226: ${n} asserts passed`);
