/* Task 199 — v5.160.0 unit suite: the turn line, settable.
 * Covers the two new pure voices:
 *   1. clampTurnAfterMin (prefs.ts) — the saved line's validator
 *   2. seatClockFor's turnAfterMin param (FloorScreen) — the camping boundary
 * Run: bunx vite-node scripts/unit199.mjs
 */
import assert from 'node:assert/strict';
import { clampTurnAfterMin, DEFAULT_TURN_AFTER_MIN } from '../src/lib/prefs';
import { seatClockFor, CAMPING_AFTER_MIN } from '../src/components/floor/FloorScreen';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);

/* ── 1 · clampTurnAfterMin ──────────────────────────────────────────── */

// the doctrine default is exported and named
assert.equal(DEFAULT_TURN_AFTER_MIN, 90);
ok('DEFAULT_TURN_AFTER_MIN is 90');

assert.equal(clampTurnAfterMin(90), 90);
ok('90 stays 90');

assert.equal(clampTurnAfterMin(60), 60);
assert.equal(clampTurnAfterMin(120), 120);
assert.equal(clampTurnAfterMin(150), 150);
ok('every offered option survives the validator');

// rounding + clamping band
assert.equal(clampTurnAfterMin(61.7), 62);
ok('61.7 rounds to 62');

assert.equal(clampTurnAfterMin(20), 30);
ok('20 clamps up to the 30-minute floor');

assert.equal(clampTurnAfterMin(300), 240);
ok('300 clamps down to the 240-minute ceiling');

// unreadable input returns the doctrine default — silence over invention
assert.equal(clampTurnAfterMin(undefined), 90);
assert.equal(clampTurnAfterMin(null), 90);
assert.equal(clampTurnAfterMin(NaN), 90);
assert.equal(clampTurnAfterMin(Infinity), 90);
assert.equal(clampTurnAfterMin('75'), 90); // wrong type — even a numeric string
assert.equal(clampTurnAfterMin({ min: 75 }), 90);
ok('unreadable inputs all return the doctrine default 90');

/* ── 2 · seatClockFor's turn line ───────────────────────────────────── */

// default line stays the 5.158.0 doctrine boundary (unit197 regression)
const T0 = '2026-10-04T09:00:00+05:30';
const at = (min) => new Date(new Date(T0).getTime() + min * 60000).getTime();

assert.equal(CAMPING_AFTER_MIN, 90);
ok('CAMPING_AFTER_MIN alias still names 90 (unit197 regression guard)');

assert.equal(seatClockFor(T0, at(89)).camping, false);
assert.equal(seatClockFor(T0, at(90)).camping, true);
ok('default line: 89 quiet, 90 camping (5.158.0 boundary intact)');

// custom line — the house's own number
assert.equal(seatClockFor(T0, at(59), 60).camping, false);
assert.equal(seatClockFor(T0, at(60), 60).camping, true);
ok('line 60: 59 quiet, 60 camping');

assert.equal(seatClockFor(T0, at(149), 150).camping, false);
assert.equal(seatClockFor(T0, at(150), 150).camping, true);
ok('line 150: 149 quiet, 150 camping');

// the label register is untouched by the line
assert.equal(seatClockFor(T0, at(100), 60).label, '1h 40m');
assert.equal(seatClockFor(T0, at(45), 150).camping, false);
assert.equal(seatClockFor(T0, at(45), 150).label, '45m');
ok('label register unchanged at any line (1h 40m / 45m)');

// null-on-unreadable still holds, any line
assert.equal(seatClockFor('not-a-timestamp', at(100), 60), null);
assert.equal(seatClockFor('', at(100), 150), null);
ok('unreadable placed-at returns null at any line');

console.log(`\n${n} asserts PASS`);
