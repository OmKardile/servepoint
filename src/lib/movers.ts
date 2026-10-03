/**
 * The counter's shortlist (v5.78.0) — the store-wide sibling of the regular's
 * usual (5.74.0). The usual names what ONE guest keeps ordering; the shortlist
 * names what the whole ROOM keeps ordering. Same paid truth, wider window:
 *
 *   paid tickets only (isPaidTicket — status ≠ cancelled, payment completed),
 *   last 7 days, grouped per menu item, deterministic tie-breaks
 *   (units → tickets → rupees → name) so two reloads can never disagree.
 *
 * The rail is a speed surface, not a report: the counter taps a chip and the
 * line is in the cart — no category, no modal. This module owns the one
 * definition; the screen only renders it.
 */
import type { OrderItem } from '../types';

/** How far back the shortlist looks (ledger days, rolling from now). */
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

export function computeTopMovers(rows: MoverRow[]): Mover[] {
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
    )
    .slice(0, MOVER_LIMIT);
}
