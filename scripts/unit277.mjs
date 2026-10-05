/* Task 277 — v5.238.0 unit suite: the chase answers to a calendar.
 *
 * The Task 277 walk (Menu, Inventory, Dashboard — all healthy; the
 * shelf's answer, the thin-margin voice and the movers holding) took
 * the window grammar's next borrower: Bills' date filter spoke only
 * Today / Last 7 days / All time, so "show me the 2nd's tickets" — the
 * chase for a specific day's money — had no answer. Custom joins as the
 * FOURTH date key, riding lib/reportWindow's ONE home (5.236): the
 * bounds and the spoken span come from THE lib (orderedCustom inside;
 * the same swap, the same 7-day fallback, the same span phrase Reports
 * speaks), never an inline fork.
 *
 * The honest laws, kept and extended:
 * - The pair arms pre-filled with the last 7 days (7 calendar days
 *   ending today, today inclusive) — Custom is never an empty or
 *   invalid state; the owner adjusts from a truth they can see.
 * - The cleared-filters chip leaves the pair armed — re-selecting
 *   Custom shows the owner's own words, not a reset.
 * - The bounds are the app-day clock's (IST) — the same clock the
 *   Close-out's day and Reports' windows speak, so "2 Oct" means the
 *   same day in every room.
 * - The label everywhere speaks the DATES the owner chose ("2 Oct –
 *   5 Oct"), never the bare chip word "Custom": the miss sentence says
 *   "No bills from 2 Oct – 5 Oct", the filterLabels entry says
 *   "Custom (2 Oct – 5 Oct)", and the row's hint says "Showing 2 Oct –
 *   5 Oct" — with the honest note when the pair was typed reversed.
 * - Both inputs max at today (the future has no ledger) and wear the
 *   house date-box ink (sp-input, gold focus ring #967221) — one ink
 *   for every date box in the app.
 * - The fixed keys stay byte-true: Today still asks isSameLocalDay,
 *   Last 7 days still asks its rolling weekAgo (their clock fossil is
 *   a classified watch item, entangled with the 5.203 ghost law — not
 *   this round's reach).
 *
 * Asserted: the union gained 'custom'; the pair's armed defaults
 * (shiftDayIso(-6) / appTodayIso()); the predicate asking rangeWindow
 * ('custom', pair) with the structural null guard; the memo's deps
 * riding the pair; the option present and ordered before 'all'; the
 * calendar row revealed only while Custom stands (role=group, both
 * inputs, max today, the ink, the span hint, the swapped note); the
 * labels speaking the span (windowPhrase `from ${span}`, filterLabels
 * `Custom (${span})`); ONE derivation (no inline calendar math in the
 * file — no setUTCDate); the fixed keys' preserved bytes; and the
 * version law (version.ts and sw.js agree on 5.238.0).
 * Run: bunx vite-node scripts/unit277.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rangeWindow, rangeLabelOf, orderedCustom } from '/src/lib/reportWindow.ts';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);
const strip = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const bills = strip('../src/components/bills/BillsScreen.tsx');
const versionSrc = strip('../src/version.ts');
const swSrc = strip('../public/sw.js');

/* ── 1. the union gained the owner's own calendar ── */
assert.ok(bills.includes("type DateFilter = 'today' | '7d' | 'custom' | 'all';"), "the DateFilter union speaks 'custom'");
ok('Custom joins as the fourth date key');

/* ── 2. the pair arms pre-filled — never an empty Custom ── */
assert.ok(bills.includes('useState<string>(() => shiftDayIso(-6))'), 'From arms 6 days back (the last 7 days, today inclusive)');
assert.ok(bills.includes("useState<string>(() => appTodayIso())"), 'To arms today');
ok('the pair arms pre-filled with the last 7 days');

/* ── 3. the predicate asks THE window builder ── */
assert.ok(
  bills.includes("rangeWindow('custom', { from: customFrom, to: customTo })"),
  'the bounds come from rangeWindow — orderedCustom inside',
);
const customBranch = bills.slice(bills.indexOf("if (dateFilter === 'custom') {"), bills.indexOf("if (q) {"));
assert.ok(customBranch.includes('startMs !== null && (t < startMs || t > endMs)'), 'the structural null guard stands');
assert.ok(!customBranch.includes('setUTCDate') && !customBranch.includes('appDayStartMs('), 'no inline calendar math in the branch');
ok('the predicate asks THE window builder, guarded');

/* ── 4. ONE derivation: the file never grows a second calendar ── */
assert.ok(!/\bsetUTC(Date|Month)\b/.test(bills), 'no inline UTC calendar arithmetic anywhere in Bills');
ok('ONE derivation — no inline fork of the window grammar');

