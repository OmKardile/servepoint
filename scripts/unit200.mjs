/* Task 200 — v5.161.0 unit suite: the room's breathing (table turnover).
 * Covers the two new pure voices in ReportsScreen:
 *   1. turnoverSpanLabel — the floor's TimeAgo register for seated spans
 *   2. tableTurnover — turns per table + placed→paid spans off the hop ledger
 * Run: bunx vite-node scripts/unit200.mjs
 */
import assert from 'node:assert/strict';

const { tableTurnover, turnoverSpanLabel } = await import(
  '/src/components/reports/ReportsScreen.tsx'
);

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

/* ── 1 · turnoverSpanLabel — the floor's clock register ─────────────── */

assert.equal(turnoverSpanLabel(0), '0m');
ok('a zero-minute span still reads 0m, never "just sat"');

assert.equal(turnoverSpanLabel(45), '45m');
assert.equal(turnoverSpanLabel(65), '1h 5m');
assert.equal(turnoverSpanLabel(130), '2h 10m');
ok('register matches the camping pill family (45m / 1h 5m / 2h 10m, no zero-pad)');

assert.equal(turnoverSpanLabel(-5), '0m');
assert.equal(turnoverSpanLabel(59.9), '59m');
ok('negatives clamp to 0m; fractional minutes floor');

/* ── 2 · tableTurnover — the honest ledger read ─────────────────────── */

const T0 = '2026-10-04T09:00:00+05:30';
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

const hop = (orderId, toStatus, atIso) => ({
  orderId,
  fromStatus: 'x',
  toStatus,
  atIso,
});

const o1 = ord('o1', 91, 'tbl-1', 'T1', T0); // completed 60m later
const o2 = ord('o2', 92, 'tbl-1', 'T1', mins(120)); // still seated — turn only
const o3 = ord('o3', 93, 'tbl-2', 'T2', T0); // completed 30m later
const o4 = ord('o4', 94, null, null, T0); // takeaway — never a table turn
const o5 = ord('o5', 95, 'tbl-3', 'T3', T0, 'cancelled'); // cancelled — never entered
const o6 = ord('o6', 96, 'tbl-4', 'T4', mins(300)); // completed hop BEFORE placed (skew)

const hops = [
  hop('o1', 'preparing', mins(5)),
  hop('o1', 'completed', mins(60)),
  hop('o1', 'completed', mins(90)), // retry hop — earliest wins
  hop('o3', 'completed', mins(30)),
  hop('o4', 'completed', mins(10)), // takeaway: ignored
  hop('o5', 'completed', mins(10)), // cancelled: ignored
  hop('o6', 'completed', mins(200)), // before placed (T0+300): skipped
];

const agg = tableTurnover([o1, o2, o3, o4, o5, o6], hops);

assert.equal(agg.tickets, 4);
ok('4 dine-in tickets counted (takeaway and cancelled never entered)');

assert.equal(agg.tablesTouched, 3);
ok('three tables touched (the T4 skew hop still donates a turn)');

assert.equal(agg.spans.n, 2);
assert.equal(Math.round(agg.spans.avgMin), 45);
assert.equal(agg.spans.medianMin, 30);
ok('two provable spans: avg 45m, median 30m');

assert.ok(agg.longest);
assert.equal(agg.longest.orderNumber, 91);
assert.equal(Math.round(agg.longest.minutes), 60);
assert.equal(agg.longest.tableLabel, 'T1');
ok('longest span is #91 at T1 (earliest completed hop wins, retries never inflate)');

assert.equal(agg.perTable[0].tableLabel, 'T1');
assert.equal(agg.perTable[0].turns, 2);
assert.equal(agg.perTable[0].timed, 1);
assert.equal(Math.round(agg.perTable[0].avgSpanMin), 60);
assert.equal(Math.round(agg.perTable[0].longestSpanMin), 60);
ok('T1 leads with 2 turns, 1 timed span (avg 60m)');

assert.equal(agg.perTable[1].tableLabel, 'T2');
assert.equal(agg.perTable[1].turns, 1);
assert.equal(Math.round(agg.perTable[1].avgSpanMin), 30);
ok('T2 next: 1 turn, 30m span');

const t4 = agg.perTable.find((t) => t.tableLabel === 'T4');
assert.ok(t4);
assert.equal(t4.turns, 1);
assert.equal(t4.timed, 0);
assert.equal(t4.avgSpanMin, null);
assert.equal(t4.longestSpanMin, null);
ok('the skew table donates a turn but never a span (clock never winds backwards)');

const o2b = ord('o2', 92, 'tbl-1', 'T1', mins(120));
const liveOnly = tableTurnover([o2b], []);
assert.equal(liveOnly.tickets, 1);
assert.equal(liveOnly.spans.n, 0);
assert.equal(liveOnly.spans.avgMin, null);
assert.equal(liveOnly.longest, null);
assert.equal(liveOnly.perTable[0].avgSpanMin, null);
ok('a live seat with no ledger donates a turn only — no invented span');

const empty = tableTurnover([], []);
assert.deepEqual(empty, {
  tickets: 0,
  tablesTouched: 0,
  perTable: [],
  spans: { n: 0, avgMin: null, medianMin: null },
  longest: null,
  hours: Array.from({ length: 24 }, (_, hour) => ({ hour, timed: 0, avgMin: null })),
  peakHour: null,
});
ok('empty range: a silent room, honestly shaped (incl. the 5.163.0 day shape)');

console.log(`\n${n} asserts PASS`);
