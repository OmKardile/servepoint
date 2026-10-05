/**
 * unit283 — v5.244.0 "the board answers to the whole book".
 *
 * The round's laws, pinned:
 *   1. ONE ENGINE, TWO REGISTERS — api.ts's fetchOffTodayCount
 *      (tenantId, statuses, nowMs?) is the off-today census's single
 *      server mouth: `.in('status', [...statuses])` over the SAME
 *      offTodayBoundsIso disjunction, head:true count:'exact', no
 *      limit, THROWS on error. The 5.243 news name
 *      (fetchStaleNewCount) is extinct from the code — the population
 *      is the argument now.
 *   2. THE RAIL VOCABULARY — KitchenScreen exports RAIL_STATUSES
 *      ('pending','preparing','ready') and isOnRail asks THE ARRAY:
 *      one set, two mouths (the predicate for components, the array
 *      for the server read) — the 5.196 law extended to the DB's ear;
 *      byte-equal behavior over the status universe.
 *   3. THE BOARD'S WIRING — the Dashboard's Promise.all fetches the
 *      rail census with RAIL_STATUSES (individually fail-soft);
 *      NeedsState carries staleRailCount (number | null); the spoken
 *      number is now.staleRailCount ?? staleKitchen.length; the aria,
 *      hint, door and icon speak staleKitchenN.
 *   4. ONE WORD AT ANY SCALE (behavior) — the server disjunction ≡ the
 *      client rail census (status in the rail set ∧ NOT the app's day)
 *      over the day-boundary matrix AND the status universe: the rail
 *      stages count, 'new'/'completed'/'cancelled' never do, the
 *      future-dated row counts in both mouths.
 *   5. FAIL-SOFT HONESTY — the rail count's own .catch(() => null)
 *      byte; the ?? dims to the page census, never a silent zero.
 *   6. THE ICON WARMING — the kitchen tile warms amber while stuck
 *      board tickets hold, even with today's queue live (the 5.243
 *      inbox tile's sibling — one amber language, both registers).
 *   7. THE NEWS REGISTERS HELD — the counter band's bytes are
 *      unit280/282's (the re-anchored pins stand); the news call
 *      sites speak ['new'] on the ONE engine.
 *   8. THE VERSION LAW in the agreement shape.
 *
 * Run: bunx vite-node scripts/unit283.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);
const strip = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

/* ── the live word — behavior, not bytes ── */
const { isOnRail } = await import('/src/components/kitchen/KitchenScreen.tsx');
const { staleNewTickets, isSameAppDayAs, offTodayBoundsIso } = await import('/src/lib/appday.ts');

const api = strip('../src/lib/api.ts');
const kitchen = strip('../src/components/kitchen/KitchenScreen.tsx');
const dash = strip('../src/components/dashboard/DashboardScreen.tsx');
const inbox = strip('../src/components/food/CounterInbox.tsx');
const versionTs = strip('../src/version.ts');
const swJs = strip('../public/sw.js');

/* 1 — the ONE engine: population as the argument, the census's verdict. */
{
  const fn = api.slice(
    api.indexOf('export async function fetchOffTodayCount'),
    api.indexOf('v5.82.0 — one ticket by id'),
  );
  assert.ok(fn.includes('statuses: readonly string[]'), 'the population is the argument');
  assert.ok(fn.includes(".select('id', { count: 'exact', head: true })"), 'a count read: head:true, exact');
  assert.ok(fn.includes(".in('status', [...statuses])"), 'the rail set spoken server-side');
  assert.ok(fn.includes('offTodayBoundsIso(nowMs)'), 'the SAME disjunction bounds the news census speaks');
  assert.ok(!fn.includes('.limit('), 'uncapped — the whole book');
  assert.ok(fn.includes('if (error) throw error;'), 'THROWS on error — the caller owns the dimming');
  assert.equal((api.match(/function fetchStaleNewCount/g) || []).length, 0, 'one engine, no second name');
  ok('the ONE engine: the population is the argument, uncapped, throws on error');
}

/* 2 — the rail vocabulary: one set, two mouths. */
{
  assert.match(kitchen, /export const RAIL_STATUSES = \['pending', 'preparing', 'ready'\] as const;/, 'the array exists, exported');
  const pred = kitchen.slice(kitchen.indexOf('export function isOnRail'), kitchen.indexOf('/** v5.228.0'));
  assert.match(pred, /RAIL_STATUSES as readonly string\[\]\)\.includes\(s\)/, 'the predicate asks THE ARRAY — no fork');
  /* byte-equal behavior over the status universe */
  assert.equal(isOnRail('pending'), true);
  assert.equal(isOnRail('preparing'), true);
  assert.equal(isOnRail('ready'), true);
  assert.equal(isOnRail('new'), false);
  assert.equal(isOnRail('completed'), false);
  assert.equal(isOnRail('cancelled'), false);
  assert.equal(isOnRail(''), false);
  assert.equal(isOnRail('PENDING'), true, 'case-insensitive as ever');
  ok('the rail vocabulary: the array and the predicate are one set');
}

