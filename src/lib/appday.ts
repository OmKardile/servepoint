/* ── The reporting day, as the OWNER's word (5.97.0) ───────────────────────
 *
 *   Settings › Language & Region promises "Timestamps in reports and
 *   shifts" follow the chosen timezone. Until now that word was decorative:
 *   prefs.timezone was written on save and read by NOTHING — Reports, the
 *   Close-out book, the COGS day-bounds and the floor rhythm all hardcoded
 *   Asia/Kolkata while day.ts (bills, boards, strip) reads the DEVICE's
 *   clock. Two day-truths, neither of them the setting's.
 *
 *   This lib makes the reporting day one shared truth that follows the
 *   setting: day keys, day windows, hour buckets and the "IST" word itself
 *   all resolve through appTimezone() here. The seam stays honest and
 *   documented:
 *
 *   • the DEVICE day (src/lib/day.ts) — bills, KDS, counter, strip. A
 *     cashier's wall clock belongs to the device they hold; the setting's
 *     own description never promised these.
 *   • the REPORTING day (this lib) — Reports, Close-out, COGS bounds, the
 *     floor's rhythm and printed slips. The owner's word rules.
 *
 *   On every Indian device both truths say IST — the default — so this lib
 *   changes nothing for the real tenant; it only keeps the promise when the
 *   owner says otherwise.
 *
 *   Day arithmetic carries v5.83.0's proven noon-anchor argument,
 *   generalized: anchor at NOON in the target zone (safely inside the
 *   calendar day), never at midnight where a zone's offset can push the
 *   instant onto the neighbouring UTC date. DST zones get one refinement
 *   pass — the offset is re-measured at the resulting midnight instant.
 */

import { getPrefs } from './prefs';

export const DEFAULT_TZ = 'Asia/Kolkata';

