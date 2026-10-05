/* Task 259 — v5.220.0 unit suite: the QR channel reaches the dashboard.
 * The session clock rule (live vs expired, the tones, the per-table filter,
 * the youngest window) lived inside FloorScreen.tsx since v5.23.0 — a
 * component file. The Dashboard's needs band needed the SAME verdict, and a
 * copy would have been a second liveness rule (the one thing the house never
 * allows), so the body moved home to lib/tableSession.ts and BOTH surfaces
 * import it. The needs band grows a QR slot: guests holding live menus are
 * "needs you now" by definition, and a window inside its last three minutes
 * is about to close — the slot speaks the STATE (warm amber), never a
 * stopwatch, because the band re-renders on the 30s loop and a frozen
 * countdown is the exact lie 5.218.0 killed. Zero live windows is NOT a
 * slot — the band's own all-clear is the honest voice for a quiet board —
 * and a FAILED read renders nothing at all (silence, never a zero).
 * Asserted: the lib's behavior (verdicts, the nowMs seam, the Infinity seed,
 * the negative passing through — the display owns the clamp); the Floor
 * imports the lib and keeps NO local copy; the pill composes per-table
 * through the lib; the Dashboard's read is individually fail-soft (null →
 * silence); the slot gated on live > 0 with the warm state bytes and the
 * state-word hint (NO formatWindowLeft in the Dashboard file); the door to
 * the Floor; exactly ONE interval in the Dashboard file (the 30s loop the
 * slot rides — no timer of its own).
 * Run: bunx vite-node scripts/unit259.mjs
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

/* ── 1. The lib's behavior — ONE liveness verdict, testable because pure ── */

const { sessionState, liveWindows, liveWindowsOf, youngestLiveMs, SESSION_TONE } =
  await import('/src/lib/tableSession.ts');

const mk = (over = {}) => ({
  id: 's1',
  tenant_id: 't1',
  table_id: 'T1',
  status: 'active',
  expires_at: new Date(Date.now() + 300_000).toISOString(),
  last_activity_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  ...over,
});

const NOW = Date.now();
assert.equal(sessionState(mk(), NOW), 'live', 'an active row with a future expiry is live');
assert.equal(sessionState(mk({ expires_at: new Date(NOW - 1000).toISOString() }), NOW), 'expired',
  'the clock, not the stored status, decides');
assert.equal(sessionState(mk({ status: 'consumed' }), NOW), 'consumed');
assert.equal(sessionState(mk({ status: 'revoked' }), NOW), 'revoked');
ok('sessionState verdicts: live/expired by the clock, consumed/revoked by the write');

const future = mk();
assert.equal(sessionState(future, NOW - 400_000), 'live', 'a now well before the expiry judges it live');
assert.equal(sessionState(future, NOW + 400_000), 'expired', 'a now well past the expiry judges it expired — the seam is real');
ok('the nowMs seam: the SAME row, two clocks, two honest verdicts');

assert.equal(SESSION_TONE.live.label, 'menu open');
assert.equal(SESSION_TONE.expired.label, 'expired');
assert.equal(SESSION_TONE.consumed.label, 'used');
assert.equal(SESSION_TONE.revoked.label, 'cut');
ok('the four tones speak the drill\'s own labels');

const rows = [mk({ id: 'a', table_id: 'T1', expires_at: new Date(NOW + 300_000).toISOString() }), mk({ id: 'b', table_id: 'T2', expires_at: new Date(NOW + 120_000).toISOString() }), mk({ id: 'c', table_id: 'T1', expires_at: new Date(NOW - 1).toISOString() })];
assert.equal(liveWindows(rows, NOW).length, 2, 'liveWindows counts across ALL tables');
assert.equal(liveWindowsOf(rows, 'T1', NOW).length, 1, 'liveWindowsOf filters to ONE table');
assert.equal(liveWindowsOf(rows, 'T9', NOW).length, 0, 'an unknown table holds nothing');
ok('liveWindows / liveWindowsOf ride the same predicate');

