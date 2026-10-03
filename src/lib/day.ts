/* ── The day, as ONE shared truth (5.92.0) ─────────────────────────────────
 *
 *   "Is this ticket from today?" started life inside the KDS board and the
 *   counter's inbox, came to the dashboard's strip in 5.89.0 (the strip
 *   stopped counting yesterday's ghosts as tonight's alarms), and now Bills
 *   must speak the day too — the strip whispers "4 older tickets — see
 *   Bills", and until now Bills answered with a bare "17:28" that read like
 *   today. The room the door opens finishes the sentence, or the sentence
 *   is a lie.
 *
 *   Four byte-identical copies of isSameLocalDay lived across Kitchen,
 *   CounterInbox, Bills and Dashboard (v5.65.0 → v5.89.0); they all read
 *   this lib now, so "today" can never mean one thing on the board and
 *   another on the strip.
 *
 *   Grammar (matches the strip's 5.89.0 whisper voice):
 *   • today            → the bare clock, as always ("17:28") — today needs
 *     no introduction;
 *   • yesterday        → "Yesterday 17:28" — the word beats a date math
 *     the reader must do;
 *   • older            → "2 Oct · 17:28" — the calendar, en-IN, no year
 *     (the ledger's year lives in the CSV export and the timeline);
 *   • an unparseable timestamp renders "—", never a fake date.
 */

/** Local-day equality — the one test every "today" in the app uses. */
export function isSameLocalDay(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}

/** True when the timestamp falls on yesterday's calendar day (local). */
export function isYesterday(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return d.toDateString() === y.toDateString();
}

/** Bare local HH:MM — the clock the whole app already speaks. */
export function hhmm(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** The day word for a timestamp: '' today, 'Yesterday', or a short en-IN
 *  calendar date ("2 Oct") for anything older. */
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  if (isSameLocalDay(iso)) return '';
  if (isYesterday(iso)) return 'Yesterday';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(d);
}

/** The day-aware clock a row speaks: "17:28" today, "Yesterday 17:28",
 *  "2 Oct · 17:28" older, "—" when the timestamp is unreadable. The middot
 *  only joins a calendar date — "Yesterday" keeps the plain space, the way
 *  the strip already says it. */
export function dayTime(iso: string): string {
  const label = dayLabel(iso);
  if (!label) return hhmm(iso);
  if (label === 'Yesterday') return `${label} ${hhmm(iso)}`;
  return `${label} · ${hhmm(iso)}`;
}
