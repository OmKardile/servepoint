/* The report window grammar (v5.19.0 → v5.236.0) — ONE home for the ranges
 * Reports speaks: the fixed keys (Today / 7 / 30 / All) and, since v5.236.0,
 * the owner's own calendar (Custom).
 *
 * v5.19.0 — "N days" = N calendar days ENDING today (today inclusive), the
 * equal-length prior window as the honest delta baseline, and NO baseline
 * for All time (no earlier boundary in the ledger — silence, never a fake
 * prior).
 *
 * v5.202.0 — the midnight math moved to appday's ONE builder (lastNDaysMs),
 * DST-safe through the lib; the movers' week (Menu medallion, rail chips,
 * shelf pace) speaks the same window, so two surfaces quoting the week
 * quote one number.
 *
 * v5.236.0 — Custom joins: the owner picks from/to (YYYY-MM-DD); a reversed
 * pair is swapped by THE one swap (orderedCustom); the prior window stays
 * equal-length ("vs prior N days" is true by construction); and the label
 * everywhere (captions, CSVs, print, share texts) speaks the DATES the
 * owner chose — a span phrase, never the bare chip word "Custom" standing
 * in for dates nobody can verify.
 */
import {
  appDayEndMs,
  appDayStartMs,
  appTimezone,
  appTodayIso,
  appFormatters,
  lastNDaysMs,
} from './appday';

export type RangeKey = 'today' | '7d' | '30d' | 'all' | 'custom';

/** The custom range's two calendar strings (YYYY-MM-DD), the owner's own
 *  words for "show me the 2nd". The screen arms them pre-filled with the
 *  last 7 days, so Custom is never an empty or invalid state. */
export interface CustomRange {
  from: string;
  to: string;
}

export const RANGE_LABEL: Record<RangeKey, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  all: 'All time',
  custom: 'Custom',
};

/** The owner's pair, read the honest way: sorted so from ≤ to, and only
 *  real YYYY-MM-DD strings survive. THE one swap — the window builder and
 *  the day-filler both ask this, never a second sort. */
export function orderedCustom(custom: CustomRange): [string, string] | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(custom.from) || !/^\d{4}-\d{2}-\d{2}$/.test(custom.to)) return null;
  return custom.from <= custom.to ? [custom.from, custom.to] : [custom.to, custom.from];
}

/** Every calendar day in the owner's own span, stepped as calendar STRINGS
 *  through the noon anchor (DST-safe — a 24h ms stride drifts across a
 *  zone's spring-forward). 400 keys = the sanity bound (~13 months); an
 *  owner who wants a year of thin bars gets them, a malformed pair gets
 *  silence (the window fallback never asks here). */
