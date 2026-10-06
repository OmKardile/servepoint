/* ── The delta chip, ONE home (v5.303.0) ────────────────────────────────────
 *
 *   The "vs prior" comparison lived in Reports since v5.20.0 — direction-
 *   colored in the app's health vocabulary, with the honest voices already
 *   grown in: a teal "new" when the earlier window held nothing, a ±0% flat,
 *   and (5.94.0) the multiple voice at extreme ratios where a percentage
 *   slab is a dare, not a signal. The close-out's day book (EOD) now borrows
 *   the chip for its day-over-day strip, and the house law is the one
 *   composer's law (the offerLabel lesson): two screens rendering two private
 *   copies of one comparison can drift — the chip moved here so the KPI card
 *   and the Z's summary speak the same dialect forever.
 *
 *   The exact figures always live in the tooltip + aria label — a percentage
 *   never hides the money it came from. `emptyWord` lets a caller name what
 *   "nothing in the earlier window" means in ITS family's words (money says
 *   "no sales", tickets say "no tickets") without forking the composer. */
import React from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';

export const DELTA_SKIN: Record<'up' | 'down' | 'flat' | 'new', { fg: string; bg: string; bd: string }> = {
  up: { fg: '#2E7D32', bg: '#E7F2EB', bd: '#CFE6D8' },
  down: { fg: '#B3261E', bg: '#FDEEEC', bd: '#F0C4BE' },
  flat: { fg: '#6B6B6B', bg: '#F1F2EF', bd: '#E3E7E0' },
  new: { fg: '#0F3D3E', bg: '#DCE9E4', bd: '#C6D8D1' },
};

export const DeltaChip: React.FC<{
  current: number;
  prior: number;
  baseline: string;
  fmt: (n: number) => string;
  emptyWord?: string;
}> = ({ current, prior, baseline, fmt, emptyWord = 'no sales' }) => {
  if (prior === 0 && current === 0) return null;
  const isNew = prior === 0 && current > 0;
  const pct = prior > 0 ? ((current - prior) / prior) * 100 : 0;
  /* 5.94.0 — the multiple voice: at extreme ratios a percentage slab is a
   *  dare, not a signal ("1471% vs prior 7 days" — true, and useless). From
   *  1000% up — eleven times prior and beyond — the chip speaks in multiples
   *  ("15.7×"), the way the counter actually says it; the title/aria still
   *  carry both raw numbers, so the truth never left the chip. */
  const mult = pct >= 1000 ? current / prior : null;
  const flat = !isNew && mult === null && Math.abs(pct) < 0.05;
  const kind = isNew ? 'new' : flat ? 'flat' : pct > 0 ? 'up' : 'down';
  const skin = DELTA_SKIN[kind];
  const text = isNew
    ? 'new'
    : flat
      ? '±0%'
      : mult !== null
        ? `${mult.toFixed(1)}×`
        : `${Math.abs(pct) >= 100 ? Math.round(Math.abs(pct)) : Math.abs(pct).toFixed(1)}%`;
  const detail = isNew
    ? `${fmt(current)} — ${emptyWord} in the earlier window (${baseline})`
    : mult !== null
      ? `${fmt(current)} vs ${fmt(prior)} — ${mult.toFixed(1)}× the earlier window (${baseline})`
      : `${fmt(current)} vs ${fmt(prior)} (${baseline})`;
  const Icon = kind === 'up' ? TrendingUp : kind === 'down' ? TrendingDown : Minus;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-[1.5px] text-[10px] font-bold leading-none tabular-nums"
      style={{ color: skin.fg, backgroundColor: skin.bg, border: `1px solid ${skin.bd}` }}
      title={detail}
      aria-label={`vs ${baseline}: ${detail}`}
    >
      <Icon size={10} aria-hidden strokeWidth={2.5} />
      {text}
    </span>
  );
};
