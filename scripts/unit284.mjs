/**
 * unit284 — v5.245.0 "the board reads the whole day".
 *
 * The round's laws, pinned:
 *   1. THE DAY READ — api.ts's fetchTodayOrders(tenantId, nowMs?) draws
 *      the bounds the working surfaces speak: the app-today containing
 *      the clock given (offTodayBoundsIso's [start, end)), the same
 *      select embed as fetchOrders ('*, dining_tables(table_number)'),
 *      NO limit / range call (a day is finite — business-bounded),
 *      THROWS on error, the attachItems bridge byte-equal to
 *      fetchOrders' (complete Orders out, unchanged downstream).
 *   2. THE BOUNDARY LAW (behavior) — the read's [start, end) is
 *      byte-equal to isSameAppDayAs by construction (the 5.243 law,
 *      now the POSITIVE conjunction): over the five-instant matrix —
 *      start−1ms out, start in, end−1ms in, end out, the future-dated
 *      corrupt row out of BOTH mouths — server verdict ≡ client
 *      verdict at every instant (228's doctrine: the suite owns now).
 *   3. THE BOARD'S WIRING — KitchenScreen's refetch calls
 *      fetchTodayOrders(tenantId); the all-time newest-100 call form
 *      (fetchOrders( ) is extinct from the file's code (the doc may
 *      tell its lineage); the overlay-ticks loop and setOrders flow
 *      are byte-true; the board's own isSameAppDay verdicts stay
 *      (they now VERIFY instead of rescue).
 *   4. THE COUNTER'S WIRING — the inbox's list leg calls
 *      fetchTodayOrders(tenantId) inside the same Promise.all; the
 *      census legs ride unchanged (fetchOffTodayCount ['new'],
 *      individually fail-soft); the list's own filter byte-true
 *      (status 'new' ∧ isSameAppDay, oldest-first).
 *   5. ONE CHIP LANGUAGE, TWO ROOMS — both headers wear the
 *      day-scope chip: the common class core byte-equal, the house
 *      formatter's dayLabel voice in both, CalendarDays in both, the
 *      'Today · ' word in both, and each title names the whole-day
 *      read in its own grammar (the board's tickets, the inbox's
 *      news tickets).
 *   6. THE DOWNSTREAM HELD — the board's completed 12-card cap +
 *      tally law bytes unchanged (completedToday before the slice,
 *      overflow the 5.262 law); the counter's stragglerN word
 *      unchanged (unit280/282's pins stand).
 *   7. NO OTHER ROOM MOVED — fetchOrders' own bytes keep the
 *      browsing window (default limit 100, .limit(limit)); the day
 *      read is an addition, the browsing rooms keep their read.
 *   8. THE VERSION LAW in the agreement shape.
 *
 * Run: bunx vite-node scripts/unit284.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);
const strip = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

/* ── the live word — behavior, not bytes ── */
const { isSameAppDayAs, offTodayBoundsIso } = await import('/src/lib/appday.ts');

const api = strip('../src/lib/api.ts');
const kitchen = strip('../src/components/kitchen/KitchenScreen.tsx');
const inbox = strip('../src/components/food/CounterInbox.tsx');
const versionTs = strip('../src/version.ts');
const swJs = strip('../public/sw.js');