/* ── 5. the memo rides the pair ── */
assert.ok(
  bills.includes('}, [orders, statusFilter, dateFilter, search, customFrom, customTo]);'),
  'the filter memo\u2019s deps ride customFrom/customTo — no stale window',
);
ok('the filter memo rides the pair');

/* ── 6. the option exists, ordered before All time ── */
const opts = bills.slice(bills.indexOf('aria-label="Filter bills by date"'), bills.indexOf('aria-label="Filter bills by date"') + 600);
assert.ok(opts.includes('<option value="custom">Custom</option>'), 'the Custom option exists');
assert.ok(opts.indexOf('value="custom"') < opts.indexOf('value="all"'), 'Custom stands before All time');
ok('the combobox offers Custom');

/* ── 7. the calendar row reveals only while Custom stands ── */
const rowIdx = bills.indexOf('aria-label="Custom chase range"');
assert.ok(rowIdx > -1, 'the row exists with its group name');
const reveal = bills.slice(rowIdx - 400, rowIdx);
assert.ok(reveal.includes("{dateFilter === 'custom' ? ("), 'the row reveals only while Custom stands');
assert.equal((bills.match(/max=\{appTodayIso\(\)\}/g) || []).length, 2, 'both inputs cap at today');
assert.ok(bills.includes('aria-label="Custom chase start date"'), 'From speaks its name');
assert.ok(bills.includes('aria-label="Custom chase end date"'), 'To speaks its name');
assert.equal((bills.match(/sp-input h-9 rounded-xl border border-\[#E3E7E0\]/g) || []).length, 2, 'both inputs wear the house ink');
const dateBoxInk =
  'sp-input h-9 rounded-xl border border-[#E3E7E0] bg-white px-2.5 text-[12.5px] font-semibold text-[#1A1A1A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#967221]';
assert.equal((bills.match(new RegExp(dateBoxInk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 2, 'both date boxes wear the exact house ink (ring included)');
ok('the calendar row — gated, capped, named, inked');

/* ── 8. the labels speak the span, never the bare chip word ── */
assert.ok(bills.includes('`from ${rangeLabelOf(\'custom\', { from: customFrom, to: customTo })}`'), 'the miss sentence says "from <span>"');
assert.ok(bills.includes('`Custom (${customSpan})`'), 'the filterLabels entry says "Custom (<span>)"');
assert.ok(bills.includes('Showing {customSpan}'), 'the hint speaks the span live');
assert.ok(bills.includes("the dates were swapped, the chase read them the honest way"), 'the reversed pair says so');
ok('the labels speak the DATES the owner chose');

/* ── 9. the fixed keys' clock — 5.239.0 moved Today to the app's clock ── */
/* 5.239.0 re-anchor: the "fixed keys byte-true" law was about not touching
 * them while Custom joined (5.238); the next round's ONE-clock law moved
 * Today's predicate to isSameAppDay (the cafe's day — the same "today"
 * the custom bounds and the Close-out speak). The rolling weekAgo keeps
 * its bytes. */
assert.ok(bills.includes("if (dateFilter === 'today' && !isSameAppDay(o.created_at)) return false;"), 'Today asks the app-day clock');
assert.ok(bills.includes("if (dateFilter === '7d' && new Date(o.created_at).getTime() < weekAgo) return false;"), 'Last 7 days keeps its rolling week');
ok('the fixed keys — Today on the app clock, the rolling week byte-true');

/* ── 10. the lib behavior the borrower rides (the contract, re-proven) ── */
assert.deepEqual(orderedCustom({ from: '2026-10-05', to: '2026-10-02' }), ['2026-10-02', '2026-10-05'], 'the swap holds');
const win = rangeWindow('custom', { from: '2026-10-02', to: '2026-10-02' });
assert.ok(win.startMs !== null && win.endMs >= win.startMs, 'a single day resolves a real window');
assert.ok(rangeLabelOf('custom', { from: '2026-10-02', to: '2026-10-02' }).includes('Oct'), 'a single day speaks just its date');
assert.equal(rangeLabelOf('custom', { from: '2026-10-02', to: '2026-10-05' }), '2 Oct – 5 Oct', 'the span phrase is the house grammar\u2019s');
ok('the borrowed contract holds (swap, window, span)');

/* ── 11. the version law: one word, two homes ── */
/* 5.239.0 re-anchor: the law is the AGREEMENT (sw bakes whatever word
 * version.ts speaks — unit274's shape), not a frozen number; a frozen
 * pin goes stale on every honest bump. */
const { APP_VERSION: v277 } = await import('/src/version.ts');
assert.ok(v277.length > 0, 'version.ts speaks a word');
assert.ok(swSrc.includes(`servepoint-v${v277}-r1`), 'the service worker bakes the same round');
ok(`the version law — version.ts and sw.js agree on ${v277}`);

console.log(`\nunit277: ${n} checks green — the chase answers to a calendar`);
