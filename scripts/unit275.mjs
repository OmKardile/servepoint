/* Task 275 — v5.236.0 unit suite: the range answers to a calendar.
 *
 * The Task 275 walk (the Reports screen with fresh eyes — its window
 * plumbing is ONE pure family) took the next owner need: the fixed
 * windows (Today / 7 days / 30 days / All) can't answer "show me the
 * 2nd" — a specific day's audit, a fiscal week, a festival fortnight.
 * Custom joins as a FIFTH range key, and the whole window grammar moved
 * to lib/reportWindow.ts — ONE home, suite-importable, reusable (the
 * Close-out may one day ask the same windows).
 *
 * The honest laws, kept and extended:
 * - "N days" = N calendar days ending today, today inclusive (v5.19.0).
 * - The prior window is EQUAL-LENGTH and immediately before — the delta
 *   chips' honest baseline; All time gets NO baseline (silence, never a
 *   fake prior).
 * - Custom: a reversed pair is swapped by THE one swap (orderedCustom);
 *   the prior of an owner's span is the equal-length span before it, so
 *   "vs prior N days" is true by construction; the label everywhere
 *   speaks the DATES the owner chose ("2 Oct – 5 Oct"), never the bare
 *   chip word "Custom"; the day-filler steps calendar STRINGS through
 *   the noon anchor (DST-safe — the 24h ms stride drifts); and the
 *   inputs arm pre-filled with the last 7 days, so Custom is never an
 *   empty or invalid state.
 *
 * Asserted: the windows BY BEHAVIOR (single day = start→exclusive next
 * midnight; reversed pair == sorted pair; multi-day span ms; malformed →
 * the 7-day fallback; 'all' startless; the three fixed keys byte-equal to
 * lastNDaysMs); the prior windows (custom equal-length; the fixed keys'
 * today-anchored shape; 'all' null); the prior labels (prior N days /
 * prior day; the fixed words byte-true); the custom label (the span
 * phrase through the house formatter; the single day alone; the fixed
 * words byte-true); customDayKeys (ordered, complete, swap-immune,
 * malformed-silent); orderedCustom (the one swap, malformed → null); and
 * the screen's wiring shapes (the armed calendar row with both date
 * inputs, the dep arrays riding customWindow, the fixed-word body free
 * of self-recursion).
 * Run: bunx vite-node scripts/unit275.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  RANGE_LABEL,
  rangeWindow,
  priorWindow,
  priorRangeLabel,
  rangeLabelOf,
  orderedCustom,
  customDayKeys,
} from '/src/lib/reportWindow.ts';
import { lastNDaysMs, appDayStartMs, appFormatters } from '/src/lib/appday.ts';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);
const strip = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const screenSrc = strip('../src/components/reports/ReportsScreen.tsx');
const libSrc = strip('../src/lib/reportWindow.ts');

const DAY = 86_400_000;
const fmtDay = (iso) => appFormatters().dayLabel.format(new Date(appDayStartMs(iso)));

/* ── 1–6: the custom window, by behavior ── */

/* 1 — a single day is today-style: one day, start to exclusive end. */
const single = rangeWindow('custom', { from: '2026-10-02', to: '2026-10-02' });
assert.equal(single.startMs, appDayStartMs('2026-10-02'));
assert.equal(single.endMs, appDayStartMs('2026-10-03'));
assert.equal(single.endMs - single.startMs, DAY);
ok('single-day custom: start → exclusive next midnight, exactly one day');

/* 2 — a multi-day span measures whole days. */
const span = rangeWindow('custom', { from: '2026-10-02', to: '2026-10-05' });
assert.equal(span.endMs - span.startMs, 4 * DAY);
assert.equal(span.startMs, appDayStartMs('2026-10-02'));
ok('multi-day custom: 2→5 Oct = exactly 4 days');

/* 3 — a reversed pair reads the same window (THE one swap). */
const reversed = rangeWindow('custom', { from: '2026-10-05', to: '2026-10-02' });
assert.equal(reversed.startMs, span.startMs);
assert.equal(reversed.endMs, span.endMs);
ok('reversed pair: the window reads the dates the honest way');

/* 4 — a malformed pair falls back to the last 7 days (never fabricated). */
const fallback = rangeWindow('custom', { from: 'nope', to: '2026-10-05' });
const seven = lastNDaysMs(7);
assert.equal(fallback.startMs, seven.startMs);
assert.equal(fallback.endMs, seven.endMs);
ok('malformed custom: the 7-day fallback, never a fabricated window');

/* 5 — All time stays startless. */
assert.equal(rangeWindow('all').startMs, null);
ok("All time: startless — the 'all' law unchanged");

/* 6 — the three fixed keys are byte-equal to the ONE builder. */
for (const [key, days] of [['today', 1], ['7d', 7], ['30d', 30]]) {
  const w = rangeWindow(key);
  const l = lastNDaysMs(days);
  assert.equal(w.startMs, l.startMs);
  assert.equal(w.endMs, l.endMs);
}
ok("fixed keys: today/7d/30d byte-equal to lastNDaysMs — v5.19.0's semantics exact");

/* ── 7–11: the prior window — the honest baseline ── */