/* 1 — the day read: the bounds the surfaces speak, the bridge, no cap. */
{
  const fn = api.slice(
    api.indexOf('export async function fetchTodayOrders'),
    api.indexOf('export async function fetchOffTodayCount'),
  );
  assert.ok(fn.includes('requireCloud()'), 'the read gates on cloud');
  const { offTodayBoundsIso: _probe } = await import('/src/lib/appday.ts');
  assert.ok(fn.includes('offTodayBoundsIso(nowMs)'), 'the bounds come from the ONE home');
  assert.match(fn, /const \{ startIso, endIso \} = offTodayBoundsIso\(nowMs\);/, 'the pair destructure');
  assert.match(fn, /\.select\('\*, dining_tables\(table_number\)'\)/, 'the same table embed as fetchOrders — derived, never stored');
  assert.match(fn, /\.gte\('created_at', startIso\)/, 'the day starts included');
  assert.match(fn, /\.lt\('created_at', endIso\)/, 'the day ends excluded — [start, end), the isSameAppDay shape');
  assert.ok(!/\.limit\(|\.range\(/.test(fn), 'no cap — a day is finite (the business-bounded read)');
  assert.match(fn, /if \(error\) throw error;/, 'the read THROWS — the caller speaks its own error door');
  assert.match(fn, /table_label: dining_tables\?\.table_number \?\? null/, 'the table_label derivation byte-equal to fetchOrders');
  assert.match(fn, /return attachItems\(rows, tenantId\);/, 'the items bridge — complete Orders out');
  void _probe;
  ok('the day read: bounds from the ONE home, the embed + bridge held, no cap, throws');
}

/* 2 — the boundary law: [start, end) ≡ isSameAppDayAs, five instants. */
{
  /* 228's doctrine — the suite owns the clock. A fixed IST-morning instant. */
  const nowMs = Date.parse('2026-10-05T10:00:00.000Z'); // 15:30 IST
  const { startIso, endIso } = offTodayBoundsIso(nowMs);
  const startMs = Date.parse(startIso);
  const endMs = Date.parse(endIso);
  /* start−1ms belongs to yesterday; start is the day's first instant;
   * end−1ms is the day's last; end is tomorrow's first; end+1h is the
   * future-dated corrupt row. */
  const matrix = [
    ['start−1ms (yesterday)', startMs - 1, false],
    ['start (the first minute)', startMs, true],
    ['end−1ms (the last minute)', endMs - 1, true],
    ['end (tomorrow’s first)', endMs, false],
    ['end+1h (future-dated corrupt)', endMs + 3_600_000, false],
  ];
  for (const [name, t, want] of matrix) {
    const iso = new Date(t).toISOString();
    const serverSays = t >= startMs && t < endMs; // the read's gte/lt pair
    const clientSays = isSameAppDayAs(iso, nowMs);
    assert.equal(serverSays, want, `${name}: the read's verdict`);
    assert.equal(clientSays, want, `${name}: the client census's verdict`);
    assert.equal(serverSays, clientSays, `${name}: one word, both mouths`);
  }
  ok('the boundary law: [start, end) ≡ isSameAppDayAs over the five-instant matrix');
}

/* 3 — the board's wiring: the day read in, the browsing window extinct. */
{
  assert.match(kitchen, /const rows = await fetchTodayOrders\(tenantId\);/, 'the refetch reads the day');
  assert.ok(!/\bfetchOrders\(/.test(kitchen), 'the all-time newest-100 call form is extinct from the board');
  /* the overlay-ticks flow byte-true — a refetch that started before a
   * tick committed must never clobber the flip */
  assert.match(kitchen, /if \(pendingTicksRef\.current\.size > 0\) \{/, 'the overlay guard stands');
  assert.match(kitchen, /it\.checked_at = pendingTicksRef\.current\.get\(it\.id\) \? new Date\(\)\.toISOString\(\) : null;/, 'the tick overlay byte-true');
  assert.match(kitchen, /setOrders\(rows\);/, 'the board eats the read whole');
  /* the client's own verdicts stay — they now VERIFY, not rescue */
  assert.match(kitchen, /orders\.filter\(\(o\) => isSameAppDay\(o\.created_at\) && stageOf\(String\(o\.status\)\) !== null\)/, 'the board’s today filter byte-true');
  assert.match(kitchen, /String\(o\.status\)\.toLowerCase\(\) === 'cancelled' && isSameAppDay\(o\.created_at\)/, 'the cancelled-today filter byte-true');
  ok('the board reads the day it speaks; its own verdicts verify');
}

/* 4 — the counter's wiring: the list leg swapped, the census legs held. */
{
  assert.match(inbox, /fetchTodayOrders\(tenantId\),/, 'the list leg reads the day');
  assert.ok(!/\bfetchOrders\(/.test(inbox), 'the newest-100 call form is extinct from the inbox');
  assert.match(inbox, /fetchOffTodayCount\(tenantId, \['new'\]\)\.catch\(\(\) => null\),/, 'the census leg byte-true and fail-soft');
  assert.match(inbox, /fetchTables\(tenantId\),/, 'the tables leg unchanged');
  assert.match(inbox, /\.filter\(\(o\) => String\(o\.status\) === 'new' && isSameAppDay\(o\.created_at\)\)/, 'the list’s own verdict byte-true');
  assert.match(inbox, /\.sort\(\(a, b\) => a\.created_at\.localeCompare\(b\.created_at\)\)/, 'oldest-first, the chase reads top-down');
  ok('the inbox reads the day it speaks; the census legs ride unchanged');
}

/* 5 — one chip language, two rooms. */
{
  const core = 'rounded-full border border-[#E3E7E0] bg-white px-2.5 text-[12px] font-semibold text-[#5B6B63]';
  assert.ok(kitchen.includes(core), 'the board’s chip wears the house classes');
  assert.ok(inbox.includes(core), 'the inbox’s chip wears the house classes');
  const voice = 'appFormatters().dayLabel.format(new Date(nowMs))';
  assert.match(kitchen, new RegExp(`Today · \\{${voice.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`), 'the board’s chip speaks the house formatter');
  assert.match(inbox, new RegExp(`Today · \\{${voice.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`), 'the inbox’s chip speaks the house formatter');
  assert.equal((kitchen.match(/CalendarDays/g) || []).length >= 2, true, 'the board’s chip carries the day icon (import + use)');
  assert.equal((inbox.match(/CalendarDays/g) || []).length >= 2, true, 'the inbox’s chip carries the day icon (import + use)');
  assert.match(kitchen, /title="The board reads the whole day — every ticket from the day's first minute to its last, however busy the ledger runs"/, 'the board’s title names the whole-day read');
  assert.match(inbox, /title="The inbox reads the whole day — every news ticket from the day's first minute to its last, however busy the ledger runs"/, 'the inbox’s title names the whole-day read in the news grammar');
  ok('one chip language, two rooms: classes, formatter, icon, the honest scope word');
}

/* 6 — the downstream held: the cap law, the straggler word. */
{
  assert.match(kitchen, /const completedToday = completed\.length;/, 'the tally captured BEFORE the cap (the 5.262 law)');
  assert.match(kitchen, /const overflow = Math\.max\(0, completedToday - 12\);/, 'the 12-card cap byte-true');
  assert.match(kitchen, /byStage\.set\('completed', completed\.slice\(overflow\)\);/, 'the column keeps the newest 12');
  assert.match(inbox, /const stragglerN = staleCount \?\? stragglers\.length;/, "the counter's word unchanged (unit280/282's pins stand)");
  ok('the downstream held: the cap law and the straggler word stand');
}

/* 7 — no other room moved: the browsing window keeps its read. */
{
  const fn = api.slice(
    api.indexOf('export async function fetchOrders'),
    api.indexOf('export async function fetchOpenOrders'),
  );
  assert.match(fn, /export async function fetchOrders\(tenantId: string, limit = 100\)/, 'the browsing window keeps its default 100');
  assert.match(fn, /\.limit\(limit\);/, 'the browsing window keeps its cap');
  ok('no other room moved: fetchOrders stays the browsing window it always was');
}

/* 8 — the version law in the agreement shape. */
{
  const v = versionTs.match(/APP_VERSION = '([\d.]+)'/)?.[1];
  const sw = swJs.match(/const VERSION = "servepoint-v([\d.]+)-r1"/)?.[1];
  assert.ok(v, 'version.ts speaks a word');
  assert.equal(v, sw, 'version.ts and sw.js agree');
  ok(`the version law: ${v} agreed on both homes`);
}

console.log(`\nunit284: ${n} checks green`);
