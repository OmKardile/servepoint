import React from 'react';
import { ArrowRight } from 'lucide-react';

/**
 * DoorChip (v5.47.0) — the door grammar, shared.
 *
 * Moved here from EodScreen (v5.44.0) so the whole app speaks ONE door:
 * deep-teal on a 5% wash, ArrowRight glyph, gold focus ring, and the 0.96
 * active-press scale. A door earns its place on a real count (the caller
 * renders it only when the count > 0 — zero means zero, honest hiding, the
 * same rule as the notification filter chips). The label tells you WHERE the
 * number opens before you tap ("Open Kitchen", "Open Bills").
 */
export const DoorChip: React.FC<{ label: string; aria: string; onOpen: () => void }> = ({
  label,
  aria,
  onOpen,
}) => (
  <button
    type="button"
    onClick={onOpen}
    aria-label={aria}
    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#0F3D3E]/5 px-2.5 py-1 text-[10.5px] font-bold text-[#0F3D3E] transition-[background-color,transform] duration-150 hover:bg-[#0F3D3E]/10 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B88E2F]"
  >
    Open {label}
    <ArrowRight size={11} aria-hidden />
  </button>
);
