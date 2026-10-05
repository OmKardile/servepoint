/* Task 276 — v5.237.0 unit suite: the pager answers to a date.
 *
 * The Task 276 walk (Close-out, Reports, Bills, Guests, Kitchen, Floor,
 * Settings — all healthy) found the Close-out's day stepper honest but
 * slow: one click + one load per day, so an owner reconciling last month
 * paid a click per day to pull "1 Sept"'s z-report. The stepper gains a
 * native date input — the day jump.
 *
 * The laws, kept and extended:
 * - ONE date state, ONE engine: the input writes through THE setDateIso
 *   the arrows and Today already ask — no second state, no second load
 *   path; the load effect's (tenantId, dateIso) stays the only engine.
 * - ONE clock: the input's value and the big prettyDay label read the
 *   same dateIso, so they can never disagree.
 * - The honest ceiling: max=today — the same ceiling the Next arrow's
 *   disabled prop already honors; the future has no book yet.
 * - An empty day answers with the ledger's honest MoonStar voice ("No
 *   sales recorded this day") — never a fabricated zero-report.
 * - ONE house ink for every date box: the input wears the Reports
 *   calendar row's own classes (sp-input, gold focus ring #967221).
 * - The a11y name joins its sentence: a newline between JSX text and a
 *   span glues the accessible name ("SECTION MIX· what sold", "…vs
 *   prior 7d· prior 12") while the margin (ml-1.5/ml-1) painted the
 *   visual gap. The family now carries the space in the JSX — one
 *   dialect, the Ledger's own (inline space + ml-1).
 *
 * Asserted: the input's shape (type=date, value={dateIso},
 * max={istTodayIso()}, the onChange writing setDateIso and nothing
 * else); the ONE-state law (exactly one date useState declaration); the
 * one-engine law (the load effect's deps unchanged); the pager's
 * preserved bytes (Previous/Next aria-labels, shiftDay ±1, the today
 * ceiling, the conditional Today button, the prettyDay label); the ink
 * (sp-input + the gold ring); the wrap (the stepper group flex-wraps);
 * the empty-day voice intact; the a11y space family (Section mix + both
 * FloorScreen "· prior" spans carry {' '}; the Ledger dialect
 * untouched); and the version law (version.ts and sw.js agree on
 * 5.237.0).
 * Run: bunx vite-node scripts/unit276.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);
const strip = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const eod = strip('../src/components/eod/EodScreen.tsx');
const floor = strip('../src/components/floor/FloorScreen.tsx');
const versionSrc = strip('../src/version.ts');
const swSrc = strip('../public/sw.js');

/* ── 1. the day jump: the input exists, ONCE ── */
const dateInputs = eod.match(/type="date"/g) || [];
assert.equal(dateInputs.length, 1, 'exactly one date input in the Close-out');
ok('the day jump exists — one date input in the stepper');

/* ── 2. the input's shape: bound, capped, honest ── */
const inputBlock = eod.slice(eod.indexOf('type="date"') - 200, eod.indexOf('type="date"') + 700);
assert.ok(inputBlock.includes('value={dateIso}'), 'the input reads THE dateIso (one clock with the label)');
assert.ok(inputBlock.includes('max={istTodayIso()}'), 'max=today — the ceiling the Next arrow already honors');
ok('the input binds THE dateIso and caps at today');

