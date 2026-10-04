/* Task 240 — v5.201.0 unit suite: the row speaks the drill's registers.
 * The drill (5.199) named every figure — Paid visits, Paid total, All
 * tickets, Recent tickets — while the LIST row beside it said bare
 * "Visits / Spent / Last visit" and the tile said "2+ visits": two of
 * the row's numbers are PAID (the view filters payment_status =
 * 'completed') and one is BILLED (last_visit_at = MAX(created_at) over
 * NON-CANCELLED tickets, unpaid included) — the same word "visit"
 * owning two truths one cell apart, and none of them wearing its name.
 * The fix borrows the ledger's own words: the paid cells say what the
 * drill says, the billed stamp says what the drill calls that
 * population (Last ticket — the last row of All tickets), the tile
 * joins the ladder's grammar ("two paid visits make a Regular"), and
 * the CSV column follows. NO data changed — the register was always
 * this; the words caught up (5.198: name the truth, don't re-populate).
 * Asserted: the three row labels wired to their own sources; the tile
 * label + the narrow-whisper split intact; the CSV header family;
 * old bare words extinct from COMMENT-STRIPPED live copy (233's
 * lesson — docstrings quote the words); the drill's words unchanged
 * (the row now shares them — occurrence counts); and the register
 * proof — the view's last_visit_at is STILL the billed MAX, so the
 * rename named it without re-populating it.
 * Run: bunx vite-node scripts/unit240.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

/* comment-blind live copy (233: docstrings quote words, sweep the code). */
const live = readFileSync(
  new URL('../src/components/customers/CustomersScreen.tsx', import.meta.url),
  'utf8',
);
const code = live
  .split('\n')
  .filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l))
  .join('\n');

/* 1 — the row cells speak the drill's words, wired to their own sources. */
assert.ok(
  code.includes('>Paid visits</p>') &&
    code.includes("'text-[#1A1A1A]' : 'text-[#C9CFC9]'}`}>{visits}</p>"),
  'the PAID-visits cell renders the paid visit count',
);
assert.ok(
  code.includes('>Paid total</p>') && code.includes('{formatMoney(spent)}'),
  'the PAID-total cell renders the paid rupees',
);
ok('row cells: Paid visits → {visits}, Paid total → {formatMoney(spent)}');

/* 2 — the billed stamp wears the ledger's word for its population. */
assert.ok(
  code.includes('>Last ticket</p>') &&
    code.includes('{fmtWhen(s?.last_visit_at ?? null)}'),
  'Last ticket still renders last_visit_at — named, not re-populated',
);
ok('billed stamp renamed Last ticket, source unchanged');

/* 3 — the old bare words are extinct from live copy. */
assert.ok(!code.includes('>Visits<'), 'bare "Visits" cell is gone');
assert.ok(!code.includes('>Spent<'), 'bare "Spent" cell is gone');
assert.ok(!code.includes('>Last visit<'), 'bare "Last visit" cell is gone');
assert.ok(!code.includes("'Regulars · 2+ visits'"), 'the un-named tile label is gone');
assert.ok(!code.includes("'Last visit'"), "the CSV's bare Last visit is gone");
ok('old register-blind words extinct (comment-blind sweep)');

/* 4 — the tile names its register; the narrow-whisper still says just "regulars". */
assert.ok(code.includes("'Regulars · 2+ paid visits'"), 'tile label names paid visits');
const tileLabel = 'Regulars · 2+ paid visits';
assert.equal(tileLabel.split(' ·')[0], 'Regulars');
assert.ok(code.includes("t.label.split(' ·')[0]"), 'the whisper split rides the label');
ok('tile: "Regulars · 2+ paid visits", whisper split intact');

/* 5 — the row now SHARES the drill's words: occurrence counts. */
const count = (needle) => code.split(needle).length - 1;
assert.equal(count('>Paid visits</p>'), 2, 'row cell + drill stat share the word');
assert.equal(count('>Paid total</p>'), 2, 'row cell + drill stat share the word');
assert.equal(count('>All tickets</p>'), 1, 'the drill keeps All tickets alone');
ok('one word one owner: the row borrows the drill’s exact labels');

/* 6 — the CSV header family travels together. */
const headerBlock = code.slice(code.indexOf('const header = ['), code.indexOf('];', code.indexOf('const header = [')));
assert.ok(headerBlock.includes("'Paid visits'"), "CSV keeps Paid visits");
assert.ok(headerBlock.includes("'Paid total (INR)'"), "CSV keeps Paid total (INR)");
assert.ok(headerBlock.includes("'Last ticket'"), "CSV column joins the renamed register");
ok('CSV header: Paid visits · Paid total (INR) · Last ticket');

/* 7 — THE REGISTER PROOF: the view still computes last_visit_at as the
 * billed MAX (any non-cancelled ticket). The rename named the truth
 * without re-populating it — the words changed, the ledger did not. */
const view = readFileSync(
  new URL('../supabase/migrations/016_customers_offers.sql', import.meta.url),
  'utf8',
);
assert.ok(
  /MAX\(o\.created_at\) FILTER \(WHERE o\.status <> 'cancelled'\)\s+AS last_visit_at/.test(view),
  'last_visit_at remains the billed register in the view',
);
assert.ok(
  /COUNT\(\*\) FILTER \(WHERE o\.status <> 'cancelled'\n\s+AND o\.payment_status = 'completed'\)\s+AS visits/.test(
    view,
  ),
  'visits remains the paid register in the view',
);
ok('view untouched: visits=PAID, last_visit_at=BILLED — the names were the only debt');

console.log(`\nunit240 — ${n} asserts ALL GREEN`);
