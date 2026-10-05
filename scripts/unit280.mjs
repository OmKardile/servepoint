/**
 * unit280 — v5.241.0 "the stragglers answer to the counter".
 *
 * The round's laws, pinned:
 *   1. THE ONE CENSUS — lib/appday's staleNewTickets is the inbox
 *      stragglers' single home: the predicate (status 'new' ∧ NOT the
 *      app's day), the oldest-first chase order, the null silence, and
 *      the explicit-clock determinism (228's doctrine — suites own now).
 *   2. TWO ROOMS, ONE NUMBER — the Dashboard's whisper and the counter's
 *      straggler band both ask the lib; the inline fossil
 *      (staleOlder.filter(o => o.status === 'new')) is EXTINCT from the
 *      Dashboard, and CounterInbox has no second predicate.
 *   3. THE GUARD'S SECOND EYE — the counter band vanishes only when
 *      nothing waits AND nothing holds; the caught-up claim lives behind
 *      the straggler fork (a quiet body with stragglers holding would
 *      LIE — the empty body speaks the stragglers instead).
 *   4. NO SECOND ACTION PATH — the straggler line doors to Bills
 *      (goSection('bills', …, 'unpaid'), the Dashboard whisper's own
 *      grammar); no Ok, no Decline, no advanceOrder on stragglers.
 *   5. THE A11Y-GLUE LAW, PART 2 — the Floor section h2 and the three
 *      Notifications pills carry the JSX space ({' '}) before their count
 *      badge; the accessible name is "Main Floor 1", "All 15" — never
 *      "Main Floor1", never "All15". The flex-gap blessed family is not
 *      touched (the 5.237 verdict stands).
 *   6. THE VERSION LAW in the agreement shape (the unit241 lesson):
 *      version.ts and sw.js agree on whatever word is spoken.
 *
 * Run: bunx vite-node scripts/unit280.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);
const strip = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

/* ── the live census — behavior, not bytes ── */
const { staleNewTickets, isSameAppDayAs } = await import('/src/lib/appday.ts');

const lib = strip('../src/lib/appday.ts');
const dash = strip('../src/components/dashboard/DashboardScreen.tsx');
const inbox = strip('../src/components/food/CounterInbox.tsx');
const food = strip('../src/components/food/FoodDrinksScreen.tsx');
const floor = strip('../src/components/floor/FloorScreen.tsx');
const notifs = strip('../src/components/notifications/NotificationsScreen.tsx');
const versionTs = strip('../src/version.ts');
const swJs = strip('../public/sw.js');

/* IST day keys for the fixtures: build instants whose APP-day verdict we
 * control. Noon-anchored instants can't straddle the zone line. */
const appDayOf = (iso) => {
  // en-CA gives YYYY-MM-DD in the app zone — the lib's own key.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(iso));
};
const isoAt = (y, m, d, hh, mm) => new Date(Date.UTC(y, m - 1, d, hh - 5, mm - 30)).toISOString();
// ^ 10:00 IST == 04:30Z; the −5:30 shift bakes the IST wall time in.
const NOW = isoAt(2026, 10, 5, 12, 0); // noon IST, 5 Oct 2026

/* 1 — the predicate: only status 'new' from an OLDER app day. */
{
  const today = isoAt(2026, 10, 5, 9, 15);
  const yesterday = isoAt(2026, 10, 4, 9, 15);
  const older = isoAt(2026, 9, 28, 9, 15);
  const orders = [
    { id: 'a', status: 'new', created_at: older },
    { id: 'b', status: 'new', created_at: yesterday },
    { id: 'c', status: 'new', created_at: today }, // today's news — the queue, not a straggler
    { id: 'd', status: 'pending', created_at: older }, // on the rail — not the inbox's
    { id: 'e', status: 'cancelled', created_at: older }, // dead — never a straggler
    { id: 'f', status: 'paid', created_at: older },
  ];
  const stale = staleNewTickets(orders, NOW);
  assert.deepEqual(
    stale.map((o) => o.id),
    ['a', 'b'],
    'only older new tickets, oldest first',
  );
  ok('the census: older new only, rail/cancelled/today excluded, oldest first');

  /* the disagreement case, runner-tz-independent: at NOW = 17:30Z (23:00 IST)
   * the 20:30Z instant is "today" on a UTC wall but 02:00 TOMORROW in IST —
   * the app clock's NOT-today verdict puts it OFF today's inbox, exactly the
   * grammar the Dashboard's old inline filter spoke (off-today is off-today;
   * the census preserves it, corrupt future stamps included). */
  const nowLate = Date.UTC(2026, 9, 5, 17, 30);
  const eveningInstant = new Date(Date.UTC(2026, 9, 5, 20, 30)).toISOString();
  assert.equal(isSameAppDayAs(eveningInstant, nowLate), false, 'app clock: 20:30Z is tomorrow in IST');
  assert.equal(
    staleNewTickets([{ id: 'x', status: 'new', created_at: eveningInstant }], nowLate).length,
    1,
    'off-today (even off a future wall) is off the inbox — the preserved grammar',
  );
  ok("the clock: a UTC-wall 'today' is an IST tomorrow — off today's inbox");
}

