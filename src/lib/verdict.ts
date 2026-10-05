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

/* ── v5.257.0 — the guest's voice, summarized ───────────────────────────────
 * The CRM drawer's ONE summary arithmetic: rows in (a guest's verdict
 * history, newest first), count + average + the tone word out. THE SAME
 * tone law as everything else in the family — a single verdict's tone and
 * a season's average wear the same thresholds and words (the GuestLoveCard
 * is the law's home; the bill's row and the CRM's drawer are its speakers).
 * Empty rows or an unread ledger → null: the caller stays SILENT (an
 * unread ledger never becomes an invented verdict — the drawer's own
 * GIVEN AWAY rule, applied to words). Exported pure so the suite and the
 * E2E execute the exact arithmetic the drawer speaks. */
export function guestVoice(
  rows: { rating: number }[] | null | undefined,
): { count: number; avg: number; tone: VerdictTone } | null {
  if (!rows || rows.length === 0) return null;
  let sum = 0;
  for (const r of rows) sum += Number(r.rating ?? 0);
  const avg = sum / rows.length;
  return { count: rows.length, avg, tone: verdictTone(avg) };
}
