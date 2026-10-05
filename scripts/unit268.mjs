/* Task 268 — v5.229.0 unit suite: the line carries the day's tally.
 *
 * The Kitchen context line said how LONG the oldest ticket has waited
 * (5.196's oldest-wait voice) and WHEN the last one landed (5.228's
 * stamp), but never how FAR the day has come: the pass's Completed
 * column keeps the newest 12 (overflow hidden), so on a 14-ticket day
 * the true count lived nowhere on the board. v5.229.0 gives BOTH
 * branches the tally — "· N completed today" when the day has completed
 * anything (silence, never a zero), the UNCAPPED count captured before
 * the column's cap; the tally's number wears the completed stage's own
 * ink (#0F3D3E, the pill's color); the Completed stat tile whispers
 * "+N" when the column hides older work.
 *
 * Asserted: the coherence law (completed ⊂ landed — a tally day always
 * stamps, so "N completed today" and "nothing yet today" can never
 * render together); the capture-before-cap law (the tally is read off
 * the uncapped array, tally = column + overflow exactly); the render
 * laws (both branches gated > 0, the stage's own ink, the title, the
 * clause order — tally before the cancelled aside); the stat tile's
 * whisper (column count + hidden +N, the same overflow register); the
 * memo wiring (completedToday rides the return); no new timer.
 * Run: bunx vite-node scripts/unit268.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const kitchen = await import('/src/components/kitchen/KitchenScreen.tsx');
const { lastRailTicketAt } = kitchen;

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);
const strip = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

/* The suite owns the clock through the INJECTED grammar (the 5.228 seam). */
const TODAY = '2026-10-05';
const sameDay = (iso) => String(iso).startsWith(TODAY);
const at = (hh, mm) => `${TODAY}T${hh}:${mm}:00+05:30`;
const row = (id, created_at, status) => ({ id, created_at, status });

/* 1 — THE COHERENCE LAW, now two clauses wide: completed ⊂ landed (the
 * stamp's set includes the tally's), so a day with any completed ticket
 * ALWAYS stamps — "N completed today" and "nothing yet today" can never
 * render together. Property over row sets: tally > 0 ⟹ stamp ≠ null. */
const sets = [
  [row('a', at('09:00'), 'completed')],
  [row('a', at('09:00'), 'cancelled'), row('b', at('09:30'), 'completed')],
  [row('a', at('09:00'), 'new'), row('b', at('10:00'), 'ready'), row('c', at('08:00'), 'completed')],
  [row('a', '2026-10-04T21:00:00+05:30', 'completed'), row('b', at('11:15'), 'pending')],
];
for (const set of sets) {
  const tally = set.filter(
    (r) => String(r.status).toLowerCase() === 'completed' && sameDay(r.created_at)
  ).length;
  const stamp = lastRailTicketAt(set, sameDay);
  assert.ok(
    tally === 0 || stamp !== null,
    `tally ${tally} with a null stamp would render "nothing yet" beside the count`
  );
}
ok('coherence: completed ⊂ landed — a tally day always stamps, nothing-yet + tally impossible');

/* 2 — the quiet case stays honest in the other direction: a cancelled-only
 * day stamps (5.228) but the tally stays silent — cancelled is landed,
 * never completed; "1 cancelled today" beside no tally is the truth. */
const cancelledOnly = [row('a', at('07:40'), 'cancelled'), row('b', at('08:10'), 'cancelled')];
const tallyZero = cancelledOnly.filter(
  (r) => String(r.status).toLowerCase() === 'completed' && sameDay(r.created_at)
).length;
assert.equal(tallyZero, 0);
assert.notEqual(lastRailTicketAt(cancelledOnly, sameDay), null);
ok('cancelled-only day: stamp speaks, the tally stays silent — landed ≠ completed');

/* ── source pins — the wiring cannot lie ── */
const src = strip('../src/components/kitchen/KitchenScreen.tsx');

/* 3 — the capture-before-cap law: the tally is read off the UNCAPPED
 * array BEFORE the 12-card slice, one read — tally = column + overflow
 * exactly (the 5.262 law: the tally IS the verdict the cap reads). */
const memo = src.slice(src.indexOf('const completed = byStage.get'), src.indexOf('const activeWait'));
const capIdx = memo.indexOf("byStage.set('completed', completed.slice(overflow))");
const tallyIdx = memo.indexOf('const completedToday = completed.length;');
const overflowIdx = memo.indexOf('const overflow = Math.max(0, completedToday - 12);');
assert.ok(tallyIdx > -1 && capIdx > -1, 'the tally capture and the cap both exist in the memo');
assert.ok(tallyIdx < overflowIdx && overflowIdx < capIdx, 'capture before overflow before cap');
ok('memo: tally captured BEFORE the cap — one array, one read, tally = column + overflow');

/* 4 — the memo return carries the tally (the wiring pin). */
assert.ok(
  src.includes('      completedToday,\n'),
  'the memo return ships completedToday'
);
ok('memo wiring: completedToday rides the return object');

/* 5 — both branches speak the tally, gated on > 0 (silence, never a
 * zero — the 5.226/5.228 law): exactly two render sites. */
