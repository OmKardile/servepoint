/* unit301 — v5.262.0 "the boards wake when the staff does" (agreement shape)
 * The walk's finding: unit301's census showed the whole repo had exactly ONE
 * visibilitychange listener — the guest pages' (5.261). Every STAFF board
 * was interval-only: realtime + a 30s safety poll. Mobile browsers throttle
 * background timers (clamp to 1/min, pause outright under pressure) and the
 * realtime socket can die silently under the same pressure — so the kitchen
 * tablet that sleeps between tickets wakes to a rail up to 30s stale, the
 * counter to a stale queue, the floor to a stale room. THE FIX — the wake,
 * second verse: the three operational boards wake when the staff does.
 * THE LAWS PINNED HERE:
 *   1. the kitchen listens for visibilitychange AND online, each wake
 *      guarded on visible (a missed ticket is a missed dish — the kitchen
 *      carries the network's wake too);
 *   2. the counter and the floor each listen for visibilitychange (the
 *      moment they look), guarded on visible;
 *   3. THE ONE-PATH LAW: each wake rides the board's own single data path
 *      (kitchen → refetch, counter → load, floor → reload) — the same road
 *      the realtime pings and the 30s polls ride; no second fetch path
 *      exists (the wake handler bodies name the same callback, and no
 *      fetch* import or call was added to any wake);
 *   4. every listener is removed on cleanup (no ghost wakes after unmount);
 *   5. the rhythms stand untouched — the 30s polls and the realtime
 *      subscriptions keep their bytes; the wake adds a beat, never
 *      replaces the rhythm;
 *   6. THE CAUGHT-UP WHISPER: the kitchen's wake raises a receipt chip
 *      (keyed by the instant — a second wake re-rises, not swaps), styled
 *      with the house's own spFadeIn rise, auto-cleared after 4s by a
 *      timer whose cleanup is pinned (a receipt, not a resident);
 *   7. THE WORD ABOUT THEMSELVES STAYS TRUE: the offline titles/chip hint
 *      now complete the rhythm — "refreshing every 30 seconds, and the
 *      moment you look back" (kitchen title, counter badge title, floor
 *      LiveChip hint) — the wake made the bare 30s word incomplete;
 *   8. the version law: APP_VERSION and sw.js's VERSION agree (the
 *      agreement shape — read the live words, never pin a stale one). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const kitchen = readFileSync('/home/z/my-project/src/components/kitchen/KitchenScreen.tsx', 'utf8');
const counter = readFileSync('/home/z/my-project/src/components/food/CounterInbox.tsx', 'utf8');
const floor = readFileSync('/home/z/my-project/src/components/floor/FloorScreen.tsx', 'utf8');
const versionTs = readFileSync('/home/z/my-project/src/version.ts', 'utf8');
const swJs = readFileSync('/home/z/my-project/public/sw.js', 'utf8');

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ok ${passed} — ${name}`);
};

/* ── 1. the kitchen's wake: both listeners, the visible guard ─────────── */
check('kitchen: visibilitychange + online listeners exist in the data effect', () => {
  assert.ok(kitchen.includes("document.addEventListener('visibilitychange', wake);"), 'visibilitychange listener');
  assert.ok(kitchen.includes("window.addEventListener('online', wake);"), 'online listener');
});
check('kitchen: the wake is guarded on visible (hide fires nothing)', () => {
  const m = kitchen.match(/const wake = \(\) => \{\s*\n\s*if \(document\.visibilityState !== 'visible'\) return;/);
  assert.ok(m, 'the guard rides the kitchen wake');
});

/* ── 2+3. the one-path law: each wake rides the board's own callback ──── */
check('kitchen: the wake rides refetch — the ONE path', () => {
  const m = kitchen.match(/const wake = \(\) => \{[\s\S]*?void refetch\(\)/);
  assert.ok(m, 'the wake calls refetch');
});
check('counter: the wake rides load — guarded, the ONE path', () => {
  assert.ok(counter.includes("document.addEventListener('visibilitychange', wake);"), 'listener');
  const m = counter.match(/const wake = \(\) => \{\s*\n\s*if \(document\.visibilityState !== 'visible'\) return;\s*\n\s*void load\(\);/);
  assert.ok(m, 'guarded + rides load');
});
check('floor: the wake rides reload — guarded, the ONE path', () => {
  assert.ok(floor.includes("document.addEventListener('visibilitychange', wake);"), 'listener');
  const m = floor.match(/const wake = \(\) => \{\s*\n\s*if \(document\.visibilityState !== 'visible'\) return;\s*\n\s*void reload\(\);/);
  assert.ok(m, 'guarded + rides reload');
});
check('no second fetch path: no wake body names a fetch import', () => {
  for (const [name, src] of [['kitchen', kitchen], ['counter', counter], ['floor', floor]]) {
    const wakeBody = src.match(/const wake = \(\) => \{[\s\S]*?\};/);
    assert.ok(wakeBody, `${name} wake exists`);
    assert.ok(!/fetch[A-Z]/.test(wakeBody[0]), `${name} wake names no fetch* call of its own`);
  }
});

/* ── 4. cleanup: no ghost wakes ───────────────────────────────────────── */
check('cleanup: every wake listener is removed on unmount', () => {
  assert.ok(kitchen.includes("document.removeEventListener('visibilitychange', wake);"), 'kitchen visibility');
  assert.ok(kitchen.includes("window.removeEventListener('online', wake);"), 'kitchen online');
  assert.ok(counter.includes("document.removeEventListener('visibilitychange', wake);"), 'counter visibility');
  assert.ok(floor.includes("document.removeEventListener('visibilitychange', wake);"), 'floor visibility');
});

/* ── 5. the rhythms stand: polls and subscriptions keep their bytes ───── */
check('the rhythms stand: 30s polls + realtime subscriptions untouched', () => {
  assert.ok(kitchen.includes('window.setInterval(() => void refetch(), 30_000)'), 'kitchen poll');
  assert.ok(kitchen.includes('subscribeOrdersRealtime(tenantId, scheduleRefetch, setRtState)'), 'kitchen realtime');
  assert.ok(counter.includes('window.setInterval(() => void load(), 30_000)'), 'counter poll');
  assert.ok(counter.includes('subscribeOrdersRealtime(tenantId, () => void load(), setRt)'), 'counter realtime');
  assert.ok(floor.includes('window.setInterval(() => void reload(), 30000)'), 'floor poll');
  assert.ok(floor.includes('subscribeTablesRealtime(tenantId, ping, setRtState)'), 'floor tables realtime');
  assert.ok(floor.includes('subscribeReservationsRealtime(tenantId, ping, setRtState)'), 'floor book realtime');
});

/* ── 6. the caught-up whisper: receipt, not resident ──────────────────── */
check('kitchen: the caught-up whisper is keyed by the instant', () => {
  assert.ok(kitchen.includes('const [caughtUpAt, setCaughtUpAt] = useState<number | null>(null);'), 'state');
  const m = kitchen.match(/key=\{caughtUpAt\}/);
  assert.ok(m, 'keyed remount — a second wake re-rises');
});
check('kitchen: the whisper rides the house spFadeIn rise', () => {
  assert.ok(kitchen.includes("style={{ animation: 'spFadeIn 0.35s ease' }}"), 'the house animation');
});
check('kitchen: the whisper clears after 4s, cleanup pinned', () => {
  assert.ok(kitchen.includes('window.setTimeout(() => setCaughtUpAt(null), 4000)'), 'the 4s clear');
  const m = kitchen.match(/useEffect\(\(\) => \{\s*\n\s*if \(caughtUpAt === null\) return;\s*\n\s*const t = window\.setTimeout\(\(\) => setCaughtUpAt\(null\), 4000\);\s*\n\s*return \(\) => window\.clearTimeout\(t\);\s*\n\s*\}, \[caughtUpAt\]\)/);
  assert.ok(m, 'timer cleanup pinned');
});
check('kitchen: the whisper names the house clock (hhmm)', () => {
  assert.ok(kitchen.includes('appFormatters().hhmm.format(new Date(caughtUpAt))'), 'the house clock');
});

/* ── 7. the word about themselves stays true ──────────────────────────── */
check('the offline words complete the rhythm in all three boards', () => {
  const word = 'refreshing every 30 seconds, and the moment you look back';
  assert.ok(kitchen.includes(word), 'kitchen title');
  assert.ok(counter.includes(`Realtime offline — polling, and the moment you look back`), 'counter badge title');
  assert.ok(floor.includes(word), 'floor LiveChip hint');
});

/* ── 8. the version law (agreement shape) ─────────────────────────────── */
check('the version law: APP_VERSION and sw.js agree', () => {
  const v = versionTs.match(/APP_VERSION = '([^']+)'/)?.[1] ?? '';
  assert.ok(v.length > 0, 'APP_VERSION is present');
  assert.ok(swJs.includes(`const VERSION = "servepoint-v${v}-r1";`), `sw.js carries the same word (${v})`);
});

console.log(`\nunit301 — PASS ${passed}/${passed} (all checks green)`);
