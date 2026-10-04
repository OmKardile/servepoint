/* ── The shelf's answer, as ONE shared truth (5.91.0; the recipe editor
 *    joins in 5.166.0, the counter's item sheet in 5.170.0, the shelf's
 *    days in 5.172.0, the bin's days in 5.176.0) ────────────────────
 *
 *   "How many more of this dish can the shelf still make?" — the thinnest
 *   recipe SKU decides, computed from what's actually on file. Born inside
 *   InventoryScreen (v5.81.0); the counter's shortlist now speaks the same
 *   answer (5.91.0); the Recipes tab's draft strip reads the same math
 *   (5.166.0); the item detail modal speaks it at the moment of selling
 *   (5.170.0) — so ONE answer serves the board, the rail, the editor, and
 *   the sheet.
 *
 *   5.172.0 — the shelf learns to speak TIME. Serves alone say "how many";
 *   the paid ledger says "how fast"; the operator thinks in both. When the
 *   caller hands counterShelfLine a pace (units over the movers' window,
 *   from computePaceByItem), the answer grows a days clause — coverage ÷
 *   pace-per-day, floored and spoken like the family ("~N days at this
 *   pace"). The number is ONE math (shelfDays); the words are its voice
 *   (shelfDaysClause). No pace → the answer stays as it always was — a
 *   dish nobody bought this week has no pace to divide by, and the shelf
 *   does not pretend it keeps forever.
 *
 *   5.176.0 — the bin learns to speak the same time. The dish's days are
 *   built FROM the ingredients' stock; the ingredient's days are built
 *   FROM the dishes' pace: weekly burn per SKU = Σ (recipe line qty ×
 *   the dish's paid pace), and the bin's days = shelfDays(stock, burn)
 *   — THE SAME division, one math, zero new denominators. The bin is a
 *   different subject, so its clause borrows the family's every rule
 *   (the floor, the boundaries, the weeks switch) and changes only the
 *   noun: "at this burn". No recipe pace → no burn → silence, exactly
 *   like a dish nobody bought — the bin never says "forever" either.
 *
 *   Honesty rules (inherited verbatim from the shelf's board):
 *   • no recipe lines on file  → coverage null, unknown false — the shelf
 *     can't answer, and says nothing rather than inventing a number;
 *   • a recipe SKU missing from the shelf map → unknown true — coverage is
 *     unknowable, said honestly;
 *   • a SKU whose stock reads null/NaN (5.166.0) → unknown true too —
 *     Number(null) is 0, and an unreadable bin must never masquerade as an
 *     empty one (the 5.165.0 cost trap, now guarded on the stock side);
 *   • a zero/invalid qty_per_serve line is data noise — skipped, never a
 *     fake zero;
 *   • the answer is a floor on reality (recipes assume exact portions) —
 *     the surfaces word it as "~N more", never an exact promise.
 */

import type { InventoryItem } from './api';
import { MOVER_WINDOW_DAYS } from './movers';

/** The minimal line the math reads — a full RecipeLine satisfies it, and
 *  so does the recipe editor's in-flight draft (5.166.0). */
export interface ShelfLine {
  inventory_item_id: string;
  qty_per_serve: number;
}

/** Below this many serves, the shelf's voice drops from green to amber —
 *  the board's own threshold (InventoryScreen v5.81.0), now shared. */
export const LOW_COVER = 5;

export interface ShelfCoverage {
  /** Serves the thinnest SKU allows; null = the shelf can't answer. */
  coverage: number | null;
  /** The thinnest SKU (named in the verdict when low or out). */
  thin: InventoryItem | null;
  /** A recipe SKU is missing from the shelf — coverage unknowable. */
  unknown: boolean;
}

export function shelfCoverage(lines: ShelfLine[], items: InventoryItem[]): ShelfCoverage {
  if (lines.length === 0) return { coverage: null, thin: null, unknown: false };
  const shelf = new Map(items.map((i) => [i.id, i]));
  let best = Infinity;
  let thin: InventoryItem | null = null;
  for (const r of lines) {
    const it = shelf.get(r.inventory_item_id);
    if (!it) return { coverage: null, thin: null, unknown: true };
    /* Number(null) is 0 — an unreadable bin is UNKNOWN, never an empty one
     * (5.166.0; the stock side of the cost trap recipeCost already guards) */
    const stock = it.current_stock == null ? NaN : Number(it.current_stock);
    if (!Number.isFinite(stock)) return { coverage: null, thin: null, unknown: true };
    const per = Number(r.qty_per_serve);
    if (!(per > 0)) continue; /* data noise — skipped, never a fake zero */
    const serves = Math.floor(stock / per);
    if (serves < best) {
      best = serves;
      thin = it;
    }
  }
  if (thin === null || best === Infinity) return { coverage: null, thin: null, unknown: false };
  return { coverage: Math.max(0, best), thin, unknown: false };
}

