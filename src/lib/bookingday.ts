/* ── The booking voice — one clock for the promise (5.105.0) ──────────────
 *
 *   Three surfaces spoke the booking's hour, and they had drifted:
 *
 *   • the floor's book (FloorScreen) — label followed the OWNER's reporting
 *     timezone since 5.97/5.98;
 *   • the bell's echo (NotificationsScreen) — `ECHO_TZ = 'Asia/Kolkata'`
 *     hardcoded at v5.88.0;
 *   • the guest drawer's book voice (CustomersScreen) — `BOOK_TZ =
 *     'Asia/Kolkata'` hardcoded, "byte-matched to FloorScreen" the day it
 *     was written.
 *
 *   The drift is not cosmetic: the reminder bell's body is composed IN THE
 *   DATABASE, fixed to Asia/Kolkata (migrations 030/032 — the trigger
 *   decomposes slot_at in IST and fires only when the booking is TODAY in
 *   IST). The echo's matcher compares that DB-composed label against the
 *   book's client label — so on any device whose reporting timezone is not
 *   IST, the two voices disagreed and the echo went silent (honest silence,
 *   but a broken promise-matcher all the same).
 *
 *   The truth the round settles: THE BOOKING CLOCK IS THE DATABASE'S CLOCK.
 *   The promise's voice must equal the bell's voice everywhere, on every
 *   device. So this lib fixes the booking voice to Asia/Kolkata — the same
 *   word the trigger speaks — and the book, the echo and the guest drawer
 *   all call THESE helpers. On every Indian device (the default, the real
 *   tenant) the labels are byte-identical to what each screen said before.
 *
 *   The seam stays honest and documented:
 *   • the booking voice (this lib) — the book panel, the board's promise
 *     chips, the echo matcher, the guest drawer's book voice. The DB's word.
 *   • the reporting day (src/lib/appday.ts) — Reports, Close-out, COGS
 *     bounds, the floor's RHYTHM strip. The owner's day word rules there.
 *   • the device day (src/lib/day.ts) — bills, KDS, counter, strip.
 *
 *   Composition keeps 5.98.0's word: slot_at is composed from the host's
 *   wall inputs via appWallToInstant (the owner's reporting clock). The
 *   PROMISE'S VOICE then reads it back in the DB's clock — and when the two
 *   disagree, the UI says so (`bookingTzIsForeign()`): the promise chip and
 *   the host banner append "IST" so nobody misreads which clock speaks.
 */

import { appTimezone } from './appday';

/** The booking clock — the database's own word (migrations 030/032 compose
 *  and fire the reminder bell in this zone). IST has no DST, so day
 *  arithmetic here is exact. */
export const BOOKING_TZ = 'Asia/Kolkata';

/** "7:30 pm" — the booking voice: en-IN · 12-hour · lowercase · IST.
 *  Byte-equal to the DB trigger's ltrim(HH12:MI am) shape for every real
 *  slot, and to what the echo matcher has compared against since v5.88.0. */
export function bookingSlotLabel(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: BOOKING_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(new Date(iso))
    .toLowerCase();
}

/** YYYY-MM-DD of an instant, in the booking clock — the book's day-group key. */
export function bookingDayKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BOOKING_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

/** Today's YYYY-MM-DD in the booking clock — "is the promise today?" key. */
export function bookingTodayKey(): string {
  return bookingDayKey(new Date().toISOString());
}

/** UTC ms of midnight of `dateIso` in the booking clock. IST's offset is a
 *  constant +05:30 (no DST), so UTC midnight minus 330 minutes is exact —
 *  no noon-anchor dance needed. The book's day-window bounds. */
export function bookingDayStartMs(dateIso: string): number {
  return Date.parse(`${dateIso}T00:00:00Z`) - 330 * 60 * 1000;
}

/** "Sat 3 Oct" — the booking clock's day tag for a promise whose day is
 *  NOT the reader's today (5.200.0): the bell's body speaks the trigger's
 *  frozen hour with no day, so a row read a day later reads like tonight's
 *  promise. The tag rides the same IST clock the slot's hour speaks —
 *  one clock, one voice, every surface. (en-GB parts — the weekday rides
 *  the date comma-free, unlike en-IN's "Sat, 3 Oct".) */
