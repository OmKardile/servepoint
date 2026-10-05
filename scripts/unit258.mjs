/* Task 258 — v5.219.0 unit suite: the trail remembers its days.
 * The drill's trail showed the six most recent scans and a dead-end count
 * ("+14 earlier scans on record") — the owner investigating a table's scan
 * story could never actually SEE the earlier scans. One expansion flag now
 * reveals the full history, grouped under its IST days (appDayKey — the ONE
 * day key, istDayPretty for the heading), newest day first, riding the
 * 5.218 heartbeat with no timer of its own. And the row body moved into ONE
 * sessionRow closure — the recent glance and the revealed history speak the
 * SAME voice (verdict, countdown, warm amber, cut arm), never a fork
 * (5.211's own-words rule, applied to rows). The card's "N open" pill joins
 * the warm grammar too: when every live window on the table is inside the
 * three-minute line the pill speaks the ribbon's amber and the title names
 * the countdown — the board answers "how long?" without opening the drill.
 * Asserted: showAllScans state born; ONE row grammar — both render sites
 * call sessionRow and the inline map body is retired; the expansion and
 * collapse buttons with honest aria (the count in full words); day grouping
 * through istDateKey/appDayKey with istDayPretty headings and the agreed
 * scan/scans plural; NO new timer in the file (the heartbeat stays the only
 * cadence); the warm pill's youngest-window arithmetic (reduce to Infinity,
 * the 180_000 gate, the amber bytes, the countdown in the title gated on
 * warm) with the cold pill's deep-ink bytes preserved.
 * Run: bunx vite-node scripts/unit258.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

const strip = (p) =>
  readFileSync(new URL(p, import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('/*') && !l.trim().startsWith('//'))
    .join('\n');

const floor = strip('../src/components/floor/FloorScreen.tsx');
const tsLib258 = strip('../src/lib/tableSession.ts');

/* ── 1. ONE row grammar — the closure and its two call sites ── */

const rowIdx = floor.indexOf('const sessionRow = (s: TableSession) => {');
assert.ok(rowIdx > 0, 'sessionRow closure exists');
const rowSlice = floor.slice(rowIdx, floor.indexOf('const olderScans = sessions.slice(6);', rowIdx));
assert.ok(rowSlice.length > 500 && rowSlice.length < 4200, 'row closure slice resolved (code anchors only)');
ok('the sessionRow closure exists');

assert.ok(floor.includes('{sessions.slice(0, 6).map(sessionRow)}'),
  'the recent glance renders through the closure');
assert.ok(floor.includes('{rows.map(sessionRow)}'),
  'the revealed history renders through the SAME closure');
assert.ok(!floor.includes('sessions.slice(0, 6).map((s) => {'),
  'the inline map body is retired — no forked row grammar');
ok('ONE row grammar for both render sites');

assert.ok(rowSlice.includes('const st = sessionState(s, now);'),
  'the closure reads the drill\'s heartbeat instant');
ok('the shared row reads the same heartbeat');

/* ── 2. The expansion — the dead-end count becomes a door ── */

assert.ok(floor.includes('const [showAllScans, setShowAllScans] = useState(false);'),
  'the expansion flag is born (default closed — the glance is unchanged)');
assert.ok(floor.includes('aria-label={`Show ${olderScans.length} earlier scans on this table`}'),
  'the expand aria names the count in full words');
assert.ok(floor.includes('+{olderScans.length} earlier scans on record — tap to show'),
  'the visible text still speaks the record, now with the invitation');
assert.ok(floor.includes('onClick={() => setShowAllScans(true)}'), 'the door opens');
ok('the dead-end count became a door with an honest aria');

assert.ok(floor.includes('"Show the six most recent scans only"'),
  'the collapse aria names what remains');
assert.ok(floor.includes('onClick={() => setShowAllScans(false)}'), 'the door closes');
assert.ok(floor.includes('Show recent only'), 'the collapse speaks plainly');
ok('the expansion collapses back to the glance');

/* ── 3. Day grouping — the ONE day key, newest day first ── */

assert.ok(floor.includes('const day = istDateKey(s.created_at);'),
  'groups key on istDateKey (appDayKey — the ONE day grammar)');
assert.ok(!floor.includes('dayKeyOf') || floor.indexOf('function dayKeyOf') === -1,
  'no second day-key function was born');
assert.ok(floor.includes("{istDayPretty(day)} · {rows.length} scan{rows.length === 1 ? '' : 's'}"),
  'day headings speak istDayPretty with the agreed plural');
assert.ok(floor.indexOf('const olderDayGroups') > 0 &&
  floor.indexOf('olderDayGroups.push([day, [s]]);') > 0,
  'groups derive per render — riding the heartbeat, no timer of their own');
ok('day grouping rides the ONE day key, derived per render');

/* ── 4. No new timer — the heartbeat stays the only cadence ── */

