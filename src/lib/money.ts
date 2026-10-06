/* v5.278.0 — the money's ONE register. A whole-house census found the
 * en-IN two-decimal digit shape — the exact byte run
 * `toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`
 * — living in FOUR hand-rolled copies beside its lib: the guest book kept
 * its own `money` helper (prefs are a staff surface, so the guest rolled
 * its own ₹) AND a raw `₹${round2(a.price)}` straggler whose paise voice
 * was broken ("₹15.5" where the register says "₹15.50", no lakh grouping);
 * the dashboard re-rolled the shape inline three times; and the staff
 * customizer's variant pills ran a `% 1 === 0` grammar that dropped the
 * paise voice on whole-rupee deltas — "+₹15" on one pill while the same
 * modal's totals read "₹115.50", and a ±₹0 pill rendered where the guest's
 * twin hides the zero. THE ONE REGISTER: this file. moneyNum is the digit
 * shape (the census byte, in exactly ONE src file); money is the house's
 * ₹-pinned word — PREFS-FREE on purpose, because the guest surfaces render
 * where no staff prefs exist; signedMoney is the delta register the twins
 * now share. prefs.formatMoney keeps its own door (the staff's configured
 * currency symbol) but rides moneyNum's digits, so a change to the shape
 * happens here and nowhere else. */

/** the digit shape — en-IN grouping, always two decimals, never rounded
 *  beyond the paise the number already carries. THE shape's one home. */
export function moneyNum(amount: number): string {
  return Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** the house's money word — "₹1,801.80". Pinned to ₹ on purpose: the
 *  guest surfaces (menu, track, gate) render on devices that hold no
 *  staff prefs, so this voice needs no prefs to speak the truth. */
export function money(amount: number): string {
  return `₹${moneyNum(amount)}`;
}

/** the delta register — "+₹15.00" / "−₹5.50" / "±₹0.00" for the variant
 *  pills the twins share. Whole-rupee deltas keep their paise ("+₹15.00",
 *  not "+₹15" — a money register never drops its voice); the minus is the
 *  house's typographic minus, matching the pills' own tradition. Call
 *  sites gate the zero (the guest's twin hides ±₹0 pills); the lib still
 *  speaks the whole register so a stray zero never renders as a lie. */
export function signedMoney(amount: number): string {
  const n = Number(amount);
  if (n > 0) return `+${money(n)}`;
  if (n < 0) return `−${money(-n)}`;
  return '±₹0.00';
}

/** The paise rounding — the ONE home (v5.280.0). A whole-house census
 *  found `Math.round(n * 100) / 100` rolled by hand in ELEVEN FILES
 *  beside this lib — nineteen call sites strong: offerFit's local; the
 *  staff cart's capped discount and its total; the dish modal AND the
 *  menu screen beside it (a private round2 with three call sites); the
 *  guest book; api.ts's written order item_total and the drawer
 *  movement's p_amount; the offers' write path and the addon snapshot's
 *  base price (four sites); the EOD drawer's open/close floats and its
 *  variance; the waste card's quantities and rupees (four sites); the
 *  GST register's own cgst/sgst split (the twin lib/tax never knew it
 *  had — it rides cgstSgstSplit now); the bill's balance; and one dead
 *  local on the floor that nothing ever called. The bill's ways-split
 *  keeps its deliberate Math.floor (each way rounds DOWN so the parts
 *  never overpay) — a judgment, not this rounder's twin. The register's
 *  arithmetic lives in exactly ONE src file now — the same file that
 *  owns the voice, because the digit shape and its rounding are one
 *  truth, not two. MATH, not voice: this never renders, it computes. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
