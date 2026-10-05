/* ── v5.256.0 — the verdict's one voice ──────────────────────────────────────
 * The tone law the dashboard's GuestLoveCard has spoken since 5.12.0, made
 * shareable: ≥4.5 loved (green), ≥3.5 good (gold), below listen up (red).
 * A single verdict passes through the SAME thresholds and wears the SAME
 * words — the counter's bill row and the dashboard's summary are one family,
 * never a fork. Pure and synchronous so the battery can pin the law against
 * the dashboard's own source text (the agreement shape). The absent case is
 * not a tone — the caller simply renders no row (honest absence).
 * ────────────────────────────────────────────────────────────────────────── */
export interface VerdictTone {
  color: string;
  bg: string;
  word: string;
}

export function verdictTone(rating: number): VerdictTone {
  if (rating >= 4.5) return { color: '#2E7D32', bg: '#2E7D3214', word: 'guests love it' };
  if (rating >= 3.5) return { color: '#8A5A00', bg: '#8A5A0014', word: 'good — keep going' };
  return { color: '#B3261E', bg: '#B3261E14', word: 'listen up — guests are not happy' };
}
