/**
 * The ONE session clock (v5.220.0) — lifted home from the Floor screen.
 *
 * Migration 002's ephemeral 10-minute QR sessions carry a `status` column
 * that stays 'active' after ordinary expiry (only revoke/consume paths write
 * it back), so LIVE vs EXPIRED is derived from the clock: expires_at vs now.
 * That rule lived inside FloorScreen.tsx since v5.23.0; the Dashboard's QR
 * chip (v5.220.0) needed the SAME verdict, and a copy would have been a
 * second liveness rule — the one thing the house never allows (5.211: the
 * body moves home, every surface imports it).
 *
 * The optional `nowMs` is the suites' seam (228's rule): every predicate
 * judges on the clock it is GIVEN, never the wall behind it.
 */
import type { TableSession } from './api';

export type SessionState = 'live' | 'expired' | 'consumed' | 'revoked';

export function sessionState(s: TableSession, nowMs: number = Date.now()): SessionState {
  if (s.status === 'consumed') return 'consumed';
  if (s.status === 'revoked') return 'revoked';
  return new Date(s.expires_at).getTime() > nowMs ? 'live' : 'expired';
}

export const SESSION_TONE: Record<SessionState, { dot: string; fg: string; label: string }> = {
  live: { dot: '#0F3D3E', fg: '#0F3D3E', label: 'menu open' },
  expired: { dot: '#969696', fg: '#6B6B6B', label: 'expired' },
  consumed: { dot: '#2E7D32', fg: '#2E7D32', label: 'used' },
  revoked: { dot: '#B3261E', fg: '#B3261E', label: 'cut' },
};

/** Live windows across ALL tables — the Dashboard chip's count and the
 *  drill's per-table filter ride the same predicate. */
export function liveWindows(rows: TableSession[], nowMs: number = Date.now()): TableSession[] {
  return rows.filter((s) => sessionState(s, nowMs) === 'live');
}

/** Live windows on ONE table (5.217.0) — the free action's disclosure count.
 *  Same clock-derived rule; the free button names how many windows end with
 *  the seating, so the owner confirms with both effects in view. */
export function liveWindowsOf(rows: TableSession[], tableId: string, nowMs: number = Date.now()): TableSession[] {
  return rows.filter((s) => s.table_id === tableId && sessionState(s, nowMs) === 'live');
}

/** The youngest live window's remaining ms (5.219.0) — the warm grammar's
 *  arithmetic, shared by the Floor card's pill and the Dashboard's QR slot.
 *  Seeds at Infinity so an EMPTY set never lies (Infinity is never inside
 *  the three-minute line); the live filter guarantees every remainder is
 *  positive, so the result is either Infinity or honest remaining time —
 *  the display clamp (formatWindowLeft) owns zero.
 *
 *  5.221.0 — the minimum itself is ONE rule with two names: the WINDOW is
 *  the row (the Dashboard's warm hint names the table the dying window
 *  holds), and the MS composes the window (5.211 — the arithmetic lives
 *  once; the second name is a read, never a second reduce). The Infinity
 *  seed keeps its post: an empty set yields null / Infinity and never
 *  reads warm. */
export function youngestLiveWindow(rows: TableSession[], nowMs: number = Date.now()): TableSession | null {
  let youngest: TableSession | null = null;
  for (const s of liveWindows(rows, nowMs)) {
    if (!youngest || new Date(s.expires_at).getTime() < new Date(youngest.expires_at).getTime()) youngest = s;
  }
  return youngest;
}

export function youngestLiveMs(rows: TableSession[], nowMs: number = Date.now()): number {
  const youngest = youngestLiveWindow(rows, nowMs);
  return youngest ? new Date(youngest.expires_at).getTime() - nowMs : Infinity;
}

/** v5.223.0 — the week's opened-window count. The rhythm's "Menu windows ·
 *  7d" tile reads this: a scan's session row IS an opened window, counted
 *  by its own created_at inside the SAME reporting window the seated-rounds
 *  census draws ([startMs, endMs) — the exact bounds, so the look count and
 *  the work count can never draw from different weeks). An unreadable
 *  instant is ledger noise, skipped; the count is a raw look count — the
 *  tile says nothing about what became of it (5.222's per-table trail owns
 *  that story day by day). */
export function sessionsInWindow(
  sessions: { created_at: string }[],
  startMs: number,
  endMs: number,
): number {
  let n = 0;
  for (const s of sessions) {
    const t = new Date(s.created_at).getTime();
    if (Number.isFinite(t) && t >= startMs && t < endMs) n += 1;
  }
  return n;
}
