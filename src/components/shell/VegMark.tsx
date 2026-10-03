import React from 'react';

/**
 * The FSSAI mark (v5.53.0) — square-and-dot, green for veg, brown-red for
 * non-veg; the geometry Indian packaging law made universal, and the same
 * grammar the guest menu rows print (GuestPages, v5.7 lineage).
 *
 * A row with no claim (old data, is_veg NULL) stays silent — silence is
 * honest; the mark never invents a dietary fact the kitchen didn't give.
 */
export const VegMark: React.FC<{ veg?: boolean | null; size?: number }> = ({ veg, size = 16 }) => {
  if (veg === null || veg === undefined) return null;
  const color = veg ? '#2E7D32' : '#B4483C';
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-sm border bg-white"
      style={{ width: size, height: size, borderColor: color }}
    >
      <span
        className="rounded-full"
        style={{ width: Math.round(size * 0.5), height: Math.round(size * 0.5), background: color }}
      />
    </span>
  );
};
