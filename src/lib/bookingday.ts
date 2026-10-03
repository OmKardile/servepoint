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

/** True when the owner's reporting timezone is NOT the booking clock — the
 *  surfaces append the "IST" tag to promise labels so the two words are
 *  never confused. On every Indian device this is false and the UI is
 *  byte-identical to before. */
export function bookingTzIsForeign(): boolean {
  return appTimezone() !== BOOKING_TZ;
}
