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

/* ── 5.202.0 — the last-N-days window, ONE builder ─────────────────────────
 * "Last N days" in this app means N calendar days of the REPORTING day
 * ending today (today inclusive) — the shape Reports' ranges have spoken
 * since v5.19.0. The movers' week (5.78.0) used to roll `now − N·24h`
 * instead: two windows both answering "this week / last 7 days", and as
 * the ledger aged past the boundary the Menu medallion's 30 and the
 * Reports rank's 25 answered the same question with different numbers.
 * One builder now owns the shape — Reports' rangeWindow and the movers'
 * moverWindow both delegate, so two surfaces quoting the week quote one
 * number (5.198's agreement, now structural instead of incidental). The
 * day shift anchors at NOON (v5.83.0's argument) and the bounds resolve
 * through this lib, so the owner's timezone word rules here too. */
export function lastNDaysMs(
  days: number,
  now: Date = new Date(),
): { startMs: number; endMs: number } {
  const today = appTodayIso(appTimezone(), now);
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return { startMs: appDayStartMs(d.toISOString().slice(0, 10)), endMs: appDayEndMs(today) };
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

/* ── 5.205.0 — the day-KEY sequence, sibling of lastNDaysMs ────────────────
 * A window answers "the money between two instants"; a bucket ROW answers
 * "which reporting day did this instant belong to". The dashboard's read
 * used to build BOTH halves from the BROWSER's clock — local midnights,
 * toDateString slices, getHours buckets — while every surface it points at
 * (Reports' ranges, Close-out's day fetch, the movers' window) resolves
 * through THIS lib. Two calendars answering one word: the morning paper
 * promised "the week so far reads ₹9,267.30" and the landing read
 * ₹8,112.30 — same morning, same ledger, live-caught. One builder now owns
 * the sequence: the last N reporting days' YYYY-MM-DD keys, oldest first,
 * ending today. Noon-anchored (the v5.83.0 argument), so the keys never
 * drift with the device they're computed on. */
export function lastNDayKeys(days: number, now: Date = new Date()): string[] {
  const today = appTodayIso(appTimezone(), now);
  const d = new Date(`${today}T12:00:00Z`);
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const t = new Date(d);
    t.setUTCDate(t.getUTCDate() - i);
    keys.push(t.toISOString().slice(0, 10));
  }
  return keys;
}

/** YYYY-MM-DD of "now" in `tz` (en-CA gives calendar order). The optional
 *  `now` is the suites' seam — day windows are pinned, not hoped (5.202.0). */
