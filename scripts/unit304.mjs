/* unit304 — v5.265.0 "the last sleeper wakes" (agreement shape)
 * The census finding: after the wake family (300 guest track, 301 kitchen/
 * counter/floor, 302 the six sleepers + the needs strip), TEN surfaces
 * carried a visibilitychange listener — and ReportsScreen, the owner's
 * retrospective heart (sales, items, hours, ledger, hops over a real
 * range), was the one data surface still blind to the return: it read on
 * mount and on range change, then trusted whatever it had while its owner
 * tabbed away and back.
 * THE LAWS PINNED HERE:
 *   1. the wake exists and is guarded: visibilitychange → visible-only →
 *      void load();
 *   2. THE ONE-PATH LAW: the wake rides load — the SAME function the mount
 *      effect and the refresh button ride. No fetch* in the wake's body,
 *      no second road;
 *   3. the cleanup is pinned: the listener leaves with the effect;
 *   4. the rhythm stands by STANDING STILL: reports keeps NO poll — the
 *      wake adds a beat to a page that reads on arrival, never a timer;
 *      and the ledger + hop riders still key on refreshedAt (the wake
 *      moves the stamp, so the riders follow for free);
 *   5. the receipt is the family's: caughtUpAt keyed by the instant (a
 *      second wake re-raises rather than replaces), spFadeIn 0.35s, a 4s
 *      self-clear WITH cleanup, the house clock (appFormatters hhmm) —
 *      a receipt, not a resident;
 *   6. the word about itself speaks the house clock and the wake's truth:
 *      "Refreshed HH:MM — and the moment you look back" — and the device-
 *      locale toLocaleTimeString is GONE from reports;
 *   7. the family stands: all ten earlier wake surfaces still carry their
 *      visibilitychange (no regression in the wake of the wake);
 *   8. the version law: APP_VERSION and sw.js's VERSION agree (read the
 *      live words, never pin a stale one). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reports = readFileSync('/home/z/my-project/src/components/reports/ReportsScreen.tsx', 'utf8');
const versionTs = readFileSync('/home/z/my-project/src/version.ts', 'utf8');
const swJs = readFileSync('/home/z/my-project/public/sw.js', 'utf8');

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ok ${passed} — ${name}`);
};

/* ── 1. the wake, guarded ─────────────────────────────────────────────── */
check('the wake exists and is guarded: visible-only, then load', () => {
  assert.ok(reports.includes("document.addEventListener('visibilitychange', wake);"), 'the listener is added');
  const wake = reports.match(/const wake = useCallback\(\(\) => \{[\s\S]*?\}, \[load\]\);/);
  assert.ok(wake, 'the wake is a useCallback keyed on load');
  assert.ok(wake[0].includes("document.visibilityState !== 'visible'") && wake[0].includes('return;'), 'it guards on visible');
  assert.ok(wake[0].includes('void load()'), 'it rides load');
  assert.ok(wake[0].includes('setCaughtUpAt(Date.now())'), 'it stamps the receipt');
});

