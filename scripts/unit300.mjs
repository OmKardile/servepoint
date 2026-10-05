/* unit300 — v5.261.0 "the pager wakes when the guest does" (agreement shape)
 * The walk's finding: the ticket page's 10s poll loop and the menu page's 30s
 * session verify were interval-only. Mobile browsers throttle background tab
 * timers (clamp to 1/min, pause outright under pressure), so a guest who
 * locked their phone while waiting returned to a STALE page — the stepper
 * still saying "placed" while the kitchen called ready, the chime late or
 * never, armed menu buttons in front of a cut session. The fix: visibility
 * (and, on the ticket page, network-online) wakes the page — an immediate
 * tick the moment the guest looks. THE LAWS PINNED HERE:
 *   1. the ticket page listens for visibilitychange AND online, each wake
 *      guarded on visible;
 *   2. ONE busy gate shared by loop and wake — the chime's prev guard is
 *      read exactly once per status change (no double ring);
 *   3. the wake rides the SAME tick() — no separate chime path was added
 *      (the only twoToneChime call sites remain the tick and the mute
 *      button);
 *   4. the listeners are removed on cleanup (no ghost wakes after unmount);
 *   5. the menu page's verify wakes on visibility too (the window's word
 *      re-lands within one beat; the 1s countdown self-corrects from the
 *      anchor);
 *   6. the stepper's hint remounts on status change (key) — the wake's
 *      catch-up RISES, not swaps (the change is seen, not just read);
 *   7. the countdown and the cadence are untouched (10s loop, 30s verify,
 *      1s tick — the wake adds a beat, never replaces the rhythm);
 *   8. the version law: APP_VERSION and sw.js's VERSION agree (the
 *      agreement shape — read the live words, never pin a stale one). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const FILE = '/home/z/my-project/src/components/guest/GuestPages.tsx';
const src = readFileSync(FILE, 'utf8');
const versionTs = readFileSync('/home/z/my-project/src/version.ts', 'utf8');
const swJs = readFileSync('/home/z/my-project/public/sw.js', 'utf8');

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ok ${passed} — ${name}`);
};

/* ── regions ──────────────────────────────────────────────────────────── */
// The ticket page's poll effect: from "let alive = true" (the only poll
// effect with a 10000 chain) through its cleanup.
const pollStart = src.indexOf('const loop = () => {\n      if (!alive) return;\n      void runTick()');
assert.ok(pollStart > 0, 'poll effect region found (runTick loop)');
const pollRegion = src.slice(src.lastIndexOf('useEffect(() => {', pollStart), pollStart + 2200);

// The menu page's session-verify effect: the 30000 interval.
const verifyIv = src.indexOf('window.setInterval(verify, 30000)');
assert.ok(verifyIv > 0, 'menu verify interval found');
const menuRegion = src.slice(src.lastIndexOf('useEffect(() => {', verifyIv), verifyIv + 900);

/* 1 — the ticket page wakes on visibility AND network, guarded on visible */
check('ticket page: visibilitychange + online wakes, visible-guarded', () => {
  assert.ok(
    pollRegion.includes("document.addEventListener('visibilitychange', wake);"),
    'visibilitychange listener on the ticket page',
  );
  assert.ok(pollRegion.includes("window.addEventListener('online', wake);"), 'online listener on the ticket page');
  assert.ok(pollRegion.includes("if (document.visibilityState !== 'visible') return;"), 'wake guarded on visible');
});

/* 2 — ONE busy gate shared by loop and wake (no double ring) */
check('one busy gate — the chime reads prev exactly once per change', () => {
  assert.ok(pollRegion.includes('let busy = false;'), 'shared busy flag');
  assert.ok(pollRegion.includes('if (!alive || busy) return Promise.resolve();'), 'runTick gated on busy');
  assert.ok(
    pollRegion.includes('void runTick();') && pollRegion.includes('void runTick().finally('),
    'loop and wake both ride runTick',
  );
  // the loop still chains AFTER the tick completes (cadence kept)
  assert.ok(pollRegion.includes('window.setTimeout(loop, 10000)'), '10s cadence kept');
});