export function appTodayIso(tz: string = appTimezone(), now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
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

/* v5.239.0 — the ticket rooms' ONE "today". Bills' filter and chase gates,
 * the Dashboard's older split, the counter inbox's queue and the Kitchen's
 * quiet line all ask "is this ticket from today" — and until now each asked
 * the BROWSER's local day (lib/day's isSameLocalDay), so a browser outside
 * the cafe's zone answered a different day than the Close-out's book and
 * Reports' windows (which already speak the app clock). One clock now: the
 * cafe's own. The explicit-clock twin (228's doctrine): suites own now,
 * predicates stay deterministic; the bare one-arg form delegates. The
 * local-clock twins stay in lib/day for the reader-register voices (chat
 * day dividers, last-seen labels) — those label the READER's day. */
export function isSameAppDayAs(iso: string, nowMs: number, tz: string = appTimezone()): boolean {
  return appDayKey(iso, tz) === appDayKey(new Date(nowMs).toISOString(), tz);
}

/* v5.243.0 — the news census's SERVER word. The straggler census
 * (staleNewTickets) rode two differently-capped page reads (the Dashboard's
 * 200, the counter's 100): the day a `new` ticket slides past the newest
 * page, both whispers quietly undercount — the 5.240 disease in the news
 * register (the watch item 281 named). The fix speaks the census where the
 * rows live: "off today" is computable server-side as the disjunction
 * created_at < startIso OR created_at >= endIso, where [startIso, endIso)
 * are the bounds of the app-today CONTAINING `nowMs`. Byte-equal to the
 * client's isSameAppDayAs by construction — same day iff the instant sits
 * inside [start, end) — so the whole-book head-count and the page census
 * can never disagree about what "off today" means, at any scale. The
 * explicit clock (228's doctrine): suites own now, the bare form delegates. */
export function offTodayBoundsIso(
  nowMs: number = Date.now(),
  tz: string = appTimezone(),
): { startIso: string; endIso: string } {
  return appDayBoundsIso(appTodayIso(tz, new Date(nowMs)), tz);
}

export function isSameAppDay(iso: string, tz: string = appTimezone()): boolean {
  return isSameAppDayAs(iso, Date.now(), tz);
}

/* v5.241.0 — the inbox stragglers' ONE census. A `new` ticket that is NOT
 * from today never reached the counter's gate as its news (the inbox lists
 * TODAY's new tickets only), and until now the Dashboard counted them alone
 * in a whisper while the room that owns the inbox said nothing. One census,
 * two rooms: the Dashboard's "stuck off today's inbox" whisper and the
 * counter's own straggler band ask THIS function — one predicate, one sort,
 * one number. The verdict is "off today" — NOT-today, the whisper's own
 * grammar, preserved byte-for-byte (a future-dated created_at is corrupt
 * data, but it was never today's news either; the census does not quietly
 * forgive it). The clock is the ticket rooms' ONE "today" (isSameAppDayAs,
 * the cafe's own day); the explicit-clock twin keeps the suite
 * deterministic in any runner (228's doctrine). Oldest first: the chase
 * reads top-down, the stuck-est waits longest. Status IS the population:
 * 'new' excludes 'cancelled' by construction (one status per ticket), so
 * no second cancelled filter. */
export function staleNewTickets<T extends { status: string | null; created_at: string }>(
  orders: readonly T[] | null | undefined,
  nowMs: number = Date.now(),
): T[] {
  return (orders ?? [])
    .filter((o) => String(o.status) === 'new' && !isSameAppDayAs(o.created_at, nowMs))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
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

/** The window's warm band — the ONE threshold every "closing soon" verdict
 *  speaks (5.251.0). The ribbon wore this number from birth (`totalSec < 180`)
 *  and 5.250.0's page machinery knew only the dead band (windowEnded); the
 *  warm band now lives HERE, beside formatWindowLeft, so the ribbon, the page
 *  and the cart's word all gate on the same constant — one window arithmetic,
 *  never two. (The Floor drill's map carries its own pinned literal — its
 *  voice is unit257's byte-truth; it can re-home here in a later round.) */
export const WARM_WINDOW_MS = 180_000;

/** The ONE window countdown grammar (5.218.0) — guest ribbon and the owner's
 *  Floor drill speak the same voice: "9:57", minutes unpadded, seconds padded,
 *  floored at 0:00. `msLeft` may be negative (a drifted clock, a stale tick) —
 *  the clamp is the honesty: a dead window never reads as time owed. */
export function formatWindowLeft(msLeft: number): string {
  const totalSec = Math.max(0, Math.floor(msLeft / 1000));
  const mm = String(Math.floor(totalSec / 60));
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
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
  /** "06 Oct 2026, 14:32" — the EXPORT stamp (v5.274.0): the day AND the
   *  time in one stable word for data leaving the house (CSV cells). */
  stamp: Intl.DateTimeFormat;
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
    stamp: new Intl.DateTimeFormat('en-IN', {
      timeZone: tz,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
  };
  fmtTz = tz;
  return fmtCache;
}

/* v5.274.0 — the export stamp. A CSV cell is data LEAVING the house: it
 * lands in the owner's accounting, a GST filing folder, a reconciliation
 * sheet — where it is read months later, on whatever machine opens it.
 * The bills and guests exports stamped those cells with the EXPORTING
 * DEVICE's toLocaleString() — no locale, no timezone pinned — so the same
 * order exported from the counter tablet and from the owner's phone spoke
 * two different shapes in two different clocks ("10/6/2026, 9:56:07 AM"
 * vs "06/10/2026, 09:56:07"), and a reconciliation never agreed with
 * itself. The stamp rides the reporting day's own voice (appTimezone(),
 * en-IN — the register every pinned render already shares) in the house's
 * 24h shape (hour12:false — the hhmm anchor), one stable word: the same
 * rows, exported from any device in the house, now read back byte-equal. */
export function appStampLabel(iso: string, tz: string = appTimezone()): string {
  return appFormatters(tz).stamp.format(new Date(iso));
}
