/* Task 269 — v5.230.0 unit suite: the closing board tells the whole truth.
 *
 * The Close-out's "In the kitchen" tile counted only ['pending','preparing']
 * while the rail's own answer is isOnRail's THREE stages (5.196's law: one
 * set, no fork) — a ticket waiting on the pass (`ready`) was invisible on
 * the closing checklist: the owner closed thinking the board was clear
 * while cooked food sat unserved. And the tile was blind to STRANDED work:
 * rail-active tickets whose day is gone (the Dashboard's staleKitchen has
 * named them as whispers since 5.89) never reached the closing ritual.
 *
 * v5.230.0: (1) the tile reads isOnRail — two surfaces, one set, one
 * number (5.198); (2) the stranded census — a head-count of before-today
 * rail-active tickets, fail-soft the olderUnpaid way; (3) the stranded
 * whisper in the unpaid tile's own amber grammar; (4) the door follows
 * the truth (5.89/5.185): Kitchen when the board holds today's work,
 * Bills ('stuck' — the ghost view) when only the ghosts remain, silence
 * when the board is truly clear.
 *
 * Asserted: the fork is gone (the inline two-stage array extinct); the
 * memo reads isOnRail; the wire set IS isOnRail's set (every member
 * passes, every outsider fails); the fail-soft trio; the whisper bytes +
 * the one-whisper-grammar law (kitchen whisper's classes === unpaid
 * whisper's classes); the three-state door law + aria words; the unpaid
 * tile's byte-preservation; the Dashboard's register untouched; no new
 * timer.
 * Run: bunx vite-node scripts/unit269.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const kitchen = await import('/src/components/kitchen/KitchenScreen.tsx');
const { isOnRail } = kitchen;

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);
const strip = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

/* 1 — the rail's own contract, unchanged: three stages, one set (the
 * Dashboard's register since 5.196; the Close-out now quotes it). */
assert.equal(isOnRail('pending'), true);
assert.equal(isOnRail('preparing'), true);
assert.equal(isOnRail('ready'), true);
assert.equal(isOnRail('new'), false);
assert.equal(isOnRail('completed'), false);
assert.equal(isOnRail('cancelled'), false);
ok("isOnRail: pending/preparing/ready — 'new'/completed/cancelled out (the one set)");

/* ── source pins — the wiring cannot lie ── */
const src = strip('../src/components/eod/EodScreen.tsx');

/* 2 — THE FORK IS GONE: the inline two-stage array is extinct. A ticket
 * waiting on the pass can never again be invisible at closing time. */
assert.equal(
  src.includes("['pending', 'preparing'].includes"),
  false,
  'the two-stage fork must be extinct'
);
ok('fork extinct: the inline two-stage array no longer exists in the EOD');

/* 3 — the memo quotes the rail's own register (the 5.211 cross-screen
 * pattern: the import rides from KitchenScreen, isOnRail's home). */
assert.ok(
  src.includes("import { isOnRail } from '../kitchen/KitchenScreen';"),
  'the EOD imports isOnRail from its home'
);
assert.ok(
  src.includes('const inKitchen = orders.filter((o) => isOnRail(String(o.status))).length;'),
  'the memo reads isOnRail(String(o.status))'
);
ok('memo: inKitchen reads isOnRail — two surfaces, one set, one number (5.198)');

/* 4 — the wire carries isOnRail's own set: every member passes the rail,
 * and the query's exact bytes carry the three stages. */
const wire = ['pending', 'preparing', 'ready'];
for (const s of wire) assert.equal(isOnRail(s), true, `${s} must pass isOnRail`);
assert.ok(
  src.includes(".in('status', ['pending', 'preparing', 'ready'])"),
  'the stranded census queries the rail-active set'
);
ok('wire: the census queries exactly isOnRail\u2019s three stages');

/* 5 — the fail-soft trio: error → 0, throw → 0, past day → 0 (the
 * olderUnpaid pattern; silence, never an invented strand). */
