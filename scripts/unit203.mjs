/* Task 203 — v5.164.0 unit suite: the house line, audited (turn line vs spans).
 * Covers the line audit in ReportsScreen's tableTurnover:
 *   line — { turnAfterMin, past, share }: how many finished seats ran PAST
 *   the turn line, at the SAME >= boundary the floor's camping pill uses.
 * The line arrives through the prefs layer's own validator (clampTurnAfterMin)
 * — garbage falls to the doctrine default 90, extremes clamp to 30–240.
 * v5.182.0 migration: the finish line is the payments ledger's LAST settle
 * (buildSettleMap) — the 216-class reconciliation — fixtures ride settle
 * maps now; every boundary semantic (>=, live-seat silence, validator
 * guards) carries over intact.
 * Run: bunx vite-node scripts/unit203.mjs
 */
import assert from 'node:assert/strict';

const { tableTurnover } = await import('/src/components/reports/ReportsScreen.tsx');
const { buildSettleMap } = await import('/src/lib/turn.ts');

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const T0 = '2026-10-04T09:00:00+05:30'; // IST 09:00
const mins = (m) => new Date(new Date(T0).getTime() + m * 60000).toISOString();

const ord = (id, num, tableId, tableLabel, createdAt, status = 'completed') =>
  ({
    id,
    tenant_id: 't',
    order_number: num,
    order_type: 'dine_in',
    status,
    table_id: tableId,
    table_label: tableLabel,
    total: 100,
    subtotal: 100,
    tax_amount: 0,
    created_at: createdAt,
    items: [],
  });

const settles = (pairs) => buildSettleMap(pairs.map(([id, at]) => ({ orderId: id, paidAt: at })));

/* ── 1 · the doctrine default line ──────────────────────────────────── */

// no third arg → the 90-minute house default; a 89m span is inside it
const a = ord('a', 301, 'tbA', 'TA', T0);
const agg1 = tableTurnover([a], settles([['a', mins(89)]]));
assert.equal(agg1.line.turnAfterMin, 90);
assert.equal(agg1.line.past, 0);
assert.equal(agg1.line.share, 0);
ok('default line is the doctrine 90; an 89-minute seat is inside it');

// exactly AT the line is already past — the camping pill's own boundary (>=)
const b = ord('b', 302, 'tbB', 'TB', T0);
const agg2 = tableTurnover([b], settles([['b', mins(90)]]));
assert.equal(agg2.line.past, 1);
assert.equal(agg2.line.share, 1);
ok('a seat AT the line is past it (>= — the camping pill boundary, one house one line)');

/* ── 2 · the house's own line ───────────────────────────────────────── */

// Settings says 60 → the same 70m seat is now past
const c = ord('c', 303, 'tbC', 'TC', T0);
const agg3 = tableTurnover([c], settles([['c', mins(70)]]), 60);
assert.equal(agg3.line.turnAfterMin, 60);
assert.equal(agg3.line.past, 1);
assert.equal(agg3.line.share, 1);
ok('the house line obeys the Settings number (60m line, 70m seat → past)');

/* ── 3 · the validator guards the number ────────────────────────────── */

const d = ord('d', 304, 'tbD', 'TD', T0);
const agg4 = tableTurnover([d], settles([['d', mins(120)]]), NaN);
assert.equal(agg4.line.turnAfterMin, 90);
assert.equal(agg4.line.past, 1);
ok('an unreadable line falls to the doctrine default 90 (silence, never nonsense)');

const e = ord('e', 305, 'tbE', 'TE', T0);
const agg5 = tableTurnover([e], settles([['e', mins(250)]]), 5000);
assert.equal(agg5.line.turnAfterMin, 240);
assert.equal(agg5.line.past, 1);
ok('an extreme line clamps to the validator ceiling 240');

/* ── 4 · live seats and empty rooms never breach ────────────────────── */

// a seat with no finish line donates a turn, never a breach
const f = ord('f', 306, 'tbF', 'TF', T0);
const agg6 = tableTurnover([f], null);
assert.equal(agg6.tickets, 1);
assert.equal(agg6.line.past, 0);
assert.equal(agg6.line.share, null);
ok('a live seat donates a turn and never a breach — only finished seats are audited');

const agg7 = tableTurnover([], null);
assert.equal(agg7.line.turnAfterMin, 90);
assert.equal(agg7.line.past, 0);
assert.equal(agg7.line.share, null);
ok('an empty room: the line stands, nothing ran past it, no share invented');

/* ── 5 · a mixed range reads an honest share ────────────────────────── */

// spans of 45m, 90m, 120m against a 90m line → 2 of 3 past
const g1 = ord('g1', 307, 'tbG', 'TG', T0);
const g2 = ord('g2', 308, 'tbH', 'TH', T0);
const g3 = ord('g3', 309, 'tbI', 'TI', T0);
const agg8 = tableTurnover(
  [g1, g2, g3],
  settles([['g1', mins(45)], ['g2', mins(90)], ['g3', mins(120)]]),
);
assert.equal(agg8.line.past, 2);
assert.ok(Math.abs(agg8.line.share - 2 / 3) < 1e-9);
assert.equal(agg8.spans.n, 3);
ok('a mixed range: 2 of 3 timed seats past the 90m line, share 2/3');

/* ── 6 · the audit rides the same walk ──────────────────────────────── */

// the line audit must not disturb the day shape or the span stats
const h1 = ord('h1', 310, 'tbJ', 'TJ', T0);
const agg9 = tableTurnover([h1], settles([['h1', mins(570)]]), 90);
assert.equal(agg9.hours[18].timed, 1);
assert.equal(agg9.peakHour, 18);
assert.equal(agg9.spans.medianMin, 570);
assert.equal(agg9.line.past, 1);
ok('the audit coexists with the day shape and span stats (same walk, one truth)');

console.log(`\n${n} asserts PASS`);
