/**
 * unit282 — v5.243.0 "the news answers to the whole book".
 *
 * The round's laws, pinned:
 *   1. THE SERVER WORD — api.ts's fetchStaleNewCount head-counts the
 *      stragglers where the rows live: status = 'new' AND NOT the app's
 *      today (the disjunction created_at < startIso OR created_at >=
 *      endIso of offTodayBoundsIso(nowMs)), count:'exact' + head:true,
 *      NO limit — uncapped, and it THROWS on error (the caller owns the
 *      dimming).
 *   2. ONE WORD AT ANY SCALE — the server disjunction and the client
 *      census (staleNewTickets / isSameAppDayAs) agree over the full
 *      day-boundary matrix (behavior, not bytes): start−1ms stale, start
 *      on-today, end−1ms on-today, end stale, noon on-today. Same day
 *      iff the instant sits inside [start, end) — by construction.
 *   3. THE CORRUPT ROW — a future-dated created_at is off-today BOTH
 *      ways (created_at >= endIso server-side; NOT the app's day
 *      client-side) — the census does not quietly forgive it, and the
 *      two mouths say the same word.
 *   4. THE DERIVATION — offTodayBoundsIso(nowMs) ≡
 *      appDayBoundsIso(appTodayIso(tz, new Date(nowMs))); the explicit
 *      clock (228's doctrine); the bounds contain the instant they
 *      answer for.
 *   5. THE DASHBOARD WIRING — NeedsState carries staleNewCount
 *      (number | null); the count rides the SAME Promise.all as the
 *      page it dims to, individually fail-soft; the whisper's number is
 *      now.staleNewCount ?? staleNew.length — the whole book's word,
 *      the page census only on a failed read; aria + hint + door speak
 *      staleNewN.
 *   6. THE COUNTER WIRING — the count rides load()'s Promise.all
 *      (individually fail-soft), setStaleCount lands it, the band's
 *      number is staleCount ?? stragglers.length; the guard, the
 *      caught-up fork and BOTH StragglerLine doors speak stragglerN
 *      (unit280 re-anchored to the same bytes).
 *   7. FAIL-SOFT HONESTY — both rooms' .catch(() => null) bytes; the
 *      ?? dims to the loaded page's own census, never a silent zero.
 *   8. SCOPE — the kitchen's stuck census (staleKitchen, the on-rail
 *      population) rides its own path untouched: the news register's
 *      fossil is this round's, the rail's is named and parked.
 *   9. THE BAND'S VOICE — the StragglerLine keeps ONE text flow (the
 *      <b> count nested inside the ONE span — the 281 blessed shape),
 *      wears the chase amber left rule (#B45309), doors to Bills, and
 *      its title names the whole-ledger read.
 *  10. THE ICON WARMING — the needs-band tile warms to the amber family
 *      while stragglers hold, even with today's queue live.
 *  11. THE CENSUS'S OWN BYTES — staleNewTickets' predicate + sort are
 *      untouched (unit280's law held; only the spoken number moved).
 *  12. THE VERSION LAW in the agreement shape.
 *
 * Run: bunx vite-node scripts/unit282.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);
const strip = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

/* ── the live word — behavior, not bytes ── */
const { staleNewTickets, isSameAppDayAs, offTodayBoundsIso, appDayBoundsIso, appTodayIso, appDayKey } =
  await import('/src/lib/appday.ts');

const api = strip('../src/lib/api.ts');
const lib = strip('../src/lib/appday.ts');
const dash = strip('../src/components/dashboard/DashboardScreen.tsx');
const inbox = strip('../src/components/food/CounterInbox.tsx');
const versionTs = strip('../src/version.ts');
const swJs = strip('../public/sw.js');

/* 1 — the head-count: uncapped, the census's verdict, server-side.
 * Re-anchored honestly (5.244.0): the read is ONE engine now —
 * fetchOffTodayCount, the population as the argument; the news name
 * fetchStaleNewCount is EXTINCT, its population spoken at the call site. */
{
  const fn = api.slice(
    api.indexOf('export async function fetchOffTodayCount'),
    api.indexOf('v5.82.0 — one ticket by id'),
  );
  assert.ok(fn.includes(".select('id', { count: 'exact', head: true })"), 'a count read: head:true, exact');
  assert.ok(fn.includes(".in('status', [...statuses])"), 'the population: the caller’s statuses, server-side');
  assert.ok(fn.includes('.or(`created_at.lt.${startIso},created_at.gte.${endIso}`)'), 'the off-today disjunction');
  assert.ok(!fn.includes('.limit('), 'uncapped — the whole book, no browsing window');
  assert.ok(fn.includes('if (error) throw error;'), 'THROWS on error — the caller owns the dimming');
  assert.equal((api.match(/function fetchStaleNewCount/g) || []).length, 0, 'the 5.243 name is extinct from the CODE — one engine (the doc may tell its lineage)');
  ok('the server word: one engine, the population as the argument, uncapped, throws on error');
}

