/**
 * The counter's shortlist (v5.78.0) — the store-wide sibling of the regular's
 * usual (5.74.0). The usual names what ONE guest keeps ordering; the shortlist
 * names what the whole ROOM keeps ordering. Same paid truth, wider window:
 *
 *   paid tickets only (isPaidTicket — status ≠ cancelled, payment completed),
 *   the last 7 REPORTING days (moverWindow — the ledger's week, 5.202.0),
 *   grouped per menu item, deterministic tie-breaks
 *   (units → tickets → rupees → name) so two reloads can never disagree.
 *
 * The rail is a speed surface, not a report: the counter taps a chip and the
 * line is in the cart — no category, no modal. This module owns the one
 * definition; the screen only renders it.
 *
 * 5.172.0 — the shelf's days: rank is a top-5 question (the rail pins five),
 * but PACE is a whole-menu question — the item sheet opens any dish, and the
 * shelf's days voice (src/lib/shelf.ts) divides a dish's coverage by its paid
 * pace. computePaceByItem reads the same ledger with the same rules, minus
 * the cap, so the rail and the days voice can never disagree about how fast
 * a dish sells.
 */
import type { OrderItem } from '../types';
import { lastNDaysMs } from './appday';

/** How far back the shortlist looks — REPORTING days (5.202.0): N calendar
 *  days ending today, the ledger's own week, not a private rolling
 *  now−N·24h. moverWindow() builds it through appday's one builder so the
 *  medallion's "this week" and Reports' "Last 7 days" are the same window
 *  and the same number. */
export const MOVER_WINDOW_DAYS = 7;

/** How many movers the rail pins. */
export const MOVER_LIMIT = 5;

/** One raw paid line — what fetchPaidMoverLines hands over from the ledger. */
export interface MoverRow {
  order_id: string;
  menu_item_id: string | null;
  name: string;
  qty: number;
  unit_price: number;
}

/** One shortlist entry, ready for the rail. */
export interface Mover {
  menuItemId: string;
  name: string;
  units: number;
  tickets: number;
  rupees: number;
}

/* The full paid-ledger aggregation, ranked, NO cap — one aggregation, two
 * questions read it (the rail's five via computeTopMovers, the whole menu's
 * pace via computePaceByItem). Private; the exports are the contract. */
function rankMovers(rows: MoverRow[]): Mover[] {
  const agg = new Map<string, { name: string; units: number; tickets: Set<string>; rupees: number }>();
  for (const r of rows) {
    /* Lines without a menu_item (deleted dishes, legacy rows) can still be
     * counted in the ledger, but the counter cannot sell them again — the
     * shortlist pins only what is on the live menu. */
    if (!r.menu_item_id) continue;
    const cur = agg.get(r.menu_item_id) || { name: r.name, units: 0, tickets: new Set<string>(), rupees: 0 };
    cur.units += r.qty;
    cur.tickets.add(r.order_id);
    cur.rupees += r.qty * Number(r.unit_price);
    agg.set(r.menu_item_id, cur);
  }
  return [...agg.entries()]
    .map(([menuItemId, v]) => ({ menuItemId, name: v.name, units: v.units, tickets: v.tickets.size, rupees: v.rupees }))
    .sort(
      (a, b) =>
        b.units - a.units ||
        b.tickets - a.tickets ||
        b.rupees - a.rupees ||
        a.name.localeCompare(b.name),
    );
}

export function computeTopMovers(rows: MoverRow[]): Mover[] {
  return rankMovers(rows).slice(0, MOVER_LIMIT);
}

/* ── 5.202.0 — the movers keep the ledger's week ──────────────────────────
 * The shortlist's window is no longer its own: moverWindow delegates to
 * appday's lastNDaysMs — the exact shape Reports' "Last 7 days" speaks
 * (N calendar days of the reporting day, today inclusive). Before this,
 * the fetch rolled `now − N·24h`, so the medallion, the rail chips and
 * the shelf's pace quoted "this week" over one window while Reports'
 * rank quoted the ledger's week over the other — 30 sold on the Menu,
 * 25 on Reports, both true to their own math and neither wrong alone;
 * the disagreement was the debt. One window, one population (isPaidTicket
 * at the DB floor), one number. `now` is the suites' seam. */
export function moverWindow(
  days: number,
  now: Date = new Date(),
): { startMs: number; endMs: number } {
  return lastNDaysMs(days, now);
}

/* ── 5.172.0 — the pace behind the shelf's days ─────────────────────────
 * menuItemId → units over the same window, WHOLE menu, no cap. The item
 * detail modal opens any dish; only what sold has a pace. Same paid truth
 * as the rail (paid tickets only; lines without a live dish skipped) —
 * one ledger, one definition, two reads.
 */
export function computePaceByItem(rows: MoverRow[]): Map<string, number> {
  const pace = new Map<string, number>();
  for (const r of rows) {
    if (!r.menu_item_id) continue;
    pace.set(r.menu_item_id, (pace.get(r.menu_item_id) ?? 0) + r.qty);
  }
  return pace;
}