const intervalCount = floor.split('window.setInterval(').length - 1;
assert.equal(intervalCount, 4,
  `exactly the four pre-existing intervals (TimeAgo, the heartbeat, the promise tick, the poll) — found ${intervalCount}`);
ok('no new timer — the 5.218 heartbeat drives the history too');

/* ── 5. The card pill joins the warm grammar ── */

/* 5.220.0 evolution: the youngest-window reduce moved home to lib/tableSession
   (youngestLiveMs — ONE arithmetic, shared with the Dashboard's QR slot); the
   pill calls it on the table's own filtered windows. */
const pillIdx = floor.indexOf('const youngest = youngestLiveMs(liveWindowsOf(sessions, t.id, nowTick), nowTick);');
assert.ok(pillIdx > 0, 'the pill computes the table\'s youngest live window through the lib');
const pillSlice = floor.slice(pillIdx, pillIdx + 1200);
assert.ok(pillSlice.length > 300, 'pill slice resolved');

const ylmIdx = tsLib258.indexOf('export function youngestLiveMs');
const ylmSlice = tsLib258.slice(ylmIdx, tsLib258.length);
assert.ok(ylmSlice.includes('(m, s) => Math.min(m, new Date(s.expires_at).getTime() - nowMs)'),
  'the youngest window reads the SAME tick instant');
assert.ok(ylmSlice.includes('Infinity,'), 'the reduce seeds at Infinity — an empty set never lies');
ok('the youngest-window arithmetic lives in the lib, reads the tick, seeds at Infinity');

assert.ok(pillSlice.includes('const pillWarm = youngest < 180_000;'),
  'warm gates at the ribbon\'s three-minute line');
ok('the youngest-window arithmetic reads the tick, gated at three minutes');

assert.ok(pillSlice.includes("pillWarm ? 'bg-[#FBF3E4] text-[#8A5A16]' : 'bg-[#0F3D3E] text-white'"),
  'warm speaks the ribbon\'s amber; at ease the pill keeps its deep ink');
assert.ok(pillSlice.includes("pillWarm ? 'bg-[#D97706]' : 'bg-[#E7C878]'"),
  'the pulse dot agrees with the pill\'s mood');
assert.ok(pillSlice.includes("${pillWarm ? ` — ends in ${formatWindowLeft(youngest)}` : ''}"),
  'the title names the countdown ONLY when warm (a far window doesn\'t shout)');
assert.ok(pillSlice.includes("— freeing the table ends ${liveNow === 1 ? 'it' : 'them'}"),
  'the consequence clause survives intact (5.217\'s disclosure)');
ok('the pill speaks warm with the countdown, cold with the deep ink');

/* ── 6. The trail's own grammar is untouched ── */

assert.ok(rowSlice.includes("`ends in ${formatWindowLeft(msLeft)}`"),
  'the row countdown still speaks formatWindowLeft');
assert.ok(rowSlice.includes('font-semibold text-[#8A5A16]'),
  'the row\'s warm voice is unchanged');
ok('the row grammar survived the closure move');

/* ── 7. The day word owns its clock (the UTC-midnight lesson) ── */

/* unit228 and unit229 failed at UTC midnight on the CLEAN tree: dayLabel and
   dayTime judged "today/yesterday" against the REAL clock while their suites'
   fixtures lived on pinned ones — a test that passes by coincidence is a
   bug on a timer. The seam is now threaded everywhere (5.202's rule, kept). */
const day = strip('../src/lib/day.ts');

assert.ok(day.includes('export function isYesterdayAs(iso: string, nowMs: number): boolean'),
  'isYesterdayAs born — the explicit-clock twin');
assert.ok(day.includes('return isYesterdayAs(iso, Date.now());'),
  'the bare isYesterday delegates — ONE arithmetic, two registers');
assert.ok(day.includes('function nowKeyIn(tz: string, offsetDays = 0, nowMs: number = Date.now())'),
  'the tz day-key reads the same seam');
assert.ok(day.includes('export function dayLabel(iso: string, tz?: string, nowMs: number = Date.now()): string'),
  'dayLabel threads the seam');
assert.ok(day.includes('if (isSameLocalDayAs(iso, nowMs)) return \'\';') &&
  day.includes('if (isYesterdayAs(iso, nowMs)) return \'Yesterday\';'),
  'the local branch judges today/yesterday on the SAME now');
assert.ok(day.includes('export function dayTime(iso: string, tz?: string, nowMs: number = Date.now()): string'),
  'dayTime threads the seam to dayLabel');
ok('the day word judges on the clock it is given, never the wall behind it');

/* and the CSV's gate obeys the injection — no two clocks in one cell */
const bills = strip('../src/components/bills/BillsScreen.tsx');
assert.ok(bills.includes('isActive && !isSameLocalDayAs(o.created_at, nowMs) ? chaseAge(o.created_at, nowMs) : \'\''),
  'the CSV age cell: gate and arithmetic share the injected now');
ok('the CSV cell has ONE clock');

console.log(`\nunit258 — ${n} checks green (the trail remembers its days)`);
