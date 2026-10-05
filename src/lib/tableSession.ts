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
 *  the display clamp (formatWindowLeft) owns zero. */
export function youngestLiveMs(rows: TableSession[], nowMs: number = Date.now()): number {
  return liveWindows(rows, nowMs).reduce(
    (m, s) => Math.min(m, new Date(s.expires_at).getTime() - nowMs),
    Infinity,
  );
}
