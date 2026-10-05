/**
 * unit298 — v5.259.0 "the drill reads the evening".
 *
 * 5.222 gave the drill's scan trail an honest day count ("3 scans · 2
 * tickets") but the WORK lived behind Bills — the host drilling into a busy
 * table had to leave the floor to meet the tickets the count named. This
 * round:
 *   1. THE RULE, NOT A COPY — lib/turn's ticket predicate leaves
 *      tableTicketDays and becomes its own word (isTableTicket); the count
 *      and the rows ask the SAME closure, so they can never disagree.
 *   2. ROWS === COUNT, EXECUTED — tableTicketsOnDay returns the rows for
 *      one day; executed against a fixture ledger, rows.length equals the
 *      count the trail speaks, newest first, cancelled and noise outside.
 *   3. THE DAY KEY PASSED BY THE CALLER — appDayKey stays the ONE day
 *      grammar; the lib takes the key, the floor derives it from nowTick
 *      (the midnight rollover re-derives within one heartbeat beat).
 *   4. HONEST ABSENCE — nothing tonight, no block; never a zero list.
 *   5. THE SAME LEDGER — the memo reads the orders array the rhythm and the
 *      day counts already read; no second fetch is born.
 *   6. THE LIVE PULSE — the table's current ticket carries the gold dot.
 *   7. THE FAMILY INK — the PAID/DUE pills byte-match the live card's money
 *      box (one voice for one table's money).
 *   8. ZERO LITERALS — the warm grammar's arithmetic lives only in
 *      appday's WARM_WINDOW_MS; no comparison literal survives in components.
 *   9. THE VERSION LAW, the agreement shape (unit274's, live word).
 *
 * Run: bunx vite-node scripts/unit298.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (s) => { n++; console.log(`  ok ${n} — ${s}`); };

const turn = readFileSync('src/lib/turn.ts', 'utf8');
const floor = readFileSync('src/components/floor/FloorScreen.tsx', 'utf8');
const dash = readFileSync('src/components/dashboard/DashboardScreen.tsx', 'utf8');
const appday = readFileSync('src/lib/appday.ts', 'utf8');
const versionTs = readFileSync('src/version.ts', 'utf8');
const swJs = readFileSync('public/sw.js', 'utf8');

// ── 1. the rule, not a copy ───────────────────────────────────────────────
assert.ok(/function isTableTicket\(o: TicketRow, tableId: string\): boolean \{[\s\S]*?o\.table_id !== tableId \|\| o\.status === 'cancelled'[\s\S]*?Number\.isFinite\(new Date\(o\.created_at\)\.getTime\(\)\)/.test(turn),
  'the ONE ticket predicate exists as its own word');
assert.ok(/for \(const o of orders\) \{\s*\n\s*if \(!isTableTicket\(o, tableId\)\) continue;/.test(turn),
  'tableTicketDays asks the predicate (no inlined copy)');
assert.ok(/\.filter\(\(o\) => isTableTicket\(o, tableId\) && appDayKey\(o\.created_at\) === dayKey\)/.test(turn),
  'tableTicketsOnDay asks the SAME predicate');
assert.ok(!/if \(o\.table_id !== tableId \|\| o\.status === 'cancelled'\) continue;/.test(turn.replace(/function isTableTicket[\s\S]*?\n\}/, '')),
  'no second inlined copy of the rule survives in the lib');
ok('the rule, not a copy — one predicate, both readers ask it');

// ── 2. rows === count, executed ───────────────────────────────────────────
const { tableTicketDays, tableTicketsOnDay } = await import('../src/lib/turn.ts');
const DAY_A = '2026-10-05T10:00:00+05:30'; // yesterday
const DAY_B = '2026-10-04T10:00:00+05:30'; // two days back
const ledger = [
  { id: 'a1', table_id: 't1', status: 'served', created_at: '2026-10-06T19:10:00+05:30', total: 240 },
  { id: 'a2', table_id: 't1', status: 'paid', created_at: '2026-10-06T18:02:00+05:30', total: 105 },
  { id: 'a3', table_id: 't1', status: 'cancelled', created_at: '2026-10-06T17:00:00+05:30', total: 60 },
  { id: 'a4', table_id: 't2', status: 'paid', created_at: '2026-10-06T19:30:00+05:30', total: 90 },
  { id: 'a5', table_id: 't1', status: 'new', created_at: DAY_A, total: 10 }, // yesterday — not today's rows
  { id: 'a6', table_id: 't1', status: 'paid', created_at: DAY_B, total: 10 }, // two days back
  { id: 'a7', table_id: 't1', status: 'paid', created_at: 'not-a-date', total: 10 }, // noise
  { id: 'a8', status: 'paid', created_at: '2026-10-06T20:00:00+05:30', total: 10 }, // no table never held one
];
const dayKey = '2026-10-06';
const rows = tableTicketsOnDay(ledger, 't1', dayKey);
const counts = tableTicketDays(ledger, 't1');
assert.equal(rows.length, counts.get(dayKey) ?? -1, 'rows.length === the count the trail speaks');
assert.equal(rows.length, 2, 'the fixture day holds exactly the two real tickets');
assert.deepEqual(rows.map((r) => r.id), ['a1', 'a2'], 'newest first — the evening reads top-down');
assert.ok(!rows.some((r) => r.id === 'a3'), 'a cancelled ticket never happened');
assert.ok(!rows.some((r) => r.id === 'a4'), 'another table\'s work stays on that table');
assert.ok(!rows.some((r) => r.id === 'a5' || r.id === 'a6'), 'another day\'s work stays on that day');
assert.equal(tableTicketsOnDay(ledger, 't1', '2026-10-05').length, counts.get('2026-10-05') ?? -1, 'the other day agrees too');
ok('rows === count, executed — same closure, newest first, cancelled/day/noise outside');

// ── 3. the day key passed by the caller ───────────────────────────────────
const fnBody = turn.slice(turn.indexOf('export function tableTicketsOnDay'));
assert.ok(!fnBody.includes('appDayKey(new Date') && !fnBody.includes('appTimezone() ==='),
  'the lib derives no day of its own — the caller names the day');
assert.ok(floor.includes('tableTicketsOnDay(orders, drillTable.id, appDayKey(new Date(nowTick).toISOString()))'),
  'the floor derives the day key from the heartbeat instant (nowTick)');
ok('the day key passed by the caller — ONE day grammar, appDayKey');

// ── 4. honest absence ─────────────────────────────────────────────────────
assert.ok(/\{tonightTickets\.length > 0 && \(/.test(floor), 'the block renders only when tonight held tickets');
const tonightBlock = floor.slice(floor.indexOf('{tonightTickets.length > 0 && ('));
const blockEnd = tonightBlock.indexOf('{/* guest session trail');
const block = tonightBlock.slice(0, blockEnd);
assert.ok(!/\b0 tickets\b/.test(block), 'no zero-voice — silence, never a zero list');
assert.ok(block.includes("{tonightTickets.length} ticket{tonightTickets.length === 1 ? '' : 's'}"),
  'the census speaks the agreed plural');
ok('honest absence — nothing tonight, no block');

// ── 5. the same ledger ────────────────────────────────────────────────────
assert.ok(floor.includes('[orders, drillTable, nowTick]'),
  'the memo reads the SAME orders ledger and rides the heartbeat');
assert.ok(floor.includes('tonightTickets: Order[];'), 'the prop has its type');
assert.ok(floor.includes('tonightTickets={drillTonightTickets}'), 'the rows ride down as a prop');
assert.ok(floor.includes("tableTicketsOnDay, tableWeekSplit } from '../../lib/turn'"),
  'the lib rule is imported, never copied');
ok('the same ledger — one fetch feeds the rhythm, the counts and the rows');

// ── 6. the live pulse ─────────────────────────────────────────────────────
assert.ok(/const live = order && o\.id === order\.id;/.test(block), 'the current ticket is recognised');
assert.ok(block.includes('h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#D97706]'),
  'the gold pulse marks the living round');
ok('the live pulse — "which one is us?" answered without a word');

// ── 7. the family ink, pinned against the money box ───────────────────────
const moneyBox = floor.slice(floor.indexOf('<p className="mt-3">'), floor.indexOf('{tonightTickets.length > 0 && ('));
assert.ok(moneyBox.includes('bg-[#EAF4EC] px-3 py-1.5 text-[11.5px] font-bold text-[#2E7D32]'),
  'the money box speaks PAID in the green family (anchor)');
assert.ok(moneyBox.includes('bg-[#FDF3E4] px-3 py-1.5 text-[11.5px] font-bold text-[#8A5A16]'),
  'the money box speaks due in the amber family (anchor)');
assert.ok(block.includes("paid ? 'bg-[#EAF4EC] text-[#2E7D32]' : 'bg-[#FDF3E4] text-[#8A5A16]'"),
  'the rows wear the SAME green/amber inks');
assert.ok(block.includes("{paid ? 'PAID' : 'DUE'}"), 'the rows speak the money words');
ok('the family ink — the pills byte-match the money box above');

// ── 8. zero literals — one arithmetic, never two ──────────────────────────
assert.ok(appday.includes('export const WARM_WINDOW_MS = 180_000;'),
  'the constant has its home in appday');
assert.ok(!/<\s*180_000/.test(floor), 'the floor compares against the constant, not the literal');
assert.ok(!/<\s*180_000/.test(dash), 'the dashboard compares against the constant, not the literal');
assert.ok(floor.includes('msLeft < WARM_WINDOW_MS') && floor.includes('youngest < WARM_WINDOW_MS'),
  'both floor warm lines re-anchored');
assert.ok(dash.includes('youngestLiveMs(liveQr, nowMs) < WARM_WINDOW_MS'),
  'the dashboard band re-anchored');
ok('zero literals — the warm grammar speaks ONE arithmetic');

// ── 9. the version law, the agreement shape ───────────────────────────────
const v = versionTs.match(/APP_VERSION = '([^']+)'/)?.[1] ?? '';
assert.ok(v.length > 0, 'APP_VERSION is present');
assert.ok(swJs.includes(`const VERSION = "servepoint-v${v}-r1";`), 'sw.js carries the same word');
ok(`version law — ${v} agreed between version.ts and sw.js`);

console.log(`\nunit298: PASS ${n}/${n}`);
