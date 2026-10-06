/* ── tax.ts — the rate keeps ONE home (v5.280.0) ─────────────────────────
   The house's GST rate — 5%, the standard F&B slab — lived in FOUR files
   with no single owner: api.ts held `const taxRate = 0.05` where staff
   orders are written; the staff cart (FoodDrinksScreen) and the guest cart
   (GuestPages) each re-rolled `(base) * 0.05` for their previews; and the
   receipt's legal labels spoke "CGST 2.5%" as a BARE LITERAL while its
   money was derived (tax/2) — label and math could disagree the day the
   slab moves, and four files would lie independently. The words carried
   it too: "GST (5%)" on the staff drawer, "GST (5% · CGST+SGST)" on the
   bill row, "GST 5%" baked into the guest's three translations.

   THIS lib is the rate's one home. The MATH imports nothing but the
   money lib's round2 (the one rounding — v5.280.0 moved it out of five
   hand-rolled locals into money.ts, the arithmetic's home):

   · ONE rate — GST_RATE. Change the slab here, and every cart preview,
     every written order, every receipt label and every spoken word moves
     together — the word can never disagree with the math again.
   · ONE tax math — gstTax, the discounted base × the rate, paise-true.
     Never negative: a clamped discount cannot mint a tax refund.
   · ONE split — cgstSgstSplit halves the ORDER'S OWN stored tax_amount
     (display-only, sums back exactly — the receipt's law kept); the
     remainder rule is explicit: SGST carries the odd paise.
   · ONE percent voice — gstPercentWord ("5%") and cgstPercentWord
     ("2.5%") are DERIVED, never typed: the labels on receipts, bill rows
     and drawers speak the same truth the math computes.

   The guest's translations carry the rate as a variable now
   ("GST {rate}%"), filled at render from this lib through the guest's
   own {var} grammar — three languages, one truth. */

import { round2 } from './money';

/** The house's GST rate — 5%, the standard F&B slab (the census byte,
 *  in exactly ONE src file). The day an owner moves to another slab,
 *  this line and nothing else moves with them. */
export const GST_RATE = 0.05;

/** GST on a discounted base, paise-true, never negative — the ONE tax
 *  math (api.ts's written orders, the staff cart's preview and the
 *  guest cart's preview all ride it, so a preview and its written
 *  order can never disagree). */
export function gstTax(base: number): number {
  return round2(Math.max(0, base) * GST_RATE);
}

/** The display-only CGST/SGST split of a ticket's OWN stored tax_amount
 *  — halves the stored figure and gives the odd paise to SGST, so the
 *  two lines always sum back to the ticket's truth (the receipt's law:
 *  never recomputed from the base, only halved for print). */
export function cgstSgstSplit(tax: number): { cgst: number; sgst: number } {
  const cgst = round2(tax / 2);
  const sgst = round2(tax - cgst);
  return { cgst, sgst };
}

/** The percent number the rate speaks — 5 for the 5% slab. */
export function gstPercent(): number {
  return Math.round(GST_RATE * 100);
}

/** The drawer's and bill row's word — "5%", derived, never typed. */
export function gstPercentWord(): string {
  return `${gstPercent()}%`;
}

/** The receipt's half-slab word — "2.5%", derived from the rate (the
 *  day the slab moves, the printed label moves with it). */
export function cgstPercentWord(): string {
  return `${Number(((GST_RATE / 2) * 100).toFixed(2))}%`;
}