/* 2 — silence and null-safety. */
assert.deepEqual(staleNewTickets(null, NOW), []);
assert.deepEqual(staleNewTickets(undefined, NOW), []);
assert.deepEqual(staleNewTickets([], NOW), []);
ok('null / undefined / empty → silence, never a throw');

/* 3 — determinism: same input + same clock, same verdict, any runner. */
{
  const a = isoAt(2026, 10, 4, 9, 15);
  const orders = [
    { id: 'a', status: 'new', created_at: a },
    { id: 'b', status: 'new', created_at: isoAt(2026, 9, 30, 9, 15) },
  ];
  const once = staleNewTickets(orders, NOW).map((o) => o.id);
  const twice = staleNewTickets(orders, NOW).map((o) => o.id);
  assert.deepEqual(once, twice);
  assert.deepEqual(once, ['b', 'a']);
  ok('deterministic: same clock in, same chase order out');
}

/* 4 — ONE home, TWO rooms: the lib is the only predicate writer. */
{
  const calls = (dash.match(/staleNewTickets\(/g) || []).length;
  assert.equal(calls, 1, 'Dashboard asks the census exactly once');
  const callsInbox = (inbox.match(/staleNewTickets\(/g) || []).length;
  assert.equal(callsInbox, 1, 'CounterInbox asks the census exactly once');
  assert.match(
    inbox,
    /import \{ isSameAppDay, staleNewTickets \} from '\.\.\/\.\.\/lib\/appday';/,
    "the queue keeps its own today predicate (isSameAppDay) — pinned by unit278 — and the stragglers ride the same lib",
  );
  /* the inline fossil is extinct from the Dashboard */
  assert.equal(
    (dash.match(/staleOlder\.filter\(\(o\) => o\.status === 'new'\)/g) || []).length,
    0,
    'the inline stale-new filter is extinct',
  );
  ok('ONE census, two readers; the inline fossil is extinct');
}

/* 5 — the guard's second eye + the honest caught-up fork. */
{
  assert.match(
    inbox,
    /tickets\.length === 0 && stragglers\.length === 0 && !error\) return null/,
    'the band vanishes only when nothing waits AND nothing holds',
  );
  const caughtUpGuard = (inbox.match(/tickets\.length === 0 && stragglers\.length === 0 \?/g) || []).length;
  assert.equal(caughtUpGuard, 1, 'the caught-up claim lives behind the straggler fork');
  assert.match(inbox, /StragglerLine count=\{stragglers\.length\}/, 'the quiet body speaks the stragglers');
  ok('the guard grew a second eye; the caught-up lie is forked out');
}

/* 6 — NO second action path: the straggler line names and doors, never acts. */
{
  const line = inbox.slice(inbox.indexOf('const StragglerLine'), inbox.indexOf('/* ── counter doorbell'));
  assert.match(line, /goSection\('bills', \['Food & Drinks', 'Bills'\], 'unpaid'\)/, 'the door rides the Dashboard grammar');
  assert.equal((line.match(/advanceOrder|onOk|onDecline/g) || []).length, 0, 'no Ok, no Decline on stragglers');
  ok('stragglers: names + door only; the action paths stay on today cards');
}

/* 7 — the rail's straggler footer: today's news and the stuck in one band. */
{
  assert.match(inbox, /tickets\.length > 0 && stragglers\.length > 0/, 'the footer gate');
  const footers = (inbox.match(/StragglerLine count=\{stragglers\.length\}/g) || []).length;
  assert.equal(footers, 2, 'one line component, two doors (empty body + rail footer)');
  ok('the rail footer rides the same ONE line');
}

/* 8 — the a11y-glue law, part 2: the floor's section h2. */
{
  assert.match(
    floor,
    /<MarkHit text=\{section\} query=\{query\} \/>\{' '\}/,
    "the section h2 carries {' '} before the count badge",
  );
  ok('Floor section h2: the name carries its space');
}

/* 9 — the a11y-glue law, part 2: the three Notifications pills. */
{
  assert.match(notifs, /Unread\{' '\}/, 'the unread toggle carries the JSX space');
  assert.match(notifs, /All\{' '\}/, 'the All pill carries the JSX space');
  assert.match(notifs, /\{CATEGORY_LABEL\[cat\] \|\| cat\}\{' '\}/, 'the category pills carry the JSX space');
  ok('Notifications: Unread / All / category pills speak their space');
}

/* 10 — the flex-gap blessed family stands untouched (5.237's verdict). */
{
  const priorSpaces = floor.match(/\{' '\}\s*\n\s*<span className="ml-1 font-normal text-\[#969696\]">· prior /g) || [];
  assert.equal(priorSpaces.length, 2, 'unit276 pins hold: both "· prior" spans untouched');
  ok('the blessed family keeps its bytes');
}

/* 11 — the version law in the agreement shape. */
{
  const v = versionTs.match(/APP_VERSION = '([\d.]+)'/)?.[1];
  const sw = swJs.match(/const VERSION = "servepoint-v([\d.]+)-r1"/)?.[1];
  assert.ok(v, 'version.ts speaks a word');
  assert.equal(v, sw, 'version.ts and sw.js agree');
  ok(`the version law: ${v} agreed on both homes`);
}

console.log(`\nunit280: ${n} checks green`);