export function bookingDayTag(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BOOKING_TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso));
}

/** "14:32" — the stock diary's row clock (v5.266.0). The diary's day
 *  headers group by THIS lib's day keys (5.162.0: the booking clock, the
 *  same key the bell feed groups on) — but the rows' times rendered the
 *  DEVICE's clock in an unpinned locale, so on any device outside IST a
 *  row could contradict its own group header, and the same house spoke
 *  "2:45 PM" on one tablet and "14:45" on another. The row clock now
 *  rides the SAME clock its day key rides, in the house's own 24h shape
 *  (en-IN · hour12:false — byte-equal to the appFormatters hhmm shape,
 *  anchored to the DB's booking clock instead of the device's). */
export function bookingClockLabel(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: BOOKING_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

/** True when the owner's reporting timezone is NOT the booking clock — the
 *  surfaces append the "IST" tag to promise labels so the two words are
 *  never confused. On every Indian device this is false and the UI is
 *  byte-identical to before. */
export function bookingTzIsForeign(): boolean {
  return appTimezone() !== BOOKING_TZ;
}

/* ── The ONE promise verdict (5.221.0) — lifted home from FloorScreen ──────
 *  The book's advertising rule (who speaks, who went quiet) lived inside
 *  FloorScreen.tsx since v5.84.0; the Dashboard's arrivals slot needed the
 *  SAME verdict for its own rows, and a copy would have been a second book
 *  rule — the one thing the house never allows (5.211: the body moves home
 *  to the clock it already owns, every surface imports it). The verdicts
 *  judge on the clocks they are GIVEN (nowMs + todayKey — 228's seam), so
 *  a suite can prove the words on pinned time.
 *
 *  The row is judged structurally (status + slot_at is ALL the verdict
 *  reads), so this lib stays dependency-free and fixtures stay plain. ── */

/** A promise-shaped row — structurally Reservation (lib/api), nothing more. */
export type PromiseRow = { status: string; slot_at: string };

/** The book's amber line: a promise due inside this many minutes advertises
 *  with the PromiseChip's amber (the host should start watching the door). */
export const PROMISE_DUE_SOON_MIN = 45;

/** A promise that still advertises: `booked`, TODAY in the booking clock,
 *  slot not yet gone. A seated, no-show or cancelled row never speaks, and
 *  yesterday's promises have already kept (or broken) themselves — they
 *  don't either. */
export function isLivePromise(r: PromiseRow, nowMs: number, todayKey: string): boolean {
  if (r.status !== 'booked') return false;
  if (bookingDayKey(r.slot_at) !== todayKey) return false;
  return new Date(r.slot_at).getTime() >= nowMs;
}

/** v5.86.0 — a promise that WENT QUIET: still `booked`, still today in the
 *  booking clock, but the promised hour has passed without anyone sitting
 *  them down. The book does not call it a no-show — a party can be ten
 *  minutes late, and the verdict is the host's, not the clock's. It just
 *  refuses to pretend the hour is still ahead. */
export function isQuietPromise(r: PromiseRow, nowMs: number, todayKey: string): boolean {
  if (r.status !== 'booked') return false;
  if (bookingDayKey(r.slot_at) !== todayKey) return false;
  return new Date(r.slot_at).getTime() < nowMs;
}

/** v5.225.0 — the ARCHIVE's verdict: a booked promise whose hour has passed,
 *  whatever day it was promised for. The board keeps its today-gated silence
 *  (isQuietPromise — it advertises arrivals, and 5.86 was right that a past
 *  promise is not an arrival); the book's past week is a different room —
 *  the host goes there to RECONCILE, and a two-day-old promise still wearing
 *  the gold "Booked" is the ledger speaking where the clock has already
 *  answered. Same convict-free boundary: the hour went by, nobody sat them;
 *  the verdict stays the host's, the words stay "went quiet". */
export function isQuietPromiseAnyDay(r: PromiseRow, nowMs: number): boolean {
  if (r.status !== 'booked') return false;
  return new Date(r.slot_at).getTime() < nowMs;
}

/** Minutes until the slot, rounded up (a slot 30s away is still 1 min). */
export function minsUntil(iso: string, nowMs: number): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - nowMs) / 60000));
}
