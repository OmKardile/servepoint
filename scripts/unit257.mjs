/* Task 257 — v5.218.0 unit suite: the drill's clock runs.
 * The Floor drill's session trail was a frozen clock: a live window said
 * "4m left" at render time and the row kept saying "menu open" after the
 * window died, because nothing re-rendered it — the same frozen instant fed
 * the cut-all count and the cards' "N open" pill. One heartbeat now owns the
 * drill: a captured `now` per tick re-anchors the trail's countdown, its
 * live/expired verdict, the cut-all count and the card pills on the SAME
 * instant — display and verdict are one arithmetic (the guest ribbon's
 * 5.216.0 discipline, scoped to the floor's own clock rule). The live row
 * speaks "ends in m:ss" at second granularity and flips to expired on the
 * very tick its window dies; under three minutes it speaks the ribbon's
 * warm amber. The m:ss voice itself moved to lib/appday's formatWindowLeft
 * so the guest ribbon and the owner drill speak the SAME grammar — never
 * two dialects of one window.
 * Asserted: formatWindowLeft's behavior (clamp, pad, floor, no hour
 * rollover); sessionState/liveWindowsOf take the optional nowMs (default
 * Date.now() keeps every existing call site valid); ONE heartbeat with a
 * cadence that flips on hasLiveWindow (1s live / 30s quiet) with cleanup and
 * re-arm; hasLiveWindow recomputed per render (not memo'd — the flip must
 * happen on the tick that kills the last window); the card pill and the
 * cut-all count thread the tick; the trail's verdict and countdown read the
 * SAME now; the warm amber bytes; the expired branch keeps its ago-form;
 * GuestPages imports the shared formatter and the inline mm/ss is retired.
 * Run: bunx vite-node scripts/unit257.mjs
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

/* ── 1. formatWindowLeft — the ONE window grammar (behavior, not bytes) ── */

const { formatWindowLeft } = await import('/src/lib/appday.ts');
assert.equal(typeof formatWindowLeft, 'function', 'formatWindowLeft exported from lib/appday');
ok('formatWindowLeft exported from the lib home');

assert.equal(formatWindowLeft(597_000), '9:57', 'the ribbon\'s own E2E number speaks identically');
ok('597000 → 9:57 (minutes unpadded, seconds padded)');

assert.equal(formatWindowLeft(65_000), '1:05', 'seconds are two-digit padded');
ok('65000 → 1:05 (seconds padded)');

assert.equal(formatWindowLeft(0), '0:00', 'zero is 0:00, never an empty voice');
assert.equal(formatWindowLeft(-1), '0:00', 'a negative remainder clamps to 0:00 — a dead window never reads as time owed');
assert.equal(formatWindowLeft(-600_000), '0:00', 'deeply negative (a drifted clock) clamps too');
ok('the clamp holds (0 and negatives → 0:00)');

assert.equal(formatWindowLeft(599_000), '9:59');
assert.equal(formatWindowLeft(600_000), '10:00', 'ten minutes speaks 10:00 — no hour rollover on a 10-minute window');
assert.equal(formatWindowLeft(3_599_000), '59:59', 'minutes keep counting past 9 without rolling');
ok('no hour rollover — minutes carry the count');

/* ── 2. The floor's heartbeat — one clock for every consumer ── */

const floor = strip('../src/components/floor/FloorScreen.tsx');

// sessionState and liveWindowsOf take the shared instant; defaults keep every
// existing call site valid.
const tsLib = strip('../src/lib/tableSession.ts');
assert.ok(tsLib.includes('export function sessionState(s: TableSession, nowMs: number = Date.now()): SessionState'),
  'sessionState takes the optional nowMs (default Date.now())');
assert.ok(tsLib.includes('export function liveWindowsOf(rows: TableSession[], tableId: string, nowMs: number = Date.now())'),
  'liveWindowsOf takes the optional nowMs');
assert.ok(tsLib.includes('sessionState(s, nowMs) === \'live\''), 'liveWindowsOf threads nowMs into sessionState');
assert.ok(floor.includes("} from '../../lib/tableSession';"), 'the Floor imports the lib body — no second liveness rule');
assert.ok(!floor.includes('function sessionState(') && !floor.includes('type SessionState'),
  'the Floor keeps NO local copy of the clock rule');
ok('sessionState/liveWindowsOf take the shared instant and live in the lib home');

// The heartbeat: exactly ONE dynamic-cadence interval, gated on hasLiveWindow.
const tickCount = floor.split('hasLiveWindow ? 1000 : 30000').length - 1;
assert.equal(tickCount, 1, `exactly one dynamic-cadence tick (found ${tickCount})`);
ok('exactly ONE heartbeat — the cadence ternary appears once');

const tickIdx = floor.indexOf('hasLiveWindow ? 1000 : 30000');
const tickBody = floor.slice(tickIdx - 220, tickIdx + 160);
assert.ok(tickBody.includes('window.clearInterval(t)'), 'the heartbeat cleans up its interval');
assert.ok(tickBody.includes('[hasLiveWindow]'), 'the heartbeat re-arms when the gate flips');
ok('the heartbeat cleans up and re-arms on the cadence flip');

// hasLiveWindow is recomputed per render — NOT memo'd — so the very tick that
// kills the last live window also flips the cadence.
assert.ok(floor.includes("const hasLiveWindow = sessions.some((s) => sessionState(s, nowTick) === 'live');"),
  'hasLiveWindow reads the tick instant');
