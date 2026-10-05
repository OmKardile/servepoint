/* Task 273 — v5.234.0 unit suite: the bell answers its name.
 *
 * The Task 273 walk (regression sweep of 5.231→5.233 on live data — all
 * held) turned to the parked feature list. The shell-search contract
 * (v5.116) had seven screens honoring the header's search box; the
 * Notifications screen was not one of them — the box simply did not
 * exist there, and ten unread bells meant scrolling to find "the bell
 * about ticket #55".
 *
 * v5.234.0: the bell screen joins the 5.116 contract — it registers its
 * own vocabulary ("Search bells…"), the header box renders there, and a
 * local door above the category chips carries the SAME state so mobile
 * readers (where the header box hides below md) get the search too.
 * The matcher is ONE pure closure over title+body: every whitespace-
 * separated token must appear ("stock milk" finds the shelf's milk
 * bell, not just any stock bell); an empty query filters nothing — the
 * zero-term view is byte-true. The term narrows the VIEW, never the
 * chips (the chips keep the shelf's own counts — the 5.42.0 honesty),
 * a count line answers "did this word find anything HERE" against the
 * room the term actually searched (category ∧ unread first, the term
 * last), and a miss names the term — the 5.116 doctrine: a search miss
 * never dresses as a filter miss.
 *
 * Asserted: the matcher's truth table BY BEHAVIOR (empty/whitespace
 * pass-through; title hit; body hit; case-free; multi-token AND across
 * title+body; token order free; miss; partial-AND miss); the join (the
 * registration + cleanup code shapes; the one-state law — the store is
 * the state, no local query useState); the pipeline order (narrowed
 * first, the matcher last); the ONE-matcher law (def + exactly one
 * call site); the chips' un-searched counts (deps [items, notify]);
 * the count line naming the searched room; the miss state naming the
 * term with the filter-miss bytes preserved; both doors in the header's
 * own ink (sp-input, rounded-full, hidden webkit cancel); Esc clearing;
 * the header contract unchanged (box only where a screen honors it);
 * the standing intervals preserved (the poll + the echo tick — a sum,
 * not a clock).
 * Run: bunx vite-node scripts/unit273.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mod = await import('/src/components/notifications/NotificationsScreen.tsx');
const { notificationMatchesQuery } = mod;

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);
const strip = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const src = strip('../src/components/notifications/NotificationsScreen.tsx');
const headerSrc = strip('../src/components/shell/Header.tsx');

/* ── 1–9: the ONE matcher's truth table, by behavior ── */

const bell = {
  title: 'Stock is low',
  body: 'Whole milk has crossed its reorder line — 2.5 L left.',
};

/* 1 — an empty query filters nothing (zero-term = old bytes). */
assert.equal(notificationMatchesQuery(bell, ''), true);
ok('empty query filters nothing — the zero-term view is byte-true');

/* 2 — a whitespace-only query is the same silence. */
assert.equal(notificationMatchesQuery(bell, '   '), true);
ok('whitespace-only query filters nothing — silence, never a fabricated zero');

/* 3 — the title carries a hit. */
assert.equal(notificationMatchesQuery(bell, 'stock'), true);
ok('title hit: "stock" finds the bell');

/* 4 — the body carries a hit. */
assert.equal(notificationMatchesQuery(bell, 'reorder'), true);
ok('body hit: "reorder" finds the bell the title never named');

/* 5 — case rides lowercase on both sides. */
assert.equal(notificationMatchesQuery(bell, 'STOCK Milk'), true);
ok('case-free: "STOCK Milk" matches "Stock is low / Whole milk"');

/* 6 — multi-token AND across title+body (the shelf's flour bell, not
 *     just any stock bell). */
assert.equal(notificationMatchesQuery(bell, 'stock milk'), true);
ok('multi-token AND across title+body: "stock milk" matches');

/* 7 — token order is free. */
assert.equal(notificationMatchesQuery(bell, 'milk stock'), true);
ok('token order free: "milk stock" matches the same bell');

/* 8 — a real miss is a miss. */
assert.equal(notificationMatchesQuery(bell, 'zzqx'), false);
ok('miss: "zzqx" matches nothing — false, not a silent pass');

/* 9 — a partial AND (one token only) is a miss: terms AND, never OR. */
assert.equal(notificationMatchesQuery(bell, 'stock zzqx'), false);
ok('partial AND is a miss — terms AND together, never OR');

