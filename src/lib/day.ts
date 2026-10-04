/* ── The day, as ONE shared truth (5.92.0; tz-aware 5.179.0) ─────────────────
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
 *
 *   5.179.0 — the drawer's shifts join, and the lib learns to speak in a
 *   NAMED zone: every function grows an optional trailing `tz` — given, the
 *   day words and clocks compute in that zone through Intl; omitted, the
 *   visitor's own day (the family's machine-local convention, untouched for
 *   Bills / KDS / the strip). The reason is the drawer card: a shift is a
 *   REPORTING-TIMEZONE fact — the card's other clocks (istTime) and the
 *   "shifts closed today" bounds already resolve through appTimezone(), so
 *   its day words must too, on every device (an owner abroad must not read
 *   two zones on one card). The drawer passes appTimezone() explicitly; the
 *   default stays local so no existing caller moves.
 *
 *   5.179.0 — the drawer's shifts join: a SHIFT is a span of two clocks,
 *   and daySpan speaks it with the day word riding the open end once
 *   ("Yesterday 08:50–19:10"), both ends stamped when a shift crosses
 *   midnight. The drawer card was the last surface still rendering bare
 *   istTime for day-ambiguous facts — "Last shift closed 19:10" at 18:04
 *   was a shift from an earlier day wearing today's clock.
 */

/** Zoned wall-clock parts, cached per zone — the tz engine behind the
 *  optional `tz` path. Returns null for an unreadable timestamp. */
interface ZonedParts {
  key: string; // "y-m-d" — the day key in zone
  hh: string;
  mm: string;
}
const zoneFmtCache = new Map<string, Intl.DateTimeFormat>();
const labelFmtCache = new Map<string, Intl.DateTimeFormat>();
function partsIn(iso: string, tz: string): ZonedParts | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  let fmt = zoneFmtCache.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    zoneFmtCache.set(tz, fmt);
  }
  const p: Record<string, string> = {};
  for (const x of fmt.formatToParts(d)) p[x.type] = x.value;
  return { key: `${p.year}-${p.month}-${p.day}`, hh: p.hour, mm: p.minute };
}
function nowKeyIn(tz: string, offsetDays = 0): string {
  return partsIn(new Date(Date.now() + offsetDays * 86400000).toISOString(), tz)!.key;
}

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

/** Bare local HH:MM — the clock the whole app already speaks. With `tz`,
 *  the bare clock in that zone ("HH:MM in the reporting timezone" —
 *  istTime's own contract). "—" when the timestamp is unreadable. */
export function hhmm(iso: string, tz?: string): string {
  if (tz) {
    const p = partsIn(iso, tz);
    return p ? `${p.hh}:${p.mm}` : '—';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** The day word for a timestamp: '' today, 'Yesterday', or a short en-IN
 *  calendar date ("2 Oct") for anything older. With `tz`, all three judged
 *  in that zone. */
export function dayLabel(iso: string, tz?: string): string {
  if (tz) {
    const p = partsIn(iso, tz);
    if (!p) return '';
    if (p.key === nowKeyIn(tz)) return '';
    if (p.key === nowKeyIn(tz, -1)) return 'Yesterday';
    let fmt = labelFmtCache.get(tz);
    if (!fmt) {
      fmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: tz });
      labelFmtCache.set(tz, fmt);
    }
    return fmt.format(new Date(iso));
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  if (isSameLocalDay(iso)) return '';
  if (isYesterday(iso)) return 'Yesterday';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(d);
}

/** The day-aware clock a row speaks: "17:28" today, "Yesterday 17:28",
 *  "2 Oct · 17:28" older, "—" when the timestamp is unreadable. The middot
 *  only joins a calendar date — "Yesterday" keeps the plain space, the way
 *  the strip already says it. With `tz`, the whole grammar judges in that
 *  zone (the drawer card passes the reporting timezone). */
export function dayTime(iso: string, tz?: string): string {
  const label = dayLabel(iso, tz);
  if (!label) return hhmm(iso, tz);
  if (label === 'Yesterday') return `${label} ${hhmm(iso, tz)}`;
  return `${label} · ${hhmm(iso, tz)}`;
}

/** The day-aware span a SHIFT speaks (5.179.0, the drawer's days): a shift
 *  is two clocks — opened → closed — and until now both were bare, so a
 *  "19:10" read like tonight's while the drawer had been closed for days.
 *  The day word rides the OPEN end once for a same-day span: "08:50–19:10"
 *  today (byte-identical with every span already rendered), "Yesterday
 *  08:50–19:10", "2 Oct · 08:50–19:10" older; a shift that crosses midnight
 *  stamps both ends the dayTime way ("Yesterday 23:50–00:40", "2 Oct ·
 *  23:50–3 Oct · 00:40"). An unreadable or missing close renders "—" at
 *  that end — never a fake time. With `tz`, the span lives in that zone —
 *  the drawer passes the reporting timezone, because a shift closed 01:00
 *  IST is TODAY'S shift in the cafe even when the device's own day says
 *  otherwise. */
export function daySpan(openIso: string, closeIso: string | null | undefined, tz?: string): string {
  const open = dayTime(openIso, tz);
  if (!closeIso) return `${open}–—`;
  const sameDay = (() => {
    if (tz) {
      const a = partsIn(openIso, tz);
      const b = partsIn(closeIso, tz);
      return a !== null && b !== null && a.key === b.key;
    }
    const a = new Date(openIso);
    const b = new Date(closeIso);
    return (
      !Number.isNaN(a.getTime()) && !Number.isNaN(b.getTime()) && a.toDateString() === b.toDateString()
    );
  })();
  if (!sameDay) return `${open}–${dayTime(closeIso, tz)}`;
  const label = dayLabel(openIso, tz);
  if (!label) return `${hhmm(openIso, tz)}–${hhmm(closeIso, tz)}`;
  if (label === 'Yesterday') return `${label} ${hhmm(openIso, tz)}–${hhmm(closeIso, tz)}`;
  return `${label} · ${hhmm(openIso, tz)}–${hhmm(closeIso, tz)}`;
}