/* 3 — the board's wiring: same load cycle, same dimming, its own voice. */
{
  assert.match(dash, /staleRailCount: number \| null;/, 'NeedsState carries the nullable rail count');
  assert.match(dash, /fetchOffTodayCount\(tenantId, RAIL_STATUSES\)\.catch\(\(\) => null\),/, 'the rail census rides the Promise.all, fail-soft');
  assert.match(dash, /setNow\(\{ ready: true, orders, inventory, menu, reservations, tables, paidSums, sessions, staleNewCount, staleRailCount, loadedAt: Date\.now\(\) \}\)/, 'the state lands whole');
  assert.match(dash, /const staleKitchenN = now\.staleRailCount \?\? staleKitchen\.length;/, 'the ?? dims to the page census');
  const speaks = (dash.match(/staleKitchenN/g) || []).length;
  assert.ok(speaks >= 6, `the aria, hint, door and icon all speak staleKitchenN (${speaks} sites)`);
  ok("the board's wiring: one load cycle, the whole-book word, its own voice");
}

/* 4 — ONE word at any scale: the rail census, both mouths, any status. */
{
  const NOW = Date.UTC(2026, 9, 5, 6, 30); // noon IST, 5 Oct 2026
  const { startIso, endIso } = offTodayBoundsIso(NOW);
  const ms = (iso) => new Date(iso).getTime();
  const serverOffToday = (iso) => iso < startIso || iso >= endIso;
  /* the client rail census, mirrored: isOnRail ∧ NOT the app's day
     (the page census staleOlder.filter(isOnRail) — status 'pending'
     stands in for the rail set; the predicate equality is unit check 2). */
  const clientRailStale = (status, iso) => isOnRail(status) && !isSameAppDayAs(iso, NOW);
  const matrix = [
    ['start−1ms', new Date(ms(startIso) - 1).toISOString()],
    ['start', startIso],
    ['end−1ms', new Date(ms(endIso) - 1).toISOString()],
    ['end', endIso],
  ];
  for (const [name, iso] of matrix) {
    assert.equal(serverOffToday(iso), clientRailStale('pending', iso), `rail verdict at ${name}: server ≡ client`);
  }
  /* the status universe: the rail stages count, everything else never does */
  for (const s of ['pending', 'preparing', 'ready']) {
    assert.ok(clientRailStale(s, new Date(ms(startIso) - 1).toISOString()), `rail stage ${s} counts off-today`);
  }
  for (const s of ['new', 'completed', 'cancelled']) {
    assert.equal(isOnRail(s), false, `non-rail ${s} never rides the board census`);
  }
  /* the future-dated row: off-today in both mouths (no quiet forgiveness) */
  const future = new Date(ms(endIso) + 3600_000).toISOString();
  assert.equal(serverOffToday(future), true);
  assert.equal(clientRailStale('pending', future), true);
  ok('the rail census: boundary matrix + status universe + future row, one word');
}

/* 5 — fail-soft honesty: the rail catch byte, the news catch bytes. */
{
  assert.equal((dash.match(/fetchOffTodayCount\(tenantId, RAIL_STATUSES\)\.catch\(\(\) => null\)/g) || []).length, 1, 'the rail register dims on its own');
  assert.equal((dash.match(/fetchOffTodayCount\(tenantId, \['new'\]\)\.catch\(\(\) => null\)/g) || []).length, 1, 'the news register dims on its own');
  ok('fail-soft: a failed rail count dims to the page census, never a silent zero');
}

/* 6 — the icon warming: the kitchen tile warms with the inbox tile's. */
{
  assert.match(
    dash,
    /iconTone: inKitchen\.length > 0\s*\? staleKitchenN > 0\s*\? 'bg-\[#FBF3E4\] text-\[#8A5A16\]'/,
    'the tile warms even with today’s queue live — the 5.243 sibling',
  );
  ok('the icon warming: one amber language, both registers');
}

/* 7 — the news registers held: the band's bytes, the ['new'] call sites. */
{
  assert.match(inbox, /const stragglerN = staleCount \?\? stragglers\.length;/, "the counter's word unchanged");
  assert.match(dash, /const staleNewN = now\.staleNewCount \?\? staleNew\.length;/, "the whisper's word unchanged");
  assert.equal((dash.match(/fetchOffTodayCount\(tenantId, \['new'\]\)/g) || []).length, 1, 'the Dashboard speaks the news population on the ONE engine');
  ok('the news registers held while the rail register joined');
}

/* 8 — the version law in the agreement shape. */
{
  const v = versionTs.match(/APP_VERSION = '([\d.]+)'/)?.[1];
  const sw = swJs.match(/const VERSION = "servepoint-v([\d.]+)-r1"/)?.[1];
  assert.ok(v, 'version.ts speaks a word');
  assert.equal(v, sw, 'version.ts and sw.js agree');
  ok(`the version law: ${v} agreed on both homes`);
}

console.log(`\nunit283: ${n} checks green`);
