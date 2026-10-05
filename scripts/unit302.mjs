/* unit302 — v5.263.0 "the whole house wakes" (agreement shape)
 * The walk's finding: 301's census left six interval-only surfaces standing —
 * the four realtime+poll boards (Notifications, Inventory, CRM, Messages)
 * slept the staff board's sleep, and the two interval-only reads (the
 * dashboard's paper mirror, the close-out's 20s heartbeats) had no realtime
 * at all — the owner who comes back to a backgrounded tab reads stale
 * numbers, a stale book, a stale thread, a stale drawer state. THE FIX —
 * the wake family completes: every data surface in the house now wakes the
 * moment its person looks. THE LAWS PINNED HERE:
 *   1. each of the six surfaces listens for visibilitychange, guarded on
 *      visible (hide fires nothing);
 *   2. THE ONE-PATH LAW: each wake rides the surface's own data path
 *      (Notifications/Inventory/CRM → load; Messages → the named
 *      refreshAll; Dashboard → load; EOD → load + loadDrawer, the page's
 *      own TWO paths — the drawer's EXISTENCE is a fact that changes while
 *      away) — no wake body names a fetch* import of its own;
 *   3. THE MESSAGES' TRIPLE IS STRUCTURAL: the realtime ping, the 30s
 *      poll and the wake all call ONE named refreshAll (loadList +
 *      loadThread + loadPeople) — no second path can exist, not by
 *      discipline but by construction;
 *   4. every listener is removed on cleanup (no ghost wakes ×6);
 *   5. the rhythms stand: the 30s polls (×4), the dashboard's
 *      NOW_REFRESH_MS mirror, the close-out's 20s heartbeats and the
 *      realtime subscriptions keep their bytes — the wake adds a beat,
 *      never replaces the rhythm;
 *   6. THE WORD ABOUT THEMSELVES STAYS TRUE: the offline/poll badge words
 *      complete the rhythm — "and the moment you look back" (Notifications
 *      title + aria, CRM title, Messages title + aria, Inventory title);
 *   7. THE PAPER'S FRESHNESS STAMP: the dashboard's strip records
 *      loadedAt (the read's own receipt; NULL until a read lands — the
 *      stamp never claims a read that did not run) and SPEAKS it — "as of
 *      HH:MM" (the house hhmm clock) in BOTH branches (the slots band AND
 *      the quiet all-clear: a stale "nothing waits" is the same bug);
 *   8. the version law: APP_VERSION and sw.js's VERSION agree (the
 *      agreement shape — read the live words, never pin a stale one). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const notif = readFileSync('/home/z/my-project/src/components/notifications/NotificationsScreen.tsx', 'utf8');
const inventory = readFileSync('/home/z/my-project/src/components/inventory/InventoryScreen.tsx', 'utf8');
const crm = readFileSync('/home/z/my-project/src/components/customers/CustomersScreen.tsx', 'utf8');
const messages = readFileSync('/home/z/my-project/src/components/messages/MessagesScreen.tsx', 'utf8');
const dashboard = readFileSync('/home/z/my-project/src/components/dashboard/DashboardScreen.tsx', 'utf8');
const eod = readFileSync('/home/z/my-project/src/components/eod/EodScreen.tsx', 'utf8');
const versionTs = readFileSync('/home/z/my-project/src/version.ts', 'utf8');
const swJs = readFileSync('/home/z/my-project/public/sw.js', 'utf8');

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ok ${passed} — ${name}`);
};

const GUARD = "if (document.visibilityState !== 'visible') return;";
const ADD = "document.addEventListener('visibilitychange', wake);";
const RM = "document.removeEventListener('visibilitychange', wake);";

/* ── 1. the six wakes exist, each guarded on visible ──────────────────── */
check('six surfaces listen for visibilitychange, each guarded on visible', () => {
  for (const [name, src] of [['notifications', notif], ['inventory', inventory], ['crm', crm], ['messages', messages], ['dashboard', dashboard], ['eod', eod]]) {
    assert.ok(src.includes('const wake = () => {'), `${name}: the wake exists`);
    const wakeBody = src.match(/const wake = \(\) => \{[\s\S]*?\};/);
    assert.ok(wakeBody && wakeBody[0].includes(GUARD), `${name}: the visible guard rides the wake`);
  }
});

/* ── 2. the one-path law ──────────────────────────────────────────────── */
check('the one-path law: each wake rides the surface\'s own data path', () => {
  const notifWake = notif.match(/const wake = \(\) => \{[\s\S]*?\};/)[0];
  assert.ok(notifWake.includes('void load();'), 'notifications rides load');
  const invWake = inventory.match(/const wake = \(\) => \{[\s\S]*?\};/)[0];
  assert.ok(invWake.includes('void load();'), 'inventory rides load');
  const crmWake = crm.match(/const wake = \(\) => \{[\s\S]*?\};/)[0];
  assert.ok(crmWake.includes('void load();'), 'crm rides load');
  const msgWake = messages.match(/const wake = \(\) => \{[\s\S]*?\};/)[0];
  assert.ok(msgWake.includes('refreshAll();'), 'messages rides refreshAll');
  const dashWake = dashboard.match(/const wake = \(\) => \{[\s\S]*?\};/)[0];
  assert.ok(dashWake.includes('void load();'), 'dashboard rides load');
  const eodWake = eod.match(/const wake = \(\) => \{[\s\S]*?\};/)[0];
  assert.ok(eodWake.includes('void load();') && eodWake.includes('void loadDrawer();'), 'eod rides BOTH its paths (numbers + drawer)');
});
check('no wake body names a fetch import of its own', () => {
  for (const [name, src] of [['notifications', notif], ['inventory', inventory], ['crm', crm], ['messages', messages], ['dashboard', dashboard], ['eod', eod]]) {
    const wakeBody = src.match(/const wake = \(\) => \{[\s\S]*?\};/)[0];
    assert.ok(!/fetch[A-Z]/.test(wakeBody), `${name} wake names no fetch* call`);
  }
});