/* 7 — a custom span's prior is the equal-length span immediately before. */
const priorSpan = priorWindow('custom', { from: '2026-10-02', to: '2026-10-05' });
assert.equal(priorSpan.endMs, span.startMs);
assert.equal(priorSpan.startMs, span.startMs - 4 * DAY);
ok('custom prior: equal length (4 days), immediately before, end exclusive at the window start');

/* 8 — a single custom day's prior is the prior DAY. */
const priorSingle = priorWindow('custom', { from: '2026-10-02', to: '2026-10-02' });
assert.equal(priorSingle.endMs, single.startMs);
assert.equal(priorSingle.endMs - priorSingle.startMs, DAY);
ok('single-day custom prior: exactly the prior day');

/* 9 — the fixed keys keep their today-anchored shape. */
const prior7 = priorWindow('7d');
assert.equal(prior7.endMs - prior7.startMs, 7 * DAY);
ok('fixed prior: 7d baseline stays a 7-day span');

/* 10 — All time has NO baseline (silence, never a fake prior). */
assert.equal(priorWindow('all'), null);
assert.equal(priorRangeLabel('all'), null);
ok("All time: no baseline — the v5.19.0 silence law byte-true");

/* 11 — the prior labels speak the span they compared. */
assert.equal(priorRangeLabel('custom', { from: '2026-10-02', to: '2026-10-05' }), 'prior 4 days');
assert.equal(priorRangeLabel('custom', { from: '2026-10-02', to: '2026-10-02' }), 'prior day');
assert.equal(priorRangeLabel('today'), 'prior day');
assert.equal(priorRangeLabel('7d'), 'prior 7 days');
assert.equal(priorRangeLabel('30d'), 'prior 30 days');
ok('prior labels: "vs prior N days" true by construction; the fixed words byte-true');

/* ── 12–14: the custom label — the dates, never the chip word ── */

/* 12 — a span speaks the dates through the house formatter. */
const label = rangeLabelOf('custom', { from: '2026-10-02', to: '2026-10-05' });
assert.equal(label, `${fmtDay('2026-10-02')} – ${fmtDay('2026-10-05')}`);
assert.ok(label.includes('Oct'));
assert.equal(label.toLowerCase().startsWith('custom'), false);
ok('span label: the dates the owner chose, never the bare chip word');

/* 13 — a single day speaks alone. */
assert.equal(rangeLabelOf('custom', { from: '2026-10-02', to: '2026-10-02' }), fmtDay('2026-10-02'));
ok('single-day label: just the day');

/* 14 — the fixed words byte-true. */
assert.equal(rangeLabelOf('7d'), 'Last 7 days');
assert.equal(rangeLabelOf('today'), 'Today');
assert.equal(rangeLabelOf('all'), 'All time');
assert.equal(RANGE_LABEL.custom, 'Custom');
ok('fixed labels byte-true; the strip chip says Custom');

/* ── 15–17: the day-filler and the one swap ── */

/* 15 — customDayKeys walks the span, ordered and complete. */
assert.deepEqual(
  customDayKeys({ from: '2026-10-02', to: '2026-10-05' }),
  ['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']
);
ok('day-filler: every calendar day, in order, gaps honest');

/* 16 — the filler is swap-immune (it asks THE one swap). */
assert.deepEqual(
  customDayKeys({ from: '2026-10-05', to: '2026-10-02' }),
  customDayKeys({ from: '2026-10-02', to: '2026-10-05' })
);
ok('day-filler swap-immune: reversed pair, same days');

/* 17 — malformed pairs: the swap says null, the filler says silence. */
assert.equal(orderedCustom({ from: 'x', to: '2026-10-05' }), null);
assert.deepEqual(customDayKeys({ from: 'x', to: '2026-10-05' }), []);
ok('malformed: orderedCustom null, the filler silent');

/* ── 18–20: the screen's wiring shapes ── */

/* 18 — the armed calendar row: revealed only while Custom stands, both
 *     date inputs present (the mobile-and-desktop door). */
assert.ok(screenSrc.includes("{range === 'custom' && ("));
assert.ok(screenSrc.includes('Custom range start date'));
assert.ok(screenSrc.includes('Custom range end date'));
ok('armed calendar: the date inputs render only while Custom stands');

/* 19 — the window memos ride the custom pair: no stale window may hide
 *     behind a memo that forgot the dates changed. */
const depRides = (screenSrc.match(/customWindow\]\)/g) || []).length;
assert.ok(depRides >= 11, `every window memo rides customWindow, found ${depRides}`);
ok(`dep discipline: ${depRides} memos/effects ride customWindow — no stale window`);

/* 20 — the label body never calls itself (the mid-round recursion
 *     fossil, caught at typecheck and pinned extinct).
 * 5.240.0 re-anchor: the pin narrows to rangeLabelOf's OWN body —
 * the fixed words come from the map, the span from the dates, and no
 * label builder re-enters itself. Sibling COMPOSITION is the house
 * law, not recursion: rangeSpanOf (5.240) reads the span builder on
 * the fixed window's pair — one arithmetic, many names. */
assert.ok(libSrc.includes('return RANGE_LABEL[range];'));
const labelBody = libSrc.slice(libSrc.indexOf('export function rangeLabelOf'), libSrc.indexOf('export function shiftDayIso'));
assert.equal(labelBody.includes('return rangeLabelOf('), false);
ok('no self-recursion: the label body never calls itself — siblings compose it');

console.log(`\nunit275 — ${n} checks green`);
