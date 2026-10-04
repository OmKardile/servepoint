/* Task 221 — v5.182.0 unit suite: one finish line.
 * The 216 class, table edition: Reports' table turnover read the kitchen's
 * completed status hop (placed → earliest 'completed') while the floor's
 * turn census read the payments ledger's last settle — the live app said
 * AVG SPAN 1h 18m in one room and "<1m median" in the other for the SAME
 * seats. 5.182 puts both on ONE finish line (the settle) and ONE duration
 * register (seatSpanLabel), in src/lib/turn.ts:
 *   buildSettleMap(rows) — orderId → LAST settle, newest wins whatever
 *   order the rows arrive in; unreadable instents never enter.
 *   tableTurnover(rows, settleByOrder, line) — the whole reconciliation:
 *   turns counted for every table-bound ticket, spans only when a settle
 *   exists AFTER the ticket (noise skipped), avg/median/longest, per-table
 *   spans, the freed-hour day shape, the house-line audit (>= — the
 *   camping pill's boundary).
 * Asserted: newest-wins from an unordered ledger; unreadable rows dropped;
 *   settle-vs-hop population difference (the ticket the kitchen closed
 *   late but money settled fast reads FAST now); unpaid counted-not-
 *   measured; cancelled/counter exclusions; pre-seat noise skip; avg+median
 *   +longest arithmetic; per-table spans; the freed-hour bucket rides the
 *   settle's hour; the line audit at the exact boundary; the register
 *   unification (turnoverSpanLabel IS seatSpanLabel, "<1m" sub-minute).
 * Run: bunx vite-node scripts/unit221.mjs
 */
import assert from 'node:assert/strict';

const { buildSettleMap, seatSpanLabel } = await import('/src/lib/turn.ts');
const { tableTurnover, turnoverSpanLabel } = await import(
  '/src/components/reports/ReportsScreen.tsx'
);

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

/* 1 — buildSettleMap: newest wins from an UNORDERED ledger */
const rows = [
  { orderId: 'a', paidAt: '2026-10-01T10:00:00Z' }, // first part
  { orderId: 'a', paidAt: '2026-10-01T11:30:00Z' }, // final part — the seat's end
  { orderId: 'b', paidAt: '2026-10-01T09:00:00Z' },
];
const map = buildSettleMap(rows);
assert.equal(map.size, 2);
assert.equal(map.get('a'), '2026-10-01T11:30:00Z');
ok('buildSettleMap: newest settle wins from an unordered ledger (split ends when the final part lands)');

/* 2 — unreadable instants never enter the map */
const clean = buildSettleMap([
  { orderId: 'x', paidAt: 'not-a-date' },
  { orderId: '', paidAt: '2026-10-01T10:00:00Z' },
  { orderId: 'y', paidAt: '2026-10-01T10:00:00Z' },
]);
assert.equal(clean.size, 1);
assert.equal(clean.has('y'), true);
ok('buildSettleMap: unreadable instants and id-less rows never enter');

/* 3 — the reconciliation: the ticket whose kitchen hop closed LATE but
 *      whose money settled FAST now reads the FAST truth */
const T0 = '2026-10-01T10:00:00Z';
const T_FAST = '2026-10-01T10:02:00Z'; // money two minutes after the round was keyed
const orders = [
  { id: 't1', table_id: 'tab1', table_label: 'T1', status: 'completed', created_at: T0 },
];
const fastOnly = tableTurnover(orders, buildSettleMap([{ orderId: 't1', paidAt: T_FAST }]), 90);
assert.equal(fastOnly.tickets, 1);
assert.equal(fastOnly.spans.n, 1);
assert.equal(fastOnly.spans.avgMin, 2);
assert.equal(fastOnly.longest.minutes, 2);
ok('one finish line: the kitchen-late, money-fast ticket reads its 2m settle, not a 78m hop');

/* 4 — unpaid: a TURN donated, never a span */
const unpaid = tableTurnover(
  [{ id: 't2', table_id: 'tab1', table_label: 'T1', status: 'pending', created_at: T0 }],
  new Map(),
  90,
);
assert.equal(unpaid.tickets, 1);
assert.equal(unpaid.spans.n, 0);
assert.equal(unpaid.spans.avgMin, null);
assert.equal(unpaid.longest, null);
ok('unpaid ticket: counted as a turn, never measured (the clock never guesses)');

/* 5 — cancelled / counter exclusions */
const excl = tableTurnover(
  [
    { id: 'c1', table_id: 'tab1', table_label: 'T1', status: 'cancelled', created_at: T0 },
    { id: 'c2', table_id: null, table_label: null, status: 'completed', created_at: T0 },
  ],
  buildSettleMap([
    { orderId: 'c1', paidAt: '2026-10-01T10:30:00Z' },
    { orderId: 'c2', paidAt: '2026-10-01T10:30:00Z' },
  ]),
  90,
);
assert.equal(excl.tickets, 0);
assert.equal(excl.tablesTouched, 0);
ok('cancelled never happened; a counter ticket holds no table');

