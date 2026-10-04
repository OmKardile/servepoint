import { formatMoney } from './prefs';
import type { Offer } from '../types';

/**
 * The offer's own badge voice — "10% off" / "₹50 off". ONE composer owns
 * it: the offers tab's cards (5.71's scorecard), the share paper (5.149 —
 * byte-identity watched) and the counter cart's fit whisper (5.210) all
 * read the same words about the same offer. A label borrowed from a
 * sibling surface must be that surface's OWN word (5.201) — so the word
 * lives here, in one place, and every surface borrows from the source.
 */
export function offerBadgeLabel(o: Offer): string {
  return o.discount_type === 'percent'
    ? `${Number(o.discount_value)}% off`
    : `${formatMoney(Number(o.discount_value))} off`;
}

/**
 * The offer's full spoken rule — the badge plus its threshold clause:
 * "₹50 off over ₹300". A zero min speaks no clause (the rule is the
 * badge alone — an unconditional offer names no threshold it doesn't
 * have). The cart's fit whisper composes from this so the pill says the
 * SAME words the offers tab's card says about the same offer.
 */
export function offerRuleLabel(o: Offer): string {
  const min = Number(o.min_order_amount);
  return min > 0 ? `${offerBadgeLabel(o)} over ${formatMoney(min)}` : offerBadgeLabel(o);
}