/* 3 — the wake rides the SAME tick; no new chime path */
check('wake rides the same tick — no separate chime call added', () => {
  const calls = [...src.matchAll(/twoToneChime\(\);/g)].length; // call sites only (the definition reads `(): void`)
  assert.equal(calls, 2, 'exactly two chime call sites (tick + mute button)');
  const wakeEnd = src.indexOf("window.addEventListener('online', wake);");
  const wakeBlock = src.slice(pollStart, wakeEnd);
  assert.ok(!wakeBlock.includes('twoToneChime'), 'wake block adds no chime of its own');
});

/* 4 — cleanup removes both listeners */
check('cleanup removes the wake listeners (no ghost wakes)', () => {
  assert.ok(
    pollRegion.includes("document.removeEventListener('visibilitychange', wake);"),
    'visibilitychange removed',
  );
  assert.ok(pollRegion.includes("window.removeEventListener('online', wake);"), 'online removed');
});

/* 5 — the menu page's verify wakes on visibility */
check('menu page: the window verify wakes on visibility, visible-guarded', () => {
  assert.ok(
    menuRegion.includes("document.addEventListener('visibilitychange', wake);"),
    'visibilitychange listener on the menu verify',
  );
  assert.ok(menuRegion.includes("if (document.visibilityState !== 'visible') return;"), 'guarded on visible');
  assert.ok(
    menuRegion.includes("document.removeEventListener('visibilitychange', wake);"),
    'cleaned up',
  );
  // the interval keeps its 30s word — the wake ADDS a beat
  assert.ok(menuRegion.includes('window.setInterval(verify, 30000)'), '30s cadence kept');
});

/* 6 — the stepper's hint remounts on status change (the change is SEEN) */
check('stepper hint keyed replay — the catch-up rises, not swaps', () => {
  const hintAt = src.indexOf('key={order.status}');
  assert.ok(hintAt > 0, 'keyed hint found');
  const hintBlock = src.slice(hintAt, hintAt + 320);
  assert.ok(hintBlock.includes('spFadeIn 240ms ease-out both'), 'the file\'s own rise animation');
  assert.ok(hintBlock.includes("t('flowServedPaidHint')"), 'the paid word rides the same line (5.252 law intact)');
});

/* 7 — the rhythms are untouched (the wake adds a beat, never a replacement) */
check('the rhythms stand: 1s countdown, 10s poll, 30s verify', () => {
  assert.ok(src.includes('setMsLeft(windowLeft(sessionToken, serverAnchor)), 1000)'), '1s countdown intact');
  assert.ok(src.includes('window.setTimeout(loop, 10000)'), '10s poll intact');
  assert.ok(src.includes('window.setInterval(verify, 30000)'), '30s verify intact');
});

/* 8 — the version law (agreement shape, unit290's re-anchor) */
check('version law — version.ts and sw.js agree on the live word', () => {
  const v = versionTs.match(/APP_VERSION = '([^']+)'/)?.[1] ?? '';
  assert.ok(v.length > 0, 'APP_VERSION is present');
  assert.ok(swJs.includes(`const VERSION = "servepoint-v${v}-r1";`), `sw.js carries the same word (${v})`);
});

/* 9 — the page's word about itself speaks the wake (the honesty law) */
check('the freshness word speaks the wake in all three dicts', () => {
  const i18n = readFileSync('/home/z/my-project/src/lib/guest-i18n.ts', 'utf8');
  assert.ok(i18n.includes("autoUpdate: 'This page updates itself every 10 seconds — and the moment you come back.'"), 'en');
  assert.ok(i18n.includes('autoUpdate: \'यह पेज हर 10 सेकंड में अपने आप अपडेट होता है — और आपके लौटते ही भी।\','), 'hi');
  assert.ok(i18n.includes('autoUpdate: \'ಈ ಪುಟ ಪ್ರತಿ 10 ಸೆಕೆಂಡುಗಳಲ್ಲಿ ಸ್ವಯಂ ಅಪ್ಡೇಟ್ ಆಗುತ್ತದೆ — ಮತ್ತು ನೀವು ಹಿಂತಿರುಗಿದ ಕ್ಷಣವೇ.\','), 'kn');
});

console.log(`\nunit300: PASS (${passed} checks)`);