/** The board's verdict tone family — the counter speaks the same colors. */
export function shelfTone(c: ShelfCoverage): string {
  if (c.unknown || c.coverage === null) return '#969696';
  if (c.coverage === 0) return '#B4483C';
  if (c.coverage < LOW_COVER) return '#8A5A00';
  return '#2E7D32';
}

/** The shelf's short voice — what the counter's rail says under a dish. */
export function shelfVoice(c: ShelfCoverage): string | null {
  if (c.unknown) return "shelf can't answer";
  if (c.coverage === null) return null; /* no recipe on file — silence */
  if (c.coverage === 0) return `can't make another — ${c.thin?.name || 'a SKU'} is out`;
  if (c.coverage < LOW_COVER) return `~${c.coverage} more left`;
  return `~${c.coverage} more on the shelf`;
}

/** The counter's paired line — voice and tone as ONE contract (5.170.0).
 *  The item detail modal speaks the same answer the rail speaks, so the
 *  two surfaces can never disagree about a dish (and neither can drift
 *  off the family's tones). Silence for a dish with no recipe on file —
 *  silence, not zero (the rail's own rule since 5.91.0).
 *
 *  5.172.0 — optional `pace`: units the dish sold over the movers' window
 *  (computePaceByItem's read of the same paid ledger the rail ranks). When
 *  both coverage and pace answer, the voice grows a days clause; when
 *  either stays silent, the text is byte-identical to the pace-less call. */
export function counterShelfLine(
  c: ShelfCoverage,
  pace?: number | null,
): { text: string; tone: string } | null {
  if (c.coverage === null && !c.unknown) return null;
  const v = shelfVoice(c);
  if (!v) return null;
  const days = shelfDaysClause(c.coverage, pace);
  return { text: days ? `${v} — ${days}` : v, tone: shelfTone(c) };
}

/* ── 5.172.0 — the shelf's days ─────────────────────────────────────
 *
 *   The join of the shelf's two truths: coverage (how many serves the
 *   thinnest SKU allows) ÷ the paid week's pace (units over the movers'
 *   window). shelfDays is the NUMBER — one math; shelfDaysClause is the
 *   WORDS — floored, like every shelf answer (a floor on reality, never
 *   an exact promise). Silence unless BOTH sides answer: a dish that
 *   sold nothing has no pace (the shelf would "last forever" — an
 *   infinity the shelf refuses to speak), and a shelf that can't make
 *   another already said so in its own voice.
 */

/** Days of cover at the paid pace — the number (ONE math). Raw, unfloored;
 *  the voice floors. null = the shelf stays silent about time. */
export function shelfDays(
  coverage: number | null,
  paceUnits: number | null | undefined,
): number | null {
  if (coverage == null || !(coverage > 0)) return null;
  if (paceUnits == null || !(paceUnits > 0)) return null;
  const days = (coverage * MOVER_WINDOW_DAYS) / paceUnits;
  return Number.isFinite(days) ? days : null;
}

/** The bin's weekly burn per ingredient — ingredient-units per week, Σ
 *  (recipe line qty × the dish's paid pace) over every dish that draws on
 *  the bin (5.176.0). The SAME pace ledger the rail ranks and the days
 *  voice divides — no new source, no new denominator. A dish with no
 *  pace contributes nothing (silence, not zero — nobody bought it); a
 *  noise line (qty ≤ 0) is skipped like every shelf line; an unread
 *  ledger (pace null) reads as no burn anywhere — the bin stays silent,
 *  never an invented 0. */
export interface BurnLine extends ShelfLine {
  menu_item_id: string;
}

export function computeBurnByIngredient(
  lines: BurnLine[],
  pace: Map<string, number> | null,
): Map<string, number> {
  const burn = new Map<string, number>();
  if (!pace) return burn;
  for (const r of lines) {
    if (!r.menu_item_id) continue;
    const p = pace.get(r.menu_item_id);
    if (p == null || !(p > 0)) continue;
    const qty = Number(r.qty_per_serve);
    if (!Number.isFinite(qty) || !(qty > 0)) continue;
    burn.set(r.inventory_item_id, (burn.get(r.inventory_item_id) ?? 0) + qty * p);
  }
  return burn;
}

/** The days voice — words built on shelfDays, never re-answering it.
 *  Under a day speaks honestly ("less than a day"); past a fortnight the
 *  voice moves to weeks (days stop meaning anything to a kitchen).
 *
 *  5.176.0 — optional `noun`: the bin borrows every rule and changes the
 *  word ("at this burn"). Default keeps every existing caller's text
 *  byte-identical — the formatting lives here ONCE, so the dish's clause
 *  and the bin's clause can never drift apart. */
export function shelfDaysClause(
  coverage: number | null,
  paceUnits: number | null | undefined,
  noun: string = 'pace',
): string | null {
  const d = shelfDays(coverage, paceUnits);
  if (d == null) return null;
  if (d < 1) return `less than a day at this ${noun}`;
  if (d < 14) {
    const f = Math.floor(d);
    return `~${f} ${f === 1 ? 'day' : 'days'} at this ${noun}`;
  }
  return `~${Math.floor(d / 7)} weeks at this ${noun}`;
}