/* ── 2. the one-path law ──────────────────────────────────────────────── */
check('ONE-PATH: the wake, the mount and the refresh button ride the same load', () => {
  const wake = reports.match(/const wake = useCallback\(\(\) => \{[\s\S]*?\}, \[load\]\);/)[0];
  assert.ok(!/\bfetch[A-Z]/.test(wake), 'no fetch* call in the wake body — no second road');
  assert.ok(reports.match(/useEffect\(\(\) => \{\s*\n\s*setLoading\(true\);\s*\n\s*void load\(\);\s*\n\s*\}, \[tenantId, load\]\);/), 'the mount effect rides load');
  const retry = reports.match(/const retry = useCallback\(\(\) => \{[\s\S]*?\}, \[load\]\);/);
  assert.ok(retry && retry[0].includes('void load();'), 'the refresh button rides load');
  assert.ok(reports.match(/const load = useCallback\(async \(\) => \{/), 'load is THE one path');
});

/* ── 3. the cleanup is pinned ─────────────────────────────────────────── */
check('the wake cleans up after itself', () => {
  assert.ok(
    reports.match(/document\.addEventListener\('visibilitychange', wake\);\s*\n\s*return \(\) => document\.removeEventListener\('visibilitychange', wake\);/),
    'removeEventListener pinned in the effect return'
  );
  assert.ok(reports.match(/const t = window\.setTimeout\(\(\) => setCaughtUpAt\(null\), 4000\);\s*\n\s*return \(\) => window\.clearTimeout\(t\);/), 'the 4s self-clear cleans up');
});

/* ── 4. the rhythm stands by standing still ───────────────────────────── */
check('reports keeps NO poll — the wake adds a beat, never a timer', () => {
  assert.ok(!reports.includes('setInterval'), 'no setInterval anywhere in reports');
  const ledgerRider = reports.match(/fetchPaymentsInRange\([\s\S]*?\}, \[tenantId, range, refreshedAt, customWindow\]\);/);
  assert.ok(ledgerRider, 'the ledger rider still keys on refreshedAt');
  const hopsRider = reports.match(/fetchStatusHopsInRange\([\s\S]*?\}, \[tenantId, range, refreshedAt, customWindow\]\);/);
  assert.ok(hopsRider, 'the hop rider still keys on refreshedAt');
});

/* ── 5. the receipt, in the family's words ────────────────────────────── */
check('the receipt is the family shape: keyed, spFadeIn, 4s, the house clock', () => {
  assert.ok(reports.match(/\{\s*caughtUpAt !== null && \(/), 'the chip renders when the wake lands');
  assert.ok(reports.match(/key=\{caughtUpAt\}/), 'keyed by the instant — a second wake re-raises');
  assert.ok(reports.includes("style={{ animation: 'spFadeIn 0.35s ease' }}"), 'the family fade');
  assert.ok(reports.includes('Caught up · {appFormatters().hhmm.format(new Date(caughtUpAt))}'), 'the house clock in the chip');
  assert.ok(reports.includes('the read rode the same path the refresh button rides'), 'the one-path word in the title');
});

/* ── 6. the word about itself speaks the house clock ──────────────────── */
check('the refresh title: the house clock and the wake truth; device locale gone', () => {
  assert.ok(reports.includes('`Refreshed ${appFormatters().hhmm.format(refreshedAt)} — and the moment you look back`'), 'the word grows the wake truth');
  assert.ok(!reports.includes('toLocaleTimeString'), 'the device-locale render is GONE from reports');
});

/* ── 7. the family stands ─────────────────────────────────────────────── */
check('the ten earlier wake surfaces still carry their visibilitychange', () => {
  const family = [
    'src/components/guest/GuestPages.tsx',
    'src/components/kitchen/KitchenScreen.tsx',
    'src/components/food/CounterInbox.tsx',
    'src/components/floor/FloorScreen.tsx',
    'src/components/messages/MessagesScreen.tsx',
    'src/components/notifications/NotificationsScreen.tsx',
    'src/components/inventory/InventoryScreen.tsx',
    'src/components/customers/CustomersScreen.tsx',
    'src/components/dashboard/DashboardScreen.tsx',
    'src/components/eod/EodScreen.tsx',
  ];
  for (const f of family) {
    const src = readFileSync(`/home/z/my-project/${f}`, 'utf8');
    assert.ok(src.includes('visibilitychange'), `still awake: ${f}`);
  }
});

/* ── 8. the version law (agreement shape) ─────────────────────────────── */
check('the version law: APP_VERSION and sw.js agree', () => {
  const v = versionTs.match(/APP_VERSION = '([^']+)'/)?.[1] ?? '';
  assert.ok(v.length > 0, 'APP_VERSION is present');
  assert.ok(swJs.includes(`const VERSION = "servepoint-v${v}-r1";`), `sw.js carries the same word (${v})`);
});

console.log(`\nunit304 — PASS ${passed}/${passed} (all checks green)`);