assert.ok(
  src.includes('setStaleKitchen(r.error ? 0 : (r.count ?? 0));'),
  'a failed read silences the census'
);
const staleCount = src.match(/setStaleKitchen\(0\)/g) || [];
assert.equal(staleCount.length, 2, 'catch + past-day both reset to silence');
ok('fail-soft: error → 0, throw → 0, past day → 0 — the olderUnpaid pattern');

/* 6 — the stranded whisper: the Dashboard's own words, the unpaid tile's
 * own amber grammar — ONE whisper voice per strip. */
assert.ok(
  src.includes("{staleKitchen} older stuck {staleKitchen === 1 ? 'ticket' : 'tickets'} off today's board — see Bills"),
  'the whisper names the stranded work'
);
const whisperClass = 'mt-0.5 flex items-center gap-1 text-[10.5px] font-semibold text-[#8A5A00]';
const kitchenWhisper = src.includes(`className="${whisperClass}"`);
assert.ok(kitchenWhisper, 'the kitchen whisper wears the strip\u2019s amber');
const whisperCount = src.match(new RegExp(whisperClass.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || [];
assert.equal(whisperCount.length, 2, 'exactly two whispers share the voice (kitchen + unpaid)');
const gateCount = src.match(/staleKitchen > 0 && \(/g) || [];
assert.equal(gateCount.length, 1, 'the whisper renders at exactly one site');
ok('whisper: stranded named in the unpaid tile\u2019s own amber — one voice, one site, gated > 0');

/* 7 — the door follows the truth (three states): Kitchen when the board
 * holds today's work; Bills ('stuck' — the ghost view) when only ghosts
 * remain; null when the board is truly clear. */
assert.ok(
  src.includes("onOpen={() => goSection('kitchen', ['Close-out', 'Kitchen'])}"),
  'the Kitchen door survives'
);
assert.ok(
  src.includes("onOpen={() => goSection('bills', ['Close-out', 'Bills'], 'stuck')}"),
  "the Bills door carries the 'stuck' hint"
);
assert.ok(
  src.includes("aria={`Open Bills — ${staleKitchen} older ${staleKitchen === 1 ? 'ticket waits' : 'tickets wait'} off today's board`}"),
  'the Bills door names the stranded in its aria'
);
ok("door law: Kitchen when work, Bills + 'stuck' when ghosts, null when clear");

/* 8 — the unpaid tile keeps its bytes (the neighbour law): the census
 * added, nothing rewritten. */
assert.ok(
  src.includes("{olderUnpaid} older unpaid off today's book — see Bills"),
  'the unpaid whisper survives byte-identical'
);
assert.ok(
  src.includes("onOpen={() => goSection('bills', ['Close-out', 'Bills'], 'unpaid')}"),
  'the unpaid door survives byte-identical'
);
ok('neighbour: unpaid whisper + unpaid door byte-identical');

/* 9 — the Dashboard's register: staleKitchen's derivation keeps its
 * bytes (two surfaces, one register — neither moved). Re-anchored
 * honestly (5.244.0): the ghost door's aria now rides the whole-book
 * word (staleKitchenN — the server rail census with the page census
 * as the fail-soft fallback); the aria's GRAMMAR is byte-identical,
 * only the rider's name moved (the unit241 lesson, again). */
const dash = strip('../src/components/dashboard/DashboardScreen.tsx');
assert.ok(
  dash.includes('const staleKitchen = staleOlder.filter((o) => isOnRail(String(o.status)));'),
  "the Dashboard's staleKitchen keeps its derivation"
);
assert.ok(
  dash.includes("aria: `Open Bills — ${staleKitchenN} older ${staleKitchenN === 1 ? 'ticket waits' : 'tickets wait'} off today's board`,"),
  "the Dashboard's ghost door keeps its aria (on the whole-book rider)"
);
ok('Dashboard: staleKitchen derivation byte-identical + ghost door grammar on the whole-book rider');

/* 10 — no new timer: a census fetched beside the day's own load; the
 * screen's two standing intervals (the drawer poll + the day poll) are
 * untouched — the count stands. */
const timers = src.match(/setInterval/g) || [];
assert.equal(timers.length, 2, 'setInterval count stands at 2 (drawer + day poll)');
ok('no new timer: the census rides the day load — the two intervals stand');

console.log(`\nunit269 — ${n} checks green`);