function isValidTz(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The timezone the owner chose — Settings' word, validated. */
export function appTimezone(): string {
  const tz = getPrefs().timezone;
  return tz && isValidTz(tz) ? tz : DEFAULT_TZ;
}

/** Offset (ms) of `tz` at the instant `at`: wall-clock-as-UTC minus instant. */
export function tzOffsetMs(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const m: Record<string, string> = {};
  for (const p of parts) if (p.type !== 'literal') m[p.type] = p.value;
  const wall = Date.UTC(
    Number(m.year),
    Number(m.month) - 1,
    Number(m.day),
    Number(m.hour) % 24,
    Number(m.minute),
    Number(m.second),
  );
  return wall - at.getTime();
}

/** UTC ms of midnight of `dateIso` in `tz` — noon-anchored, DST-refined. */
export function appDayStartMs(dateIso: string, tz: string = appTimezone()): number {
  const noonUtc = new Date(`${dateIso}T12:00:00Z`).getTime();
  const off = tzOffsetMs(new Date(noonUtc), tz);
  let start = noonUtc - off - 12 * 3600 * 1000;
  const off2 = tzOffsetMs(new Date(start), tz);
  if (off2 !== off) start = noonUtc - off2 - 12 * 3600 * 1000;
  return start;
}

/** UTC ms of the midnight that ENDS `dateIso` in `tz` — the next day's
 *  start, exact even on 23h/25h DST days (a +24h guess would lie there). */
export function appDayEndMs(dateIso: string, tz: string = appTimezone()): number {
  const d = new Date(`${dateIso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return appDayStartMs(d.toISOString().slice(0, 10), tz);
}

/** [00:00, next 00:00) ISO window of a calendar day in `tz`. */
export function appDayBoundsIso(
  dateIso: string,
  tz: string = appTimezone(),
): { startIso: string; endIso: string } {
  return {
    startIso: new Date(appDayStartMs(dateIso, tz)).toISOString(),
    endIso: new Date(appDayEndMs(dateIso, tz)).toISOString(),
  };
}

/** YYYY-MM-DD of "now" in `tz` (en-CA gives calendar order). */
export function appTodayIso(tz: string = appTimezone()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** YYYY-MM-DD bucket key for an instant in `tz` — the trends/day-book key. */
export function appDayKey(iso: string, tz: string = appTimezone()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

/** Hour-of-day (0–23) in `tz` for an ISO timestamp. */
export function appHour(iso: string, tz: string = appTimezone()): number {
  const h = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    hour12: false,
  }).format(new Date(iso));
  return Number(h) % 24;
}

/** The zone's spoken tag: "IST" stays "IST" (the word every ledger already
 *  prints); other zones speak Intl's short name ("GMT+4" for Dubai). */
export function appTzTag(tz: string = appTimezone()): string {
  if (tz === DEFAULT_TZ) return 'IST';
  try {
    const parts = new Intl.DateTimeFormat('en-IN', {
      timeZone: tz,
      timeZoneName: 'short',
    }).formatToParts(new Date());
    const tag = parts.find((p) => p.type === 'timeZoneName')?.value;
    return tag || tz;
  } catch {
    return tz;
  }
}

/** UTC ms of a wall-clock time ("HH:MM") on `dateIso` in `tz` — the instant
 *  the OWNER'S clock means (5.98.0: bookings speak the reporting clock too).
 *  DST-safe: with a constant offset the noon-anchored midnight plus the
 *  wall minutes is already exact; across a zone's spring-forward/fall-back
 *  the offset is re-measured at the resulting instant and the difference
 *  applied once, landing on the zone's own moment — never a fabricated
 *  hour. */
export function appWallToInstant(
  dateIso: string,
  wall: string,
  tz: string = appTimezone(),
): number {
  const [hh, mm] = wall.split(':').map((n) => Number.parseInt(n, 10));
  const wantMin =
    (Number.isFinite(hh) ? hh : 0) * 60 + (Number.isFinite(mm) ? mm : 0);
  const dayStart = appDayStartMs(dateIso, tz);
  let x = dayStart + wantMin * 60000;
  const offAtStart = tzOffsetMs(new Date(dayStart), tz);
  const off = tzOffsetMs(new Date(x), tz);
  if (off !== offAtStart) x = dayStart + wantMin * 60000 + (offAtStart - off);
  return x;
}

/* ── Memoized report formatters — rebuilt only when the owner's word
      changes, so a Settings save takes effect on the next render without
      a reload and without rebuilding Intl objects per row. ─────────────── */

export interface AppFormatters {
  /** "3 Oct, 7:28 pm" — stamp voice for rows and tooltips. */
  dt: Intl.DateTimeFormat;
  /** "3 Oct" — day-by-day bar label. */
  dayLabel: Intl.DateTimeFormat;
  /** "3 Oct, 7:28 pm" variant used where the close hour must show. */
  closeLabel: Intl.DateTimeFormat;
  /** "03 Oct 2026" — printed sticker dates. */
  stickerDate: Intl.DateTimeFormat;
  /** HH:MM 24h — slips and shift clocks. */
  hhmm: Intl.DateTimeFormat;
}

let fmtTz = '';
let fmtCache: AppFormatters | null = null;

export function appFormatters(tz: string = appTimezone()): AppFormatters {
  if (fmtCache && fmtTz === tz) return fmtCache;
  fmtCache = {
    dt: new Intl.DateTimeFormat('en-IN', {
      timeZone: tz,
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }),
    dayLabel: new Intl.DateTimeFormat('en-IN', {
      timeZone: tz,
      day: 'numeric',
      month: 'short',
    }),
    closeLabel: new Intl.DateTimeFormat('en-IN', {
      timeZone: tz,
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }),
    stickerDate: new Intl.DateTimeFormat('en-IN', {
      timeZone: tz,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    hhmm: new Intl.DateTimeFormat('en-IN', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
  };
  fmtTz = tz;
  return fmtCache;
}