/* 2 — ONE word at any scale: the disjunction ≡ the client census. */
{
  const NOW = Date.UTC(2026, 9, 5, 6, 30); // noon IST, 5 Oct 2026 — noon-anchored, can't straddle
  const { startIso, endIso } = offTodayBoundsIso(NOW);
  const serverOffToday = (iso) => iso < startIso || iso >= endIso; // the SQL word, mirrored
  const clientOffToday = (iso) => !isSameAppDayAs(iso, NOW);
  const ms = (iso) => new Date(iso).getTime();
  const matrix = [
    ['start−1ms', new Date(ms(startIso) - 1).toISOString(), true],
    ['start', startIso, false],
    ['noon IST', new Date(Date.UTC(2026, 9, 5, 6, 30)).toISOString(), false],
    ['end−1ms', new Date(ms(endIso) - 1).toISOString(), false],
    ['end', endIso, true],
  ];
  for (const [name, iso, wantStale] of matrix) {
    assert.equal(serverOffToday(iso), wantStale, `server verdict at ${name}`);
    assert.equal(clientOffToday(iso), wantStale, `client verdict at ${name}`);
    assert.equal(
      staleNewTickets([{ id: 'x', status: 'new', created_at: iso }], NOW).length,
      wantStale ? 1 : 0,
      `census population at ${name}`,
    );
  }
  ok('the boundary matrix: server ≡ client ≡ census, five instants, one word');
}

/* 3 — the corrupt row: future-dated is off-today both ways. */
{
  const NOW = Date.UTC(2026, 9, 5, 6, 30);
  const { endIso } = offTodayBoundsIso(NOW);
  const future = new Date(new Date(endIso).getTime() + 3600_000).toISOString(); // 1h past today's end
  assert.ok(future >= endIso, 'the future stamp sits past the bound');
  assert.equal(isSameAppDayAs(future, NOW), false, 'client: not the app day');
  assert.equal(staleNewTickets([{ id: 'f', status: 'new', created_at: future }], NOW).length, 1, 'census: counted');
  ok('the future-dated row is off-today in both mouths — no quiet forgiveness');
}

/* 4 — the derivation: bounds of the app-today containing nowMs. */
{
  const NOW = Date.UTC(2026, 9, 5, 6, 30);
  assert.deepEqual(
    offTodayBoundsIso(NOW),
    appDayBoundsIso(appTodayIso('Asia/Kolkata', new Date(NOW))),
    'the bounds ARE the app-today bounds of the clock given',
  );
  const { startIso } = offTodayBoundsIso(NOW);
  assert.equal(
    appDayKey(startIso, 'Asia/Kolkata'),
    appDayKey(new Date(NOW).toISOString(), 'Asia/Kolkata'),
    'the start bound lives inside the instant’s own day',
  );
  ok('the derivation: the explicit clock, the bounds contain their instant');
}

/* 5 — the Dashboard wiring: the whole-book word rides one load cycle.
 * Re-anchored honestly (5.244.0): the news population is spoken at the
 * call site (['new']); the rail register rides the same engine with
 * RAIL_STATUSES (pinned by unit283). */
{
  assert.match(dash, /staleNewCount: number \| null;/, 'NeedsState carries the nullable count');
  assert.match(dash, /fetchOffTodayCount\(tenantId, \['new'\]\)\.catch\(\(\) => null\),/, 'the news count rides the Promise.all, its population spoken');
  assert.match(dash, /setNow\(\{ ready: true, orders, inventory, menu, reservations, tables, paidSums, sessions, staleNewCount, staleRailCount, loadedAt: Date\.now\(\) \}\)/, 'the state lands whole');
  assert.match(dash, /const staleNewN = now\.staleNewCount \?\? staleNew\.length;/, 'the ?? dims to the page census, never a zero');
  const speaks = (dash.match(/staleNewN/g) || []).length;
  assert.ok(speaks >= 6, `the aria, hint, door and icon all speak staleNewN (${speaks} sites)`);
  ok('the Dashboard: one load cycle, the whole-book word, fail-soft dimming');
}

