/* Task 278 — v5.239.0 unit suite: one today in every room.
 *
 * The classified watch item from 5.238's walk, paid: Bills' filter and
 * chase gates, the Dashboard's older split, the counter inbox's queue
 * and the Kitchen's board all asked "is this ticket from today" of the
 * BROWSER's local day (lib/day's isSameLocalDay) — while the Close-out's
 * book, Reports' windows and (since 5.238) Bills' own custom bounds
 * spoke the app's clock. A browser outside the cafe's zone answered a
 * different day per room. One clock now: appday's isSameAppDay(As) —
 * the cafe's own day — at all twelve sites across the five rooms.
 *
 * The laws, kept and extended:
 * - The explicit-clock twin (228's doctrine): suites own now,
 *   predicates stay deterministic; the bare one-arg form delegates.
 * - The injection survives: lastRailTicketAt still TAKES the day
 *   grammar — the Kitchen just passes the app-clock one now.
 * - The local twins stay in lib/day for the reader-register voices
 *   (chat day dividers, last-seen labels) — those label the READER's
 *   day, and the browser's clock is the honest one there.
 * - The rolling 7d week keeps its bytes (its fossil is a separate,
 *   still-classified watch item).
 *
 * Asserted: the twin BY BEHAVIOR — the UTC-evening case where the local
 * and app clocks disagree (20:30Z is "today" locally but 02:00 tomorrow
 * in IST: local says true, app says false — the whole point of the
 * round, provable in any runner); the mid-day case where both agree;
 * the bare form delegating; ONE clock in the five rooms (zero
 * isSameLocalDay imports left, twelve app-clock sites); the injection
 * preserved; the lib twins alive for the reader register; and the
 * version law (version.ts and sw.js agree on 5.239.0).
 * Run: bunx vite-node scripts/unit278.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isSameAppDayAs, isSameAppDay } from '/src/lib/appday.ts';
import { isSameLocalDayAs, isSameLocalDay } from '/src/lib/day.ts';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);
const strip = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const bills = strip('../src/components/bills/BillsScreen.tsx');
const dash = strip('../src/components/dashboard/DashboardScreen.tsx');
const inbox = strip('../src/components/food/CounterInbox.tsx');
const kitchen = strip('../src/components/kitchen/KitchenScreen.tsx');
const dayLib = strip('../src/lib/day.ts');
const versionSrc = strip('../src/version.ts');
const swSrc = strip('../public/sw.js');

/* ── 1. the twin by behavior — the disagreement case ── */
/* NOW = 5 Oct 2026, 17:30 UTC → 22:30 IST, still 5 Oct in the cafe. */
const NOW = Date.UTC(2026, 9, 5, 17, 30, 0);
/* 20:30 UTC the same UTC day → 02:00 IST on 6 Oct: the browser's local
 * day says "today", the cafe's clock says "tomorrow". THE case. */
const evening = '2026-10-05T20:30:00Z';
assert.equal(isSameLocalDayAs(evening, NOW), true, 'the local twin says today (same UTC day)');
assert.equal(isSameAppDayAs(evening, NOW), false, 'the app twin says tomorrow (02:00 IST)');
ok('the UTC-evening case: local says today, the cafe\u2019s clock says tomorrow');

/* ── 2. the agreement case ── */
const midday = '2026-10-05T10:00:00Z'; /* 15:30 IST — both clocks say 5 Oct */
assert.equal(isSameAppDayAs(midday, NOW), true, 'mid-day IST is today on the app clock');
assert.equal(isSameLocalDayAs(midday, NOW), true, 'and on the local clock too');
ok('the mid-day case: both clocks agree');

/* ── 3. the explicit clock is honored, not the wall ── */
const LATER = Date.UTC(2026, 9, 6, 3, 0, 0); /* 6 Oct 08:30 IST */
assert.equal(isSameAppDayAs(midday, LATER), false, 'the same instant is NOT today on a later clock');
ok('suites own now — the predicate judges on the clock it is given');

/* ── 4. the bare form delegates ── */
assert.equal(isSameAppDay(new Date().toISOString()), true, 'a just-now instant is today');
assert.equal(isSameAppDay('2020-01-01T00:00:00Z'), false, '2020 is not today');
ok('the bare form delegates to the explicit twin');

/* ── 5. ONE clock in the five rooms ── */
for (const [name, src] of [['Bills', bills], ['Dashboard', dash], ['CounterInbox', inbox], ['Kitchen', kitchen]]) {
  assert.ok(!src.includes('isSameLocalDay'), `${name} no longer asks the browser's day`);
  assert.ok(src.includes('isSameAppDay'), `${name} asks the app-day clock`);
}
ok('the five rooms ask ONE clock — zero isSameLocalDay left in the ticket rooms');

/* ── 6. the twelve sites ── */
const billsSites = (bills.match(/isSameAppDay(As)?\(/g) || []).length;
assert.equal(billsSites, 6, `Bills: six app-clock sites (ghost, CSV gate, filter, census, row chip, detail) — found ${billsSites}`);
assert.equal((dash.match(/isSameAppDay\(/g) || []).length, 2, 'Dashboard: liveToday + staleOlder');
assert.equal((inbox.match(/isSameAppDay\(/g) || []).length, 1, 'CounterInbox: the new queue');
const kitchenCalls = (kitchen.match(/isSameAppDay\(o\.created_at\)/g) || []).length;
assert.equal(kitchenCalls, 2, `Kitchen: todays + cancelledToday call it — found ${kitchenCalls}`);
ok('twelve sites across five rooms, all on the app clock');

/* ── 7. the injection survives ── */
assert.ok(kitchen.includes('lastTicketAt: lastRailTicketAt(orders, isSameAppDay),'), 'the quiet line still TAKES the day grammar — the caller just passes the app-clock one');
ok('the grammar stays injected — suites still own now');

/* ── 8. the reader register keeps its own clock ── */
assert.ok(dayLib.includes('export function isSameLocalDayAs'), 'the local twin lives on in lib/day');
assert.ok(dayLib.includes('the ticket rooms no longer ask this'), 'the scope note says who moved and why');
ok('the local twins stay for the reader-register voices');

/* ── 9. the version law: one word, two homes ── */
assert.ok(versionSrc.includes("APP_VERSION = '5.239.0'"), 'version.ts speaks 5.239.0');
assert.ok(swSrc.includes('const VERSION = "servepoint-v5.239.0-r1";'), 'the service worker bakes the same round');
ok('the version law — 5.239.0 in version.ts and sw.js');

console.log(`\nunit278: ${n} checks green — one today in every room`);
