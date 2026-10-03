import React from 'react';
import type { LucideIcon } from 'lucide-react';

/* v5.121.0 — the empty state, consolidated (the MarkHit arc, one release
 * later). 5.119.0 taught the Food & Drinks door to say WHY a search came
 * up empty — what was searched, what the search reaches, a way out — and
 * built the honest-miss layout as a private component there. Bills spoke
 * the same idea the same week, but its miss note was a bare "No bills
 * match / Try a different filter or search term" — honest about being
 * empty, silent about why. One truth now lives here: the icon circle,
 * the title, the body, the action slot — so every door that misses says
 * why IN THE SAME VOICE, the way every survivor glints in the same gold.
 *
 * Callers own the words (the contract is per-screen: a search miss and a
 * filter miss are different sentences); this primitive owns the shape.
 */
export const EmptyState: React.FC<{
  icon: LucideIcon;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
}> = ({ icon: Icon, title, body, action }) => (
  <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
    <span
      aria-hidden
      className="flex h-20 w-20 items-center justify-center rounded-full bg-[#EAF0EC] text-[#0F3D3E]"
    >
      <Icon size={34} strokeWidth={1.6} />
    </span>
    <h3 className="mt-4 text-base font-bold text-[#1A1A1A]">{title}</h3>
    {body && (
      <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-[#6B6B6B]">
        {body}
      </p>
    )}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
