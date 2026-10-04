import { formatMoney } from './prefs';
import type { Offer } from '../types';

/**
 * The offer's own voice needs only three fields — the discount's kind and
 * size, and the threshold that gates it. v5.212.0 names that triple: the
 * guest QR menu (migration 016's read-only PublicOffer projection) can now
 * borrow the ONE composer without owning an Offer-shaped shadow of the
 * owner's row. A composer that needs less accepts more.
 */
export type OfferVoice = Pick<Offer, 'discount_type' | 'discount_value' | 'min_order_amount'>;

/**
 * The offer's own badge voice — "10% off" / "₹50.00 off". ONE composer owns
 * it: the offers tab's cards (5.71's scorecard), the share paper (5.149 —
 * byte-identity watched), the counter cart's fit whisper (5.210) and — since
 * v5.212.0 — the guest QR menu's chips all read the same words about the same
 * offer. A label borrowed from a sibling surface must be that surface's OWN
 * word (5.201) — so the word lives here, in one place, and every surface
 * borrows from the source.
 */
export function offerBadgeLabel(o: OfferVoice): string {
  return o.discount_type === 'percent'
    ? `${Number(o.discount_value)}% off`
    : `${formatMoney(Number(o.discount_value))} off`;
}

/**
 * The offer's full spoken rule — the badge plus its threshold clause:
 * "₹50.00 off over ₹300.00". A zero min speaks no clause (the rule is the
 * badge alone — an unconditional offer names no threshold it doesn't have).
 * The cart's fit whisper composes from this so the pill says the SAME words
 * the offers tab's card says about the same offer — and since v5.212.0 the
 * guest menu's chip says them too (its local "₹50 off · min ₹300" dialect —
 * a second composer of one offer's words, the exact disease 5.210 cured on
 * the owner side — is retired).
 */
export function offerRuleLabel(o: OfferVoice): string {
  const min = Number(o.min_order_amount);
  return min > 0 ? `${offerBadgeLabel(o)} over ${formatMoney(min)}` : offerBadgeLabel(o);
}

/**
 * The offer's compact register — the tiny-chip voice ("50%" / "₹50"), the
 * badge shrunken for a 9px circle, not a second sentence. ONE composer owns
 * it since v5.212.0: the guest menu's banner chip and the cart drawer's
 * offer pill both used to duplicate the same local ternary — two composers
 * of one register inside one file — and the flat branch carried a quiet
 * lie: `toFixed(0)` rounded a ₹44.50 offer into a "₹45" badge. A money
 * register never rounds — the paise voice is formatMoney's own ("₹44.50");
 * whole rupees stay bare ("₹50"). Percent speaks its own number ("10%",
 * "12.5%").
 */
export function offerBadgeShort(o: OfferVoice): string {
  return o.discount_type === 'percent'
    ? `${Number(o.discount_value)}%`
    : Number.isInteger(Number(o.discount_value))
      ? `₹${Number(o.discount_value)}`
      : formatMoney(Number(o.discount_value));
}
