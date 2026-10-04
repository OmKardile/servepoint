import { createUnreadFeed } from './createUnreadFeed';
import { fetchLowStockCount, subscribeInventoryRealtime } from '../lib/api';

/**
 * ServePoint stock alerts — the THIRD bell's feed (v5.114.0), the first
 * consumer of the unread-feed factory (src/store/createUnreadFeed.ts) and
 * its simplest shape: a single-number VALUE over a single-element SCOPE
 * (the tenant). The factory grew its generic form in v5.135.0 (chat
 * migrated with a scope triple); this feed reads exactly as it did.
 *
 * Until now a low shelf spoke only inside the Inventory screen: you learned
 * milk had crossed its reorder point by going to look. During service the
 * operator lives on Bills and Kitchen, not Inventory — the deduction ledger
 * moves the shelf in real time (037 published inventory_items /
 * stock_deductions / stock_adjustments) and nobody outside the screen
 * heard it. This feed carries the count to the rail: a badge on the
 * Inventory pill, announced by the 5.111.0 live region when the count
 * MOVES between known values.
 *
 * THE GRAMMAR, stated once: the count is every SKU at or below its reorder
 * point, INCLUDING out-of-stock (current_stock <= reorder_point). An out
 * item is the MOST urgent member of that set — excluding it from the
 * number while the shelf tab shows a red OUT chip would make the rail
 * quieter exactly when the room is louder. The Inventory header's two
 * chips (LOW STOCK low-and-not-out · OUT zero-or-less) SUM to this number;
 * the rail's aria says "low or out" so the grammar rides the label.
 * Client-side arithmetic over the two-column fetch is the same truth the
 * shelf screen computes — one filter, two readers.
 *
 * Mute rules: none. Stock truth is not a courtesy — the 031 chat silence
 * was a product decision about social noise; a dry shelf is operationally
 * loud by nature. (The announcement only fires on N→M moves, so service
 * deductions that don't cross a reorder point never speak.)
 */
export const useStockUnread = createUnreadFeed<[string], number>({
  tag: 'stock',
  fetch: ([tenantId]) => fetchLowStockCount(tenantId),
  /* own channel tag — the screen's board subscription keeps 'screen'; a
   * shared name would let the feed steal the room and crash the screen on
   * its next postgres_changes add (caught live in the first E2E — the
   * unread.ts 'badge' lesson, paid for twice now). */
  subscribe: ([tenantId], onPing, onState) =>
    subscribeInventoryRealtime(tenantId, onPing, onState, 'railfeed'),
  pollMs: 60_000,
});
