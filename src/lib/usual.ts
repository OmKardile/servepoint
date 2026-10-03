import type { Order, OrderItem } from '../types';

/**
 * The regular's usual (v5.74.0) — ONE definition for every surface that
 * speaks the concept (the guest drawer's well, the counter cart's chip).
 *
 * Paid truth mirrors v_customer_stats exactly: a ticket counts only when
 * status ≠ cancelled AND payment completed — the same rule that derives
 * visits and lifetime spend. Aggregation lives in ledger LINE space, so
 * order-level discounts never distort the dish's own rupees, and the share
 * meter can never read over 100%.
 *
 * Ties break deterministically — units, then distinct tickets, then
 * rupees, then name — so the same ledger always names the same dish,
 * no matter what order the rows arrived in.
 *
 * The window (USUAL_WINDOW tickets, newest first) is wide enough that a
 * habit cannot hide behind a one-ticket accident.
 */

export const USUAL_WINDOW = 50;

export type GuestUsual = {
  name: string;
  units: number;
  tickets: number;
  rupees: number;
  share: number;
  /** The latest expression of the habit — its frozen price and extras are
   *  what "start their usual" rides into the live cart. */
  line: OrderItem | null;
};

/** Paid truth, shared with v_customer_stats (016). */
export const isPaidTicket = (o: Order): boolean =>
  String(o.status) !== 'cancelled' && String(o.payment_status || '') === 'completed';

export function computeUsual(orders: Order[]): GuestUsual | null {
  const agg = new Map<
    string,
    { units: number; tickets: Set<string>; rupees: number; lastLine: OrderItem | null }
  >();
  let lineRupees = 0;
  for (const o of orders) {
    if (!isPaidTicket(o)) continue;
    for (const it of o.items || []) {
      lineRupees += it.qty * Number(it.unit_price);
      const cur =
        agg.get(it.name) || { units: 0, tickets: new Set<string>(), rupees: 0, lastLine: null };
      cur.units += it.qty;
      cur.tickets.add(o.id);
      cur.rupees += it.qty * Number(it.unit_price);
      /* orders arrive newest-first, so the first writer is the latest
       * expression of the habit. */
      if (!cur.lastLine) cur.lastLine = it;
      agg.set(it.name, cur);
    }
  }
  if (agg.size === 0) return null;
  const [name, v] = [...agg.entries()].sort(
    (a, b) =>
      b[1].units - a[1].units ||
      b[1].tickets.size - a[1].tickets.size ||
      b[1].rupees - a[1].rupees ||
      a[0].localeCompare(b[0])
  )[0];
  return {
    name,
    units: v.units,
    tickets: v.tickets.size,
    rupees: v.rupees,
    share: lineRupees > 0 ? v.rupees / lineRupees : 0,
    line: v.lastLine,
  };
}