/* ── 3. the messages' triple is structural ────────────────────────────── */
check('messages: ONE named refreshAll — realtime, poll and wake all ride it', () => {
  assert.ok(messages.includes('const refreshAll = useCallback(() => {'), 'the named road exists');
  assert.ok(messages.includes('void loadList();\n    void loadThread();\n    void loadPeople();'), 'the triple lives in refreshAll');
  assert.ok(messages.includes('subscribeMessagesRealtime(tenant.tenantId, refreshAll, setRt)'), 'the ping rides it');
  assert.ok(messages.includes('window.setInterval(refreshAll, 30_000)'), 'the poll rides it');
  const tripleCount = (messages.match(/void loadList\(\);\s*\n\s*void loadThread\(\);\s*\n\s*void loadPeople\(\);/g) ?? []).length;
  assert.ok(tripleCount === 1, `the triple appears exactly once (inside refreshAll; found ${tripleCount})`);
});

/* ── 4. cleanup: no ghost wakes ×6 ────────────────────────────────────── */
check('cleanup: every wake listener is removed on unmount', () => {
  for (const [name, src] of [['notifications', notif], ['inventory', inventory], ['crm', crm], ['messages', messages], ['dashboard', dashboard], ['eod', eod]]) {
    assert.ok(src.includes(RM), `${name}: the wake listener is removed`);
    assert.ok(src.includes(ADD), `${name}: the wake listener is added`);
  }
});

/* ── 5. the rhythms stand ─────────────────────────────────────────────── */
check('the rhythms stand: polls and subscriptions keep their bytes', () => {
  assert.ok(notif.includes('window.setInterval(() => void load(), 30_000)'), 'notifications poll');
  assert.ok(notif.includes('subscribeNotificationsRealtime('), 'notifications realtime');
  assert.ok(inventory.includes('window.setInterval(() => void load(), 30_000)'), 'inventory poll');
  assert.ok(inventory.includes('subscribeInventoryRealtime(tenantId, () => void load(), setRt)'), 'inventory realtime');
  assert.ok(crm.includes('window.setInterval(() => void load(), 30_000)'), 'crm poll');
  assert.ok(crm.includes('subscribeCrmRealtime(tenantId, () => void load(), setRt)'), 'crm realtime');
  assert.ok(messages.includes('window.setInterval(refreshAll, 30_000)'), 'messages poll');
  assert.ok(dashboard.includes('window.setInterval(() => void load(), NOW_REFRESH_MS)'), 'dashboard mirror');
  assert.ok(eod.includes('setInterval(() => void loadDrawer(), 20000)'), 'eod drawer heartbeat');
  assert.ok(eod.includes('setInterval(() => void load(), 20000)'), 'eod numbers heartbeat');
});

/* ── 6. the word about themselves stays true ──────────────────────────── */
check('the offline/poll words complete the rhythm across the four boards', () => {
  const tail = 'and the moment you look back';
  assert.ok(notif.includes(`'Polling every 30s, ${tail}'`), 'notifications title');
  assert.ok(notif.includes(`'Polling every 30 seconds, ${tail}'`), 'notifications aria');
  assert.ok(crm.includes(`'Polling every 30s, ${tail}'`), 'crm title');
  assert.ok(messages.includes(`'Polling every 30s, ${tail}'`), 'messages title');
  assert.ok(messages.includes(`'Polling every 30 seconds, ${tail}'`), 'messages aria');
  assert.ok(inventory.includes(`'Realtime offline — polling, ${tail}'`), 'inventory title');
});

/* ── 7. the paper's freshness stamp ───────────────────────────────────── */
check('dashboard: the strip records loadedAt — NULL until a read lands', () => {
  assert.ok(dashboard.includes('loadedAt: number | null;'), 'the field is nullable');
  assert.ok(dashboard.includes('loadedAt: null }'), 'the initial state never claims a read');
  assert.ok(dashboard.includes('loadedAt: Date.now()'), 'the read stamps its landing');
});
check('dashboard: the stamp speaks in BOTH branches (band + quiet all-clear)', () => {
  const stamps = dashboard.match(/as of \{appFormatters\(\)\.hhmm\.format\(new Date\(now\.loadedAt\)\)\}/g) ?? [];
  assert.ok(stamps.length === 2, `both branches speak the stamp (found ${stamps.length})`);
  assert.ok(dashboard.includes("title=\"The moment this strip's numbers landed — every read says when it read\""), 'the title names the receipt');
});
check('dashboard: the stamp names the house clock (hhmm)', () => {
  assert.ok(dashboard.includes("appFormatters().hhmm.format"), 'the house clock');
});

/* ── 8. the version law (agreement shape) ─────────────────────────────── */
check('the version law: APP_VERSION and sw.js agree', () => {
  const v = versionTs.match(/APP_VERSION = '([^']+)'/)?.[1] ?? '';
  assert.ok(v.length > 0, 'APP_VERSION is present');
  assert.ok(swJs.includes(`const VERSION = "servepoint-v${v}-r1";`), `sw.js carries the same word (${v})`);
});

console.log(`\nunit302 — PASS ${passed}/${passed} (all checks green)`);