assert.equal(youngestLiveMs([], NOW), Infinity, 'an EMPTY set seeds at Infinity — it never reads warm');
const y = youngestLiveMs(rows, NOW);
assert.equal(y, 120_000, 'the youngest is the smallest remainder (T2\'s 120s), not the largest');
assert.ok(youngestLiveMs(rows, NOW) > 0, 'the live filter guarantees a positive remainder — the display owns zero');
ok('youngestLiveMs: Infinity seed, honest minimum, positives only');

/* ── 2. The Floor imports the lib home — no second liveness rule ── */

const floor = strip('../src/components/floor/FloorScreen.tsx');
assert.ok(floor.includes("} from '../../lib/tableSession';"), 'the Floor imports the lib');
assert.ok(floor.includes('liveWindowsOf,') && floor.includes('sessionState,') && floor.includes('SESSION_TONE,') && floor.includes('youngestLiveMs,'),
  'the whole clock family arrives through one import');
assert.ok(!floor.includes('function sessionState(') && !floor.includes('type SessionState') && !floor.includes('const SESSION_TONE'),
  'the Floor keeps NO local copy');
assert.ok(floor.includes('const youngest = youngestLiveMs(liveWindowsOf(sessions, t.id, nowTick), nowTick);'),
  'the pill composes per-table through the lib');
ok('the Floor imports the ONE body and composes per-table through it');

/* ── 3. The Dashboard — the read, the silence, the slot ── */

const dash = strip('../src/components/dashboard/DashboardScreen.tsx');

assert.ok(dash.includes('sessions: TableSession[] | null;'), 'NeedsState carries the nullable read');
assert.ok(dash.includes('await fetchTableSessions(tenantId).catch(() => null);'),
  'the read is individually fail-soft — a failed session read never quiets the tiles');
assert.ok(dash.includes('const liveQr = now.sessions ? liveWindows(now.sessions, nowMs) : [];'),
  'null renders no state at all; an array is the honest state');
assert.ok(dash.includes("} from '../../lib/tableSession';"), 'the Dashboard imports the SAME lib body');
assert.ok(!dash.includes('function sessionState('), 'no local liveness copy on the Dashboard either');
ok('the read lands nullable, fail-soft, through the ONE lib');

assert.ok(dash.includes('if (liveQr.length > 0)'), 'zero live windows is NOT a slot — the all-clear owns a quiet board');
assert.ok(!dash.includes('formatWindowLeft'), 'the Dashboard speaks NO stopwatch — a 30s loop cannot own seconds');
/* 5.221.0 — the hint still names the STATE, and now names the dying
   window's own table (the band holds the tables, so WHERE is free). */
assert.ok(dash.includes('a menu window is inside its last three minutes'),
  'the warm hint names the STATE');
assert.ok(dash.includes("youngestQrTable ? ` on ${youngestQrTable}` : ''"),
  'the warm hint names the dying window\'s own table');
assert.ok(dash.includes('the youngest is inside its last three minutes'),
  'the aria names the closing state in full words');
assert.ok(dash.includes("qrWarm ? 'bg-[#FBF3E4] text-[#8A5A16]' : 'bg-[#EAF2F7] text-[#1D5D7E]'"),
  'warm speaks the ribbon\'s amber on the slot\'s chip');
assert.ok(dash.includes("valueTone: qrWarm ? 'text-[#8A5A16]' : 'text-[#0F3D3E]'"),
  'the value ink agrees with the chip\'s mood');
ok('the slot speaks states, never a frozen countdown');

assert.ok(dash.includes("label: 'QR menus',"), 'the slot is labeled');
assert.ok(dash.includes("onOpen: () => go('floor', ['Dashboard', 'Floor'])"), 'the door opens the Floor');
assert.ok(dash.includes('`Open Floor — ${liveQr.length} live QR'), 'the door\'s aria names the count');
ok('the slot\'s door follows the truth (the 5.89 doctrine)');

const dashIntervals = dash.split('window.setInterval(').length - 1;
assert.equal(dashIntervals, 1, `exactly ONE interval in the Dashboard (the 30s loop the slot rides) — found ${dashIntervals}`);
ok('no new timer — the slot rides the loop the Dashboard already runs');

console.log(`\nunit259 — ${n} checks green (the QR channel reaches the dashboard)`);