/* 6 — the counter wiring: same cycle, same dimming, both doors.
 * Re-anchored honestly (5.244.0): the population rides the call. */
{
  assert.match(inbox, /fetchOffTodayCount\(tenantId, \['new'\]\)\.catch\(\(\) => null\),/, 'the count rides load(), its population spoken');
  assert.match(inbox, /setStaleCount\(cnt\);/, 'the state lands');
  assert.match(inbox, /const stragglerN = staleCount \?\? stragglers\.length;/, 'the band speaks the whole-book word');
  assert.equal((inbox.match(/StragglerLine count=\{stragglerN\}/g) || []).length, 2, 'both doors speak it');
  ok('the counter: one cycle, one word, two doors');
}

/* 7 — fail-soft honesty: the catch bytes in both rooms.
 * Re-anchored honestly (5.244.0): the Dashboard fetches TWO counts now
 * (the news register AND the rail register) — each with its own dimming
 * catch. */
{
  assert.equal((dash.match(/fetchOffTodayCount\(tenantId, \['new'\]\)\.catch\(\(\) => null\)/g) || []).length, 1, 'Dashboard: the news register dims');
  assert.equal((dash.match(/fetchOffTodayCount\(tenantId, RAIL_STATUSES\)\.catch\(\(\) => null\)/g) || []).length, 1, 'Dashboard: the rail register dims');
  assert.equal((inbox.match(/fetchOffTodayCount\(tenantId, \['new'\]\)\.catch\(\(\) => null\)/g) || []).length, 1, 'CounterInbox: exactly one dimming catch');
  ok('fail-soft: a failed count dims to the page census, never a silent zero');
}

/* 8 — scope: the kitchen census rides its own path.
 * Closed honestly (5.244.0): the rail register got its server word this
 * round (the staleKitchenN wire — unit283 owns the new pins); the page
 * census line itself is byte-unchanged, still the fail-soft fallback. */
{
  assert.match(
    dash,
    /const staleKitchen = staleOlder\.filter\(\(o\) => isOnRail\(String\(o\.status\)\)\);/,
    'the page census keeps its bytes — the fallback under the server word',
  );
  ok('scope: the rail page census intact as the fallback (the server word is unit283\'s)');
}

/* 9 — the band's voice: one text flow, the amber rule, the honest title. */
{
  const line = inbox.slice(inbox.indexOf('const StragglerLine'), inbox.indexOf('/* ── counter doorbell'));
  assert.match(line, /<b className="font-extrabold">\{count\}<\/b> older/, 'the count carries the extrabold beat');
  assert.equal((line.match(/<span>/g) || []).length, 1, 'ONE text flow — the <b> nests inside the one span');
  assert.match(line, /border-l-4 border-l-\[#B45309\]/, 'the chase amber left rule');
  assert.match(line, /goSection\('bills', \['Food & Drinks', 'Bills'\], 'unpaid'\)/, 'the door keeps its grammar');
  assert.match(line, /counted from the whole ledger, not the loaded page/, 'the title names the whole-ledger read');
  ok("the band's voice: one flow, the chase amber, the whole-ledger title");
}

/* 10 — the icon warming: amber while stragglers hold. */
{
  assert.match(
    dash,
    /iconTone: newTickets\.length > 0\s*\? staleNewN > 0\s*\? 'bg-\[#FBF3E4\] text-\[#8A5A16\]'/,
    'the tile warms even with today’s queue live',
  );
  ok('the icon warming: amber = work waiting off-stage');
}

/* 11 — the census's own bytes: predicate + sort untouched (unit280 held). */
{
  assert.match(
    lib,
    /\.filter\(\(o\) => String\(o\.status\) === 'new' && !isSameAppDayAs\(o\.created_at, nowMs\)\)/,
    'the predicate stands',
  );
  assert.match(lib, /\.sort\(\(a, b\) => a\.created_at\.localeCompare\(b\.created_at\)\)/, 'the oldest-first chase stands');
  ok("the census's own bytes held — only the spoken number moved");
}

/* 12 — the version law in the agreement shape. */
{
  const v = versionTs.match(/APP_VERSION = '([\d.]+)'/)?.[1];
  const sw = swJs.match(/const VERSION = "servepoint-v([\d.]+)-r1"/)?.[1];
  assert.ok(v, 'version.ts speaks a word');
  assert.equal(v, sw, 'version.ts and sw.js agree');
  ok(`the version law: ${v} agreed on both homes`);
}

console.log(`\nunit282: ${n} checks green`);