/* ── 10–12: the join — the 5.116 shell-search contract ── */

/* 10 — the screen registers its vocabulary and unregisters on unmount. */
assert.ok(
  src.includes("setSearchMeta({ placeholder: 'Search bells…' })"),
  'the screen registers its search vocabulary'
);
assert.ok(
  src.includes('return () => useUi.getState().setSearchMeta(null);'),
  'unmount unregisters — the box must not survive the screen'
);
ok('join: registers "Search bells…" on mount, nulls it on unmount');

/* 11 — the one-state law: the store is the state, no local copy. */
assert.ok(src.includes('const query = useUi((s) => s.search);'));
assert.ok(src.includes('const setQuery = useUi((s) => s.setSearch);'));
assert.equal(
  src.includes('const [query,'),
  false,
  'no local query useState — two doors, ONE state'
);
ok('one-state law: both doors read useUi.search — no local copy to fork');

/* 12 — the header contract unchanged: the box exists only where a
 *     screen honors it. */
assert.ok(headerSrc.includes('{searchMeta && ('));
ok('header contract unchanged: the box renders only where a screen honors it');

/* ── 13–15: the pipeline — the term is the LAST stage ── */

/* 13 — narrowed (category ∧ unread) first, the matcher last. */
assert.ok(
  src.includes('narrowed.filter((n) => notificationMatchesQuery(n, query))'),
  'the term stage filters the already-narrowed set'
);
assert.ok(src.includes('const narrowed = useMemo('));
ok('pipeline order: category ∧ unread first, the term last');

/* 14 — the ONE-matcher law: def + exactly one call site, no inline
 *     dialect (count 2 — the identifier appears in code only; the
 *     comments say "matcher", the 5.272 lesson). */
const matcherHits = src.split('notificationMatchesQuery').length - 1;
assert.equal(matcherHits, 2, `def + one call site, found ${matcherHits}`);
ok('ONE matcher: exported pure, exactly one call site — no local dialect');

/* 15 — the chips keep the shelf's own counts: the chips memo never
 *     reads the query (deps stay [items, notify]). */
assert.ok(
  src.includes('}, [items, notify]);'),
  'the chips memo deps are [items, notify] — the term never touches them'
);
ok('chips un-searched: the term narrows the view, never the chips');

/* ── 16–18: the voices — count line, miss state, ink ── */

/* 16 — the count line names the room the term searched. */
assert.ok(src.includes('visible.length} of {narrowed.length'), 'the count line reads N of narrowed');
assert.ok(src.includes('aria-live="polite"'), 'the count line announces itself politely');
ok('count line: "N of M bells" against the searched room, aria-live polite');

/* 17 — the miss names the term; the filter miss keeps its bytes. */
assert.ok(src.includes('No bell matches'));
assert.ok(src.includes('try a shorter word'));
assert.ok(src.includes('Nothing under this filter right now.'));
ok('miss state: a term miss names the term; the filter miss keeps its bytes');

/* 18 — both doors wear the header's own ink (one contract, one ink). */
const doorInk =
  'sp-input w-full rounded-full py-2 pl-9 pr-8 text-[13px] [&::-webkit-search-cancel-button]:hidden';
assert.equal(
  src.split(doorInk).length - 1,
  1,
  'exactly one local door wearing the header clothes'
);
assert.ok(headerSrc.includes(doorInk), 'the header box wears the same clothes');
ok('one ink: the local door wears the header box\u2019s exact classes');

/* ── 19–20: the doors' behavior shapes ── */

/* 19 — Esc clears (the header's own rule, mirrored locally). */
assert.ok(src.includes("if (e.key === 'Escape')"));
assert.ok(src.includes("setQuery('')"));
ok('Esc clears the local door — the same rule the header teaches');

/* 20 — the local door carries the same vocabulary. */
assert.ok(src.includes('placeholder="Search bells…"'));
ok('local door: same vocabulary as the registered header box');

/* ── 21 — the standing intervals preserved (a sum, not a clock) ── */

const intervalHits = src.split('setInterval').length - 1;
assert.equal(intervalHits, 2, `poll + echo tick only, found ${intervalHits}`);
ok('standing intervals preserved: the 30s poll and the 30s echo tick — exactly two');

console.log(`\nunit273 — ${n} checks green`);
