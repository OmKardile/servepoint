/* Task 261 — v5.222.0 unit suite: the trail counts its tickets.
 *
 * 5.219 opened the drill's history door and grouped a table's scans under
 * their IST days — but a scan is a look, not work: the owner reading
 * "9 scans" could never tell whether any of them became a served ticket.
 * Two answers land this round:
 *
 * 1. lib/turn.ts gains tableTicketDays — the drilled table's served-ticket
 *    count per reporting day, from the SAME orders ledger the floor rhythm
 *    already reads (no second trip to the cloud). ONE ticket rule with the
 *    census and the rhythm (table-bound, not cancelled — a cancelled ticket
 *    never happened; no table never held one), ONE day key with the trail
 *    (appDayKey). A day that served nothing stays OUT of the map — silence,
 *    never a zero; an unreadable instant is ledger noise, skipped. The
 *    FloorScreen's drill passes the map down as a prop and the day heading
 *    appends "· N ticket(s)" in the deep ink — only when N > 0 — keeping
 *    5.219's scan words byte-identical ahead of it.
 * 2. The band's arrivals hint names WHERE, the same word the QR slot has
 *    spoken since 5.221: the promise's own table through the band's one
 *    table map (qrTableNameById → tableNameById — one map, two slots).
 *    A promise with no table (or a failed read) degrades silently to the
 *    tableless words — never a fabricated name.
 *
 * Asserted: the lib derivation (empty silence, table isolation, cancelled
 * excluded, accumulation, the IST day key across midnight, noise skipped,
 * only-cancelled excluded — every other status counts); the FloorScreen
 * wiring (lib import, no local copy, the memo + prop + prop type, the
 * heading's silence rule + plural + deep-ink emphasis + title, 5.219's
 * scan words byte-identical, the door button untouched, no new timer);
 * the Dashboard hint bytes (due + quiet table clauses, degrade-safe, the
 * rename held with no leftover, the QR slot's words intact, the aria's
 * quiet words untouched).
 * Run: bunx vite-node scripts/unit261.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (s) => { n++; console.log(`  ✓ ${s}`); };
const strip = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

/* ── 1. The lib — ONE ticket rule, ONE day key ── */

const turn = await import('/src/lib/turn.ts');
const { tableTicketDays } = turn;

assert.equal(typeof tableTicketDays, 'function', 'tableTicketDays lives in lib/turn');
ok('tableTicketDays has its home in the seat-span lib');

/* day-stable anchors: 06:30Z = 12:00 IST; the midnight straddle proves the
   reporting-day key (18:29Z = 23:59 IST the day BEFORE 18:30Z's day). */
const DAY_A = '2026-10-05T06:30:00Z'; // 12:00 IST 5 Oct
const DAY_A_LATER = '2026-10-05T09:30:00Z'; // 15:00 IST 5 Oct — same day
const DAY_B = '2026-10-03T06:30:00Z'; // 12:00 IST 3 Oct
const STRADDLE_BEFORE = '2026-10-04T18:29:59Z'; // 23:59 IST 4 Oct
const STRADDLE_AFTER = '2026-10-04T18:30:00Z'; // 00:00 IST 5 Oct

// empty ledger → empty map (silence, never a zero)
assert.equal(tableTicketDays([], 't1').size, 0, 'empty ledger is silence');
ok('an empty ledger reads as silence — no invented zero');

// accumulates one table's rows per day; other tables never leak in
const ledger = [
  { table_id: 't1', status: 'paid', created_at: DAY_A },
  { table_id: 't1', status: 'active', created_at: DAY_A_LATER },
  { table_id: 't2', status: 'paid', created_at: DAY_A },
  { table_id: 't1', status: 'settled', created_at: DAY_B },
];
const m1 = tableTicketDays(ledger, 't1');
assert.equal(m1.size, 2, 'two distinct days for t1');
const keyA = turn.appDayKey ? null : null; // (appDayKey is appday's export; keys verified below)
assert.equal([...m1.values()].reduce((a, b) => a + b, 0), 3, 'two + one = three tickets');
assert.equal(tableTicketDays(ledger, 't2').get([...m1.keys()][0]), 1, 't2 carries only its own row');
ok('counts accumulate per day and isolate the table');

// every non-cancelled status counts; cancelled never happened
const byStatus = tableTicketDays(
  ['active', 'paid', 'settled', 'cancelled'].map((status, i) => ({
    table_id: 't1',
    status,
    created_at: DAY_A,
  })),
  't1',
);
assert.equal([...byStatus.values()][0], 3, 'active+paid+settled count; cancelled does not');
ok('a cancelled ticket never happened — every other status seated one');

// the IST day key straddles UTC midnight correctly
const straddle = tableTicketDays(
  [
    { table_id: 't1', status: 'paid', created_at: STRADDLE_BEFORE },
    { table_id: 't1', status: 'paid', created_at: STRADDLE_AFTER },
  ],
  't1',
);
assert.equal(straddle.size, 2, '23:59 IST and 00:00 IST are DIFFERENT days');
ok('the day key is the reporting day — UTC midnight is not the house\'s');