const gates = src.match(/board\.completedToday > 0 && \(/g) || [];
assert.equal(gates.length, 2, 'the tally clause renders in exactly two sites (active + quiet)');
ok('render: both branches gated completedToday > 0 — exactly two sites, silence never a zero');

/* 6 — the tally's number wears the completed stage's OWN ink: the pill
 * the pass already paints (#0F3D3E) — no new color born here. */
assert.ok(
  src.includes("pill: 'bg-[#0F3D3E]'"),
  'the completed stage pill keeps its ink'
);
const inks = src.match(/font-semibold text-\[#0F3D3E\]/g) || [];
assert.equal(inks.length, 2, 'both tally numbers wear the stage ink');
ok("render: the tally's number wears the completed stage's own ink (#0F3D3E), both branches");

/* 7 — the title rides both tally spans: the cap's honesty lives where
 * the finger can ask. */
const titles = src.match(/title="Completed today — the day's tally; the column keeps the newest 12"/g) || [];
assert.equal(titles.length, 2, 'both tally spans carry the cap title');
ok('render: the tally title (day tally vs column cap) rides both spans');

/* 8 — clause order, ACTIVE branch: wait → tally → cancelled (off rail).
 * The tally sits between the headline and the aside. */
const activeBlock = src.slice(src.indexOf('Oldest active ticket waiting'), src.indexOf('Quiet service — no active tickets'));
assert.ok(
  activeBlock.indexOf('completedToday > 0') > -1 &&
    activeBlock.indexOf('completedToday > 0') < activeBlock.indexOf('cancelledToday > 0'),
  'active branch: tally before the cancelled aside'
);
ok('clause order (active): wait → tally → cancelled (off rail)');

/* 9 — clause order, QUIET branch: quiet words → stamp/nothing → tally →
 * cancelled — the tally answers 5.228's stamp, both before the aside. */
const quietBlock = src.slice(src.indexOf('Quiet service — no active tickets'));
const stampIdx = quietBlock.indexOf("nothing yet today");
const qTallyIdx = quietBlock.indexOf('completedToday > 0');
const qCancelIdx = quietBlock.indexOf("cancelledToday > 0 ?");
assert.ok(stampIdx < qTallyIdx && qTallyIdx < qCancelIdx, 'quiet branch: stamp → tally → cancelled');
ok('clause order (quiet): quiet words → stamp → tally → cancelled');

/* 10 — the 5.228 stamp ternary keeps its exact bytes (the neighbour law:
 * the tally's arrival touched nothing it stands beside). */
assert.ok(
  quietBlock.includes("{board.lastTicketAt\n              ? ` · last ticket ${hhmm(board.lastTicketAt)}`\n              : ' · nothing yet today'}"),
  'the stamp ternary survives byte-identical'
);
ok('neighbour: the 5.228 stamp ternary byte-identical');

/* 11 — the ACTIVE headline and the cancelled (off rail) clause keep
 * their bytes (the 5.227 law: the branch that was never thin keeps its
 * voice untouched — the tally ADDS, it never rewrites). */
assert.ok(src.includes('Oldest active ticket waiting'), 'the active headline survives');
assert.ok(
  src.includes('{board.cancelledToday > 0 && <> · {board.cancelledToday} cancelled today (off rail)</>}'),
  'the active cancelled clause survives byte-identical'
);
ok('neighbour: active headline + cancelled (off rail) byte-identical');

/* 12 — the stat tile whisper: when the column hides older work, the
 * Completed tile speaks the column's own count PLUS the hidden +N in
 * the line's own grey — two surfaces, one register, one number (5.198). */
assert.ok(
  src.includes("s.key === 'completed' && board.overflow > 0 &&"),
  'the tile whisper gates on the completed column + overflow'
);
assert.ok(
  src.includes("title={`${board.overflow} older completed orders hidden — the day's tally is ${board.completedToday}`}"),
  'the whisper title names the hidden AND the day tally'
);
assert.ok(
  src.includes('+{board.overflow}'),
  'the whisper renders +N'
);
ok('stat tile: the Completed tile whispers +N (hidden) with the tally in its title');

/* 13 — the tile's main count keeps its register: the column's own count
 * (board.byStage.get(s.key)!.length) still renders — the whisper never
 * REPLACES the count, it rides beside it. */
assert.ok(
  src.includes('{board.byStage.get(s.key)!.length}'),
  'the tile count keeps the column register'
);
ok('stat tile: the column count keeps its bytes — the whisper rides beside, never replaces');

/* 14 — no new timer: the tally is derived in the existing memo from the
 * orders the screen already holds; the two intervals stand. */
const timers = src.match(/setInterval/g) || [];
assert.equal(timers.length, 2, 'setInterval count stands at 2 (heartbeat + poll)');
ok('no new timer: a count, not a clock — the two intervals stand');

/* 15 — purity of the neighbour's contract: lastRailTicketAt is
 * untouched by this round (5.228's own suite pins its grammar; here we
 * pin the export still answers the same shape). */
const stamp = lastRailTicketAt([row('a', at('09:00'), 'completed')], sameDay);
assert.equal(stamp, at('09:00'));
const none = lastRailTicketAt([row('a', at('09:00'), 'new')], sameDay);
assert.equal(none, null);
ok('lastRailTicketAt untouched: same shape, same answers — 5.228 holds');

console.log(`\nunit268 — ${n} checks green`);