export function customDayKeys(custom: CustomRange): string[] {
  const pair = orderedCustom(custom);
  if (!pair) return [];
  const keys: string[] = [];
  let cur = pair[0];
  while (cur <= pair[1] && keys.length < 400) {
    keys.push(cur);
    const d = new Date(`${cur}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    cur = d.toISOString().slice(0, 10);
  }
  return keys;
}

export function rangeWindow(range: RangeKey, custom?: CustomRange): { startMs: number | null; endMs: number } {
  if (range === 'all') return { startMs: null, endMs: appDayEndMs(appTodayIso()) };
  if (range === 'custom') {
    /* The owner's own calendar. A reversed pair is swapped by
     * orderedCustom (the window never lies about which end is which); a
     * missing or malformed pair falls back to the last 7 days — belt and
     * braces, since the inputs arm pre-filled. A single-day custom
     * (from === to) is today-style: one day, start to exclusive end. */
    const pair = custom ? orderedCustom(custom) : null;
    if (pair) return { startMs: appDayStartMs(pair[0]), endMs: appDayEndMs(pair[1]) };
    return lastNDaysMs(7);
  }
  const days = range === 'today' ? 1 : range === '7d' ? 7 : 30;
  return lastNDaysMs(days);
}

/** The EQUAL-LENGTH window immediately before the current one (v5.19.0) —
 *  the honest baseline for the KPI delta chips. 'all' has no earlier
 *  boundary in the ledger, so it gets NO chips rather than a fake baseline. */
export function priorWindow(range: RangeKey, custom?: CustomRange): { startMs: number; endMs: number } | null {
  if (range === 'all') return null;
  const { startMs, endMs } = rangeWindow(range, custom);
  if (range === 'custom') {
    /* The equal-length window immediately before the owner's own span
     * (the same honest baseline the fixed ranges quote): N midnights back
     * from the window's start, same shape (start inclusive, end
     * exclusive). Both bounds are reporting-day midnights, so the stride
     * is exact. The null guard is structural: every custom path resolves
     * a real start — it can never fire. */
    if (startMs === null) return null;
    const spanDays = Math.max(1, Math.round((endMs - startMs) / 86_400_000));
    return { startMs: startMs - spanDays * 86_400_000, endMs: startMs };
  }
  const days = range === 'today' ? 1 : range === '7d' ? 7 : 30;
  const start = startMs ?? appDayStartMs(shiftDayIso(-(days - 1)));
  return { startMs: appDayStartMs(shiftDayIso(-(2 * days - 1))), endMs: start };
}

/** Spoken/written name of the comparison baseline. */
export function priorRangeLabel(range: RangeKey, custom?: CustomRange): string | null {
  if (range === 'all') return null;
  if (range === 'custom' && custom) {
    /* The baseline speaks the span it actually compared: an equal-length
     * window, so "vs prior N days" is true by construction (N === 1 says
     * "prior day", the single-day voice). The null guard is structural:
     * every custom path resolves a real start. */
    const { startMs, endMs } = rangeWindow(range, custom);
    if (startMs === null) return null;
    const spanDays = Math.max(1, Math.round((endMs - startMs) / 86_400_000));
    return spanDays === 1 ? 'prior day' : `prior ${spanDays} days`;
  }
  return range === 'today' ? 'prior day' : range === '7d' ? 'prior 7 days' : 'prior 30 days';
}

/** The range's spoken name everywhere (captions, CSVs, the print header,
 *  the share texts): the fixed keys keep their words byte-true; the custom
 *  range speaks the DATES the owner chose ("2 Oct – 5 Oct"; a single day
 *  says just "2 Oct"). */
export function rangeLabelOf(range: RangeKey, custom?: CustomRange): string {
  if (range !== 'custom' || !custom) return RANGE_LABEL[range];
  const fmt = (iso: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(iso)
      ? appFormatters().dayLabel.format(new Date(appDayStartMs(iso)))
      : '';
  const from = fmt(custom.from);
  const to = fmt(custom.to);
  if (!from || !to) return RANGE_LABEL.custom;
  return from === to ? from : `${from} – ${to}`;
}

/** Calendar-string day shift from today, DST-safe (noon anchor, v5.83.0's
 *  argument). The prior-window builder and the screen's custom-input
 *  defaults (last 7 days pre-fill) both ask it.
 *
 *  v5.240.0 — the shift takes the suites' seam (228's doctrine): an
 *  optional `now` flows through so rangeSpanOf's proof is deterministic
 *  in any runner. The bare form stays byte-true — every existing caller
 *  keeps its words. */
export function shiftDayIso(days: number, now: Date = new Date()): string {
  const d = new Date(`${appTodayIso(appTimezone(), now)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** v5.240.0 — the bounded fixed window's own dates, spoken as THE span
 *  phrase ("29 Sept – 5 Oct"; a single day says just its date). The
 *  5.236/5.238 label law reaching the FIXED keys: a window a word alone
 *  cannot verify (the rolling-vs-calendar fossil the chase just paid —
 *  "Last 7 days" meant two different windows in two rooms) speaks the
 *  dates it actually holds. ONE derivation, no fork: the pair is the
 *  window lastNDaysMs builds, as calendar strings through the same noon
 *  anchor (shiftDayIso(-(days-1)) — the exact arithmetic, the same
 *  builder the Custom row arms pre-filled); the phrase is THE span
 *  builder (rangeLabelOf's house formatter). Reports' fixed captions
 *  keep their chip words — not this round's reach. */
export function rangeSpanOf(range: 'today' | '7d' | '30d', now: Date = new Date()): string {
  const days = range === 'today' ? 1 : range === '7d' ? 7 : 30;
  return rangeLabelOf('custom', { from: shiftDayIso(-(days - 1), now), to: appTodayIso(appTimezone(), now) });
}