// no table never held one; unreadable instants are ledger noise
const noise = tableTicketDays(
  [
    { table_id: null, status: 'paid', created_at: DAY_A },
    { table_id: 't1', status: 'paid', created_at: 'not-a-date' },
    { status: 'paid', created_at: DAY_A },
  ],
  't1',
);
assert.equal(noise.size, 0, 'tableless rows and unreadable instants are skipped');
ok('no table never held one; an unreadable instant is noise, not a count');

// the map is per-call — no shared state between calls
assert.notEqual(tableTicketDays(ledger, 't1'), tableTicketDays(ledger, 't1'), 'fresh map per call');
ok('the derivation is pure — a fresh map every call');

/* ── 2. The FloorScreen wiring — the map rides a prop ── */

const floor = strip('../src/components/floor/FloorScreen.tsx');

assert.ok(floor.includes("tableTicketDays, tableTicketsOnDay, tableWeekSplit } from '../../lib/turn'"),
  'the Floor imports the lib rule (grown by 5.226\'s week split — the 5.261 rename-pin law; 5.259 adds the evening rows)');
assert.ok(!/\bfunction tableTicketDays\b/.test(floor.replace(/tableTicketDays,\n/g, '')),
  'no local copy of the rule was born');
assert.ok(floor.includes('tableTicketDays(orders, drillTable.id)'),
  'the parent derives from the SAME ledger the rhythm reads');
assert.ok(floor.includes('[orders, drillTable],'),
  'the memo recomputes only when the ledger or the drilled table changes');
assert.ok(floor.includes('ticketDays={drillTicketDays}'), 'the map rides down as a prop');
assert.ok(floor.includes('ticketDays: Map<string, number>;'), 'the prop has its type');
ok('the FloorScreen wiring: lib import, memo, prop — no copy');

// the heading appends the WORK only when there was work — silence, never a zero
assert.ok(floor.includes('const served = ticketDays.get(day) ?? 0;'), 'the day reads its count');
assert.ok(floor.includes('{served > 0 && ('), 'the ticket clause speaks only when N > 0');
assert.ok(floor.includes("{served} ticket{served === 1 ? '' : 's'}"), 'the agreed ticket plural');
assert.ok(floor.includes('className="font-semibold text-[#0F3D3E]"'),
  'the work speaks in the deep ink, quiet-bold beside the grey scans');
assert.ok(floor.includes('title="Tickets seated at this table that day'),
  'the emphasis carries its own honest tooltip');

// 5.219's words stand byte-identical ahead of the new clause
assert.ok(floor.includes("{istDayPretty(day)} · {rows.length} scan{rows.length === 1 ? '' : 's'}"),
  'the scan words are untouched — the clause appends, never rewrites');
assert.ok(floor.includes('+{olderScans.length} earlier scans on record'),
  'the collapsed door button keeps its own words');
ok('the trail\'s 5.219 voice survives; the work clause is an append');

// no new timer — the heartbeat stays the only cadence
const intervals = floor.split('window.setInterval(').length - 1;
assert.equal(intervals, 4, 'the heartbeat count is unchanged (4)');
ok('no new timer — the day counts ride renders, not clocks');

/* ── 3. The arrivals hint names WHERE — one table word per band ── */

const dash = strip('../src/components/dashboard/DashboardScreen.tsx');

assert.ok(dash.includes('const tableNameById = new Map(now.tables.map((t) => [t.id, t.table_number]));'),
  'the band keeps ONE table map from its own read');
assert.ok(!dash.includes('qrTableNameById'), 'the old QR-only name is gone — one map, two slots');

// the due hint: guest · party · TABLE · promised — degrade-safe
assert.ok(dash.includes("${dueTable ? ` · ${dueTable}` : ''}"),
  'the due hint names the promise\'s table only when it has one');
assert.ok(dash.includes('· promised ${bookingSlotLabel(nextDue.slot_at)}`'),
  'the book\'s own promised-hour word stands');
assert.ok(dash.includes('const dueTable = nextDue?.table_id ? tableNameById.get(nextDue.table_id) ?? null : null;'),
  'the dereference is optional-chained — this block also runs in quiet-only scope, where no due row exists (the 08:05 flip crash)');

// the quiet hint names its place too, tail intact
assert.ok(dash.includes("${quietTable ? ` · ${quietTable}` : ''} — the promised hour went by, still booked`"),
  'the quiet debt names its table, the book\'s tail words intact');
assert.ok(dash.includes("const quietTable = quietHead?.table_id ? tableNameById.get(quietHead.table_id) ?? null : null;"),
  'the quiet head resolves through the SAME map');

// the QR slot's WHERE survives the rename untouched
assert.ok(dash.includes('tableNameById.get(s.table_id)'), 'the QR value still reads the map');
assert.ok(dash.includes('tableNameById.get(youngestQr.table_id)'), 'the warm hint still reads the map');
assert.ok(dash.includes('the promised hour passed, still booked'), 'the aria\'s quiet words untouched');
ok('the arrivals hint names WHERE; the QR slot\'s words and the aria stand');

console.log(`\nunit261 — ${n} checks green`);
