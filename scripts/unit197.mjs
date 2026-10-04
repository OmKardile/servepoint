/* Task 197 — the camping clock asserts.
 * seatClockFor is the floor's seat-time voice: provable only from the
 * round's own placed-at ledger, silent (null) on unreadable input, and
 * honest at the 90-minute house turn line. Pinned here so the boundary,
 * the label register (TimeAgo family: "45m" · "1h 5m" · "just sat") and
 * the clamp can't drift silently. */

let fails = 0;
const assert = (name, cond) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${name}`);
  if (!cond) fails++;
};

const floor = await import('/src/components/floor/FloorScreen.tsx');
const { seatClockFor, CAMPING_AFTER_MIN } = floor;

/* now = a fixed instant; placedAt derived from it */
const NOW = Date.UTC(2026, 9, 4, 10, 0, 0); // 4 Oct 2026 10:00 UTC
const at = (minAgo) => new Date(NOW - minAgo * 60000).toISOString();

/* ── the house line ── */
assert('CAMPING_AFTER_MIN is 90', CAMPING_AFTER_MIN === 90);

/* ── label register ── */
const just = seatClockFor(at(0), NOW);
assert('0 min → label "just sat"', just?.label === 'just sat');
assert('0 min → not camping', just?.camping === false);
assert('0 min → minutes 0', just?.minutes === 0);

const m45 = seatClockFor(at(45), NOW);
assert('45 min → "45m"', m45?.label === '45m');
assert('45 min → not camping', m45?.camping === false);

const m89 = seatClockFor(at(89), NOW);
assert('89 min → "1h 29m" (TimeAgo register, un-padded)', m89?.label === '1h 29m');
assert('89 min → not camping (one under the line)', m89?.camping === false);

const m90 = seatClockFor(at(90), NOW);
assert('90 min → camping TRUE (boundary sits ON the line)', m90?.camping === true);
assert('90 min → "1h 30m"', m90?.label === '1h 30m');

const m102 = seatClockFor(at(102), NOW);
assert('102 min → "1h 42m" + camping', m102?.label === '1h 42m' && m102?.camping === true);

const m300 = seatClockFor(at(300), NOW);
assert('300 min → "5h 0m" + camping', m300?.label === '5h 0m' && m300?.camping === true);

/* ── honesty clamps ── */
const future = seatClockFor(new Date(NOW + 15 * 60000).toISOString(), NOW);
assert('clock skew (round in the "future") clamps to just-sat, never negative', future?.minutes === 0 && future?.label === 'just sat');

const bad = seatClockFor('not-a-timestamp', NOW);
assert('unreadable ledger input → null (silence, not invention)', bad === null);

const empty = seatClockFor('', NOW);
assert('empty input → null', empty === null);

console.log(fails === 0 ? '\nALL PASS (14 asserts)' : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