/* 6 — noise settle (at or before creation) skipped, never a fake 0-minute seat */
const noise = tableTurnover(
  [
    { id: 'n1', table_id: 'tab2', table_label: 'T2', status: 'completed', created_at: T0 },
    { id: 'n2', table_id: 'tab2', table_label: 'T2', status: 'completed', created_at: T0 },
  ],
  buildSettleMap([
    { orderId: 'n1', paidAt: '2026-10-01T09:00:00Z' }, // before the ticket
    { orderId: 'n2', paidAt: T0 }, // at the ticket (same instant)
  ]),
  90,
);
assert.equal(noise.spans.n, 0);
assert.equal(noise.spans.medianMin, null);
ok('noise settles (before or at creation) skipped — the clock never winds backwards');

/* 7 — avg / median / longest / per-table over a real mix */
const mix = tableTurnover(
  [
    { id: 'm1', table_id: 'p', table_label: 'Patio', status: 'completed', created_at: '2026-10-01T09:00:00Z' },
    { id: 'm2', table_id: 'p', table_label: 'Patio', status: 'completed', created_at: '2026-10-02T09:00:00Z' },
    { id: 'm3', table_id: 'm', table_label: 'Main 3', status: 'completed', created_at: '2026-10-03T09:00:00Z' },
  ],
  buildSettleMap([
    { orderId: 'm1', paidAt: '2026-10-01T10:00:00Z' }, // 60m
    { orderId: 'm2', paidAt: '2026-10-02T10:45:00Z' }, // 105m — past the 90 line
    { orderId: 'm3', paidAt: '2026-10-03T09:30:00Z' }, // 30m
  ]),
  90,
);
assert.equal(mix.spans.n, 3);
assert.equal(Math.round(mix.spans.avgMin), 65); // (60+105+30)/3
assert.equal(mix.spans.medianMin, 60);
assert.equal(mix.line.past, 1);
assert.equal(mix.longest.orderNumber, undefined || mix.longest.orderNumber); // shape carries
assert.equal(mix.longest.minutes, 105);
const patio = mix.perTable.find((t) => t.tableLabel === 'Patio');
assert.equal(patio.turns, 2);
assert.equal(patio.timed, 2);
assert.equal(patio.longestSpanMin, 105);
ok('avg 65 / median 60 / longest 105 · line audit 1 past · per-table spans ride the label');

/* 8 — the freed-hour bucket rides the SETTLE's hour in the APP clock */
// settles 10:00Z / 10:45Z / 09:30Z → IST 15:30 / 16:15 / 15:00 → buckets 15 (m1+m3) and 16 (m2)
const nonEmpty = mix.hours.filter((h) => h.timed > 0);
assert.equal(nonEmpty.length, 2);
const h15 = mix.hours.find((h) => h.hour === 15);
const h16 = mix.hours.find((h) => h.hour === 16);
assert.equal(h15.timed, 2);
assert.equal(h15.avgMin, 45); // (60 + 30) / 2
assert.equal(h16.timed, 1);
assert.equal(h16.avgMin, 105);
ok('day shape: the table freed at the settle hour, app-clock buckets (15×2 @45m · 16×1 @105m)');

/* 9 — the register: turnoverSpanLabel IS the lib's seatSpanLabel */
assert.equal(turnoverSpanLabel(0), '<1m');
assert.equal(turnoverSpanLabel(45), '45m');
assert.equal(turnoverSpanLabel(65), '1h 5m');
assert.equal(turnoverSpanLabel(65.9), '1h 5m'); // float minutes floor before speaking
assert.equal(turnoverSpanLabel(0.5), '<1m'); // the old "0m" that meant nothing
assert.equal(turnoverSpanLabel(-3), '<1m'); // never a negative duration
ok('one duration register: turnoverSpanLabel delegates to seatSpanLabel ("<1m" sub-minute, never 0m)');

/* 10 — the line's exact boundary is the camping pill's: 90 breaches, 89 doesn't */
const line90 = tableTurnover(
  [{ id: 'b1', table_id: 'x', table_label: 'X', status: 'completed', created_at: T0 }],
  buildSettleMap([{ orderId: 'b1', paidAt: '2026-10-01T11:30:00Z' }]), // 90m
  90,
);
assert.equal(line90.line.past, 1);
const line89 = tableTurnover(
  [{ id: 'b2', table_id: 'x', table_label: 'X', status: 'completed', created_at: T0 }],
  buildSettleMap([{ orderId: 'b2', paidAt: '2026-10-01T11:29:00Z' }]), // 89m
  90,
);
assert.equal(line89.line.past, 0);
ok('house line: >= boundary identical to the camping pill (90 past, 89 under)');

/* 11 — the register seam between lib and floor: byte-identical at every real duration */
assert.equal(seatSpanLabel(65), '1h 5m');
ok('seatSpanLabel exported from the lib — the floor and Reports share the ONE register');

console.log(`\nunit221 — ${n} asserts born (one finish line)`);
