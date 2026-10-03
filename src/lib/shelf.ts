/* ── The shelf's answer, as ONE shared truth (5.91.0) ──────────────────────
 *
 *   "How many more of this dish can the shelf still make?" — the thinnest
 *   recipe SKU decides, computed from what's actually on file. Born inside
 *   InventoryScreen (v5.81.0); the counter's shortlist now speaks the same
 *   answer (5.91.0), so the math lives here and BOTH surfaces read it.
 *
 *   Honesty rules (inherited verbatim from the shelf's board):
 *   • no recipe lines on file  → coverage null, unknown false — the shelf
 *     can't answer, and says nothing rather than inventing a number;
 *   • a recipe SKU missing from the shelf map → unknown true — coverage is
 *     unknowable, said honestly;
 *   • a zero/invalid qty_per_serve line is data noise — skipped, never a
 *     fake zero;
 *   • the answer is a floor on reality (recipes assume exact portions) —
 *     the surfaces word it as "~N more", never an exact promise.
 */

import type { InventoryItem, RecipeLine } from './api';

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

export function shelfCoverage(lines: RecipeLine[], items: InventoryItem[]): ShelfCoverage {
  if (lines.length === 0) return { coverage: null, thin: null, unknown: false };
  const shelf = new Map(items.map((i) => [i.id, i]));
  let best = Infinity;
  let thin: InventoryItem | null = null;
  for (const r of lines) {
    const it = shelf.get(r.inventory_item_id);
    if (!it) return { coverage: null, thin: null, unknown: true };
    const per = Number(r.qty_per_serve);
    if (!(per > 0)) continue; /* data noise — skipped, never a fake zero */
    const serves = Math.floor(Number(it.current_stock) / per);
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
