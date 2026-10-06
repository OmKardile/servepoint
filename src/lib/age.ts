/* ── age.ts — the wait's ONE register (v5.279.0) ─────────────────────────
   The house asks one question on many surfaces — "how long has THIS ticket
   been waiting?" — and by 5.278 the answer was spoken in hand-rolled
   grammars beside each other:

   · the counter's inbox rolled its own ageMinutes + ageLabel, whose minute
     word was "5 min" while the floor's TimeAgo said "5m" for the SAME
     ticket's age — twins disagreeing about one wait (the money census's
     exact shape, one round later);
   · the floor's TimeAgo re-rolled the same math a second time;
   · prefs.timeAgo — the LONG register ("3 minutes ago", the narrative
     voice Messages/Platform/Notifications speak) — lived in the prefs lib,
     where no preference ever asked for it.

   The deliberate registers stand untouched, each with its own doctrine:
   turn.ts's seatSpanLabel is the FINISHED seat's span ("<1m" — a span,
   never a state); shelf.ts's "today / Nd ago" is the coverage register;
   the kitchen stopwatch's m:ss and Reports' "6m 40s" are seconds-true
   voices; the guest's age words live in the guest's translated i18n home.

   THIS lib is the live wait's home, importing NOTHING:

   · ONE span grammar — ageSpan, "5m · 1h 12m", byte-identical to
     turn.ts's seatSpanLabel at every real duration (≥1m). Two libs, two
     questions, one voice: a finished seat and a waiting ticket speak the
     same minute words because the house reads them the same way.
   · ONE state word — ageCompact speaks "just now" under a minute (a
     state, not a span — turn.ts's own doctrine, kept).
   · ONE long register — ageLong, the narrative voice ("Just now /
     3 minutes ago / 2 hours ago / 1 day ago"), moved here from prefs.
   · ONE attention line — AGE_SLA_MIN, the house's 10-minute SLA. The
     kitchen board's amber (waitTone), the EOD strip's LATE_PREP mirror,
     Reports' breach count and the counter's red line all used the number;
     now the number has ONE home — raise the house's line in one edit. */

/** Whole minutes a ticket has waited (never negative — a ledger row that
 *  stamps after `now` waited zero minutes, not minus some). */
export function ageMinutes(iso: string, nowMs: number): number {
  return Math.max(0, (nowMs - new Date(iso).getTime()) / 60_000);
}

/** The span words for a whole minute count — "5m" / "1h 12m". Floor is
 *  the register's floor too: a span starts at one minute; the sub-minute
 *  state word ("just now") is ageCompact's to speak, and turn.ts's "<1m"
 *  is the FINISHED seat's. */
export function ageSpan(mins: number): string {
  const m = Math.max(1, Math.floor(mins));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

/** The live wait's compact voice — "just now" under a minute, then the
 *  span words ("5m" / "1h 12m"). The counter's pill and the floor's
 *  TimeAgo read this: one wait, one register, twins agreeing again. */
export function ageCompact(iso: string, nowMs: number): string {
  const m = Math.floor(ageMinutes(iso, nowMs));
  return m < 1 ? 'just now' : ageSpan(m);
}

/** The narrative voice — "Just now" / "3 minutes ago" / "2 hours ago" /
 *  "1 day ago". prefs.timeAgo's new home (5.279.0): a wait is not a
 *  preference. `nowMs` optional so the unit suites own the clock. */
export function ageLong(iso: string, nowMs: number = Date.now()): string {
  const m = Math.floor(ageMinutes(iso, nowMs));
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

/** The house's attention line — 10 minutes. The kitchen board's amber
 *  escalation (waitTone), the EOD strip's "Late prep" mirror, Reports'
 *  breach count ("Over the 10-min SLA") and the counter's red pill all
 *  held the number by hand; this export is its ONE home. The kitchen's
 *  RED line (20m) stays the kitchen's own judgment — a second line, not
 *  a second opinion about this one. */
export const AGE_SLA_MIN = 10;
