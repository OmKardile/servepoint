import { formatMoney } from './prefs';
import { offerRuleLabel, type OfferVoice } from './offerLabel';
import { offerDiscount } from '../store/cart';

export interface OfferFit {
  kind: 'applied' | 'applies' | 'unlock';
  /* v5.212.0 — the voice triple + id, not the whole row: the fit's
     arithmetic reads the triple and needs the id to tell applied from
     applies, and the guest menu's PublicOffer projection can now share
     the family. */
  offer: OfferVoice & { id: string };
  /** the money this offer takes off the CURRENT line set (applied/applies) */
  take: number;
  /** the rupees still short of the threshold (unlock only) */
  missing: number;
  /** the offer's full spoken rule — "₹50.00 off over ₹300.00" (the lib's own composer) */
  rule: string;
}

/* ── the offer's fit for a line set AS IT STANDS ──────────────────────
 * v5.210.0 — the counter's order pill whispers the offer's fit for the
 * line set: an offer the cart already qualifies for speaks "applies", a
 * threshold just out of reach speaks "add ₹X more", an offer already
 * applied speaks its confirmation. Pure so the suite owns the fit
 * (228's billsCsvRows pattern). The arithmetic is the store's own
 * offerDiscount — the SAME number the drawer's discount line speaks
 * when the offer is applied (one arithmetic, never a second one). The
 * best take wins among eligible offers (ties keep the read's order —
 * no sort, a loop); among unlocks the CLOSEST threshold speaks (a
 * smaller min is nearer). Null offers (unread or failed) and an empty
 * line set → null: the surface stays silent — an unread register never
 * becomes a fabricated "no offers", and an empty cart has no fit to
 * speak of.
 * v5.214.0 — the family home: the fit is CART-domain, not food-screen-
 * domain, and the guest menu's floating bar now whispers it too — the
 * body moves here so the guest borrows ONE reducer and ONE voice
 * instead of importing a component file's module graph. The counter's
 * local voice ternary retires with it: offerFitVoice is the sentence's
 * ONE composer, read by both surfaces (the pill's chip and aria, the
 * guest bar's whisper line and aria). */
const round2 = (n: number) => Math.round(n * 100) / 100;

export function offerFit(
  offers: (OfferVoice & { id: string })[] | null | undefined,
  subtotal: number,
  appliedId: string | null,
): OfferFit | null {
  if (!offers || offers.length === 0 || !(subtotal > 0)) return null;
  const eligible = offers.filter((o) => subtotal >= Number(o.min_order_amount));
  if (eligible.length > 0) {
    let best = eligible[0];
    let bestTake = offerDiscount(best, subtotal);
    for (const o of eligible.slice(1)) {
      const t = offerDiscount(o, subtotal);
      if (t > bestTake) {
        best = o;
        bestTake = t;
      }
    }
    return {
      kind: appliedId && best.id === appliedId ? 'applied' : 'applies',
      offer: best,
      take: bestTake,
      missing: 0,
      rule: offerRuleLabel(best),
    };
  }
  let closest = offers[0];
  for (const o of offers.slice(1)) {
    if (Number(o.min_order_amount) < Number(closest.min_order_amount)) closest = o;
  }
  return {
    kind: 'unlock',
    offer: closest,
    take: 0,
    missing: round2(Number(closest.min_order_amount) - subtotal),
    rule: offerRuleLabel(closest),
  };
}

/**
 * The fit's spoken sentence — ONE composer for every surface that
 * whispers a fit: "₹27.00 off applied" (the confirmation),
 * "₹50.00 off over ₹300.00 applies" (the money on the table),
 * "Add ₹80.00 more for ₹50.00 off over ₹300.00" (the honest upsell).
 * The frame travels with the reducer so two surfaces can never say the
 * fit in two dialects — 5.211's own-words rule, now for the fit.
 * v5.233.0 — the 'applies' state names the money it takes on THIS cart,
 * but only when the rule doesn't already say it: a PERCENT offer's rule
 * speaks only a rate ("10% off") — the ₹27.00 it takes on the guest's
 * actual lines lived nowhere until the tap, so the bar whispered a rate
 * while the total showed full price (5.262's law: a verdict beside a
 * number that never meets it). A FLAT offer's rule already speaks the
 * rupees — saying them twice is the review-step's "Trial (status: trial)"
 * disease, the same words in one breath. So: percent gains the clause
 * ("10% off applies · ₹27.00 off this order"), flat keeps its bytes.
 * Zero take keeps the old bytes too (silence, never a fabricated ₹0.00).
 */
export function offerFitVoice(fit: OfferFit): string {
  return fit.kind === 'applied'
    ? `${formatMoney(fit.take)} off applied`
    : fit.kind === 'applies'
      ? fit.offer.discount_type === 'percent' && fit.take > 0
        ? `${fit.rule} applies · ${formatMoney(fit.take)} off this order`
        : `${fit.rule} applies`
      : `Add ${formatMoney(fit.missing)} more for ${fit.rule}`;
}