const hlwIdx = floor.indexOf('const hasLiveWindow =');
assert.ok(!floor.slice(hlwIdx, hlwIdx + 200).includes('useMemo'),
  'hasLiveWindow must NOT be memoized — a memo would freeze the cadence flip');
ok('hasLiveWindow is recomputed every render (the flip happens on the killing tick)');

// The card pill threads the tick — a pill can never outlive its window.
assert.ok(floor.includes('liveWindowsOf(sessions, t.id, nowTick)'),
  'the card pill re-anchors on the tick');
ok('the cards\' "N open" pill reads the tick');

// TableDrill receives the instant (invocation + prop type).
assert.ok(floor.includes('now={nowTick}'), 'the drill receives the parent\'s instant');
assert.ok(floor.includes('now: number;'), 'the drill\'s prop type names now: number');
ok('the drill receives the heartbeat as a prop');

// liveIds (the cut-all count) re-anchors too — the armed count names windows
// that are actually open, not the ones open at refresh.
const liveIdx = floor.indexOf('const liveIds = useMemo(');
const liveSlice = floor.slice(liveIdx, liveIdx + 260);
assert.ok(liveSlice.includes('sessionState(s, now)'), 'the cut-all count reads the drill\'s now');
assert.ok(liveSlice.includes('[sessions, now]'), 'the cut-all memo re-anchors on the tick');
ok('the armed cut-all count re-anchors on the tick');

/* ── 3. The trail rows — verdict and countdown are one arithmetic ── */

/* 5.219.0 evolution: the row body moved into the sessionRow closure (ONE
   row grammar for the recent rows AND the revealed history — never a fork).
   The slice anchors are code-level, per the house lesson. */
const mapIdx = floor.indexOf('const sessionRow = (s: TableSession) => {');
const mapSlice = floor.slice(mapIdx, floor.indexOf('const olderScans = sessions.slice(6);', mapIdx));
assert.ok(mapSlice.length > 500 && mapSlice.length < 4200, 'trail row closure slice resolved (code anchors only)');

assert.ok(mapSlice.includes('const st = sessionState(s, now);'),
  'the row\'s verdict reads the drill\'s now');
assert.ok(mapSlice.includes("const msLeft = st === 'live' ? new Date(s.expires_at).getTime() - now : 0;"),
  'the countdown reads the SAME now as the verdict');
ok('verdict and countdown read the same instant');

assert.ok(mapSlice.includes('`ends in ${formatWindowLeft(msLeft)}`'),
  'the live row speaks "ends in m:ss"');
assert.ok(mapSlice.includes(": st === 'expired'\n              ? expiryRel(s.expires_at)"),
  'the expired branch keeps its ago-form');
assert.ok(mapSlice.includes(': tone.label}'), 'consumed/revoked keep their own labels');
ok('the live row says "ends in", the expired row keeps its ago-form');

// The warm voice: under three minutes the countdown speaks the ribbon's amber.
assert.ok(mapSlice.includes("const warm = st === 'live' && msLeft < 180_000;"),
  'warm gates at the ribbon\'s three-minute line');
assert.ok(mapSlice.includes("font-semibold text-[#8A5A16]"), 'warm speaks the ribbon\'s amber, semibold');
assert.ok(mapSlice.includes("font-medium text-[#0F3D3E]"), 'a live window at ease speaks the row\'s own deep ink');
ok('the warm amber and the deep-ink ease are both pinned');

// The flip: nothing in the live branch can outlive the verdict — the
// countdown text only renders when st === 'live'.
assert.ok(mapSlice.indexOf("? `ends in ${formatWindowLeft(msLeft)}`") < mapSlice.indexOf("st === 'expired'"),
  'the live branch renders before the expired branch (the verdict gates the text)');
ok('the countdown is gated on the verdict — no "0:00 · menu open" frame');

/* ── 4. One grammar, two rooms — the guest ribbon speaks the lib voice ── */

const guest = strip('../src/components/guest/GuestPages.tsx');

assert.ok(guest.includes("import { formatWindowLeft } from '../../lib/appday';"),
  'GuestPages imports the shared formatter');
ok('the guest ribbon imports the lib grammar');

const rbIdx = guest.indexOf('function SessionRibbon(');
assert.ok(rbIdx > 0, 'SessionRibbon exists');
const rbSlice = guest.slice(rbIdx, guest.indexOf('function DishPhoto', rbIdx));
assert.ok(rbSlice.length > 500 && rbSlice.length < 2600, 'ribbon slice resolved (code anchors only)');

assert.ok(rbSlice.includes('const left = formatWindowLeft(msLeft);'),
  'the ribbon composes its voice through the shared helper');
assert.ok(rbSlice.includes("t('ariaEnds', { t: left })"), 'the aria speaks the same composed voice');
assert.ok(!rbSlice.includes('padStart'), 'the inline mm/ss body is retired from the ribbon');
assert.ok(!rbSlice.includes('${mm}:${ss}'), 'the old inline template is gone');
ok('the ribbon speaks the lib voice, the inline body is retired');

/* ── 5. The floor never grew a second window arithmetic ── */

assert.ok(!floor.includes('padStart(2, \'0\')'), 'the floor speaks formatWindowLeft, never its own mm:ss');
assert.equal(floor.split('formatWindowLeft').length - 1 >= 2, true, 'the floor uses the shared grammar');
ok('one window arithmetic across both surfaces');

console.log(`\nunit257 — ${n} checks green (the drill's clock runs)`);