/* ── 3. ONE writer: onChange touches setDateIso and nothing else ── */
const onChangeBody = inputBlock.match(/onChange=\{\((e)\) => \{(.*)\}\}/);
assert.ok(onChangeBody, 'the onChange is the house inline shape');
const body = onChangeBody[2];
assert.ok(body.includes('setDateIso(v)'), 'the input writes through setDateIso');
const otherWriters = body.match(/set(?!DateIso)[A-Z]\w+\(/g) || [];
assert.equal(otherWriters.length, 0, `no second writer rides the onChange (found ${otherWriters})`);
ok('ONE writer — the input asks the same setDateIso the arrows ask');

/* ── 4. ONE date state, ONE engine ── */
const dateStates = eod.match(/useState<string>\(\(\) => \{/g) || [];
assert.equal(dateStates.length, 1, 'exactly one date useState — no fork');
assert.ok(eod.includes('}, [tenantId, dateIso]);'), 'the load effect still rides (tenantId, dateIso) — the one engine');
ok('ONE date state, ONE load engine');

/* ── 5. the pager's bytes preserved ── */
assert.ok(eod.includes('aria-label="Previous day"'), 'Previous day keeps its name');
assert.ok(eod.includes('shiftDay(d, -1)'), 'the back arrow still asks shiftDay(-1)');
assert.ok(eod.includes('shiftDay(d, 1)'), 'the forward arrow still asks shiftDay(+1)');
assert.ok(eod.includes('disabled={dateIso >= istTodayIso()}'), 'the Next arrow keeps its honest ceiling');
assert.ok(eod.includes('aria-label="Next day"'), 'Next day keeps its name');
assert.ok(eod.includes('{!isToday ? ('), 'Today stays conditional on being away');
assert.ok(eod.includes('{prettyDay(dateIso)}'), 'the big label still speaks prettyDay(dateIso)');
ok('the pager bytes preserved — arrows, ceiling, Today, label');

/* ── 6. the ink: one house ink for every date box ── */
assert.ok(inputBlock.includes('sp-input'), 'the input wears the house sp-input');
assert.ok(inputBlock.includes('focus-visible:outline-[#967221]'), 'the gold focus ring — the Reports calendar row\u2019s own');
assert.ok(eod.includes('aria-label="Jump straight to a day\'s book"'), 'the input speaks its name');
ok('the ink — sp-input + the gold ring, the 5.236 calendar row\u2019s own');

/* ── 7. the wrap: narrow screens fold, not overflow ── */
assert.ok(eod.includes('className="flex flex-wrap items-center gap-1.5"'), 'the stepper group flex-wraps');
ok('the stepper wraps on narrow screens');

/* ── 8. the empty-day voice intact ── */
assert.ok(eod.includes('No sales recorded this day'), 'the empty day keeps its MoonStar voice');
ok('an empty day still answers honestly');

/* ── 9. the a11y space family: EodScreen ── */
assert.ok(eod.includes("Section mix{' '}"), 'Section mix carries the space in the JSX');
const mixSpan = eod.slice(eod.indexOf("Section mix{' '}") , eod.indexOf("Section mix{' '}") + 220);
assert.ok(mixSpan.includes('ml-1 '), 'the span wears the Ledger\u2019s ml-1');
assert.ok(!mixSpan.includes('ml-1.5'), 'the glued dialect\u2019s ml-1.5 is gone');
assert.ok(eod.includes('Ledger <span className="ml-1 '), 'the Ledger sibling untouched — the dialect\u2019s original speaker');
ok('the a11y name joins its sentence (Section mix)');

/* ── 10. the a11y space family: FloorScreen ── */
const priorSpaces = floor.match(/\{' '\}\s*\n\s*<span className="ml-1 font-normal text-\[#969696\]">· prior /g) || [];
assert.equal(priorSpaces.length, 2, 'both FloorScreen "· prior" spans carry the JSX space');
ok('the a11y name joins its sentence (both Floor prior rows)');

/* ── 11. the version law: one word, two homes ── */
/* 5.238.0 re-anchor: the law is the AGREEMENT (sw bakes whatever word
 * version.ts speaks — unit274's shape), not a frozen number; a frozen
 * pin goes stale on every honest bump. */
const { APP_VERSION } = await import('/src/version.ts');
assert.ok(APP_VERSION.length > 0, 'version.ts speaks a word');
assert.ok(swSrc.includes(`servepoint-v${APP_VERSION}-r1`), 'the service worker bakes the same round');
ok(`the version law — version.ts and sw.js agree on ${APP_VERSION}`);

console.log(`\nunit276: ${n} checks green — the pager answers to a date`);
