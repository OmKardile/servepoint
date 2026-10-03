import React from 'react';

/* v5.120.0 — the gold glint, consolidated. Since 5.115.0 three screens
 * grew private copies of the same tiny component (rooms Mark, shelf
 * ShelfMark, menu MarkHit) — one truth now lives here and serves every
 * search surface. While a filter narrows a list, each surviving text
 * paints its matched span so the eye lands on WHY the row survived.
 * Outside a search (or when THIS text doesn't contain the hit), it
 * renders untouched. Trim-tolerant by contract: callers may pass the
 * raw search string or a pre-lowered slice — both behave identically.
 */
export const MarkHit: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-[#F3E8CF] px-0.5 text-[#1A1A1A]">
        {text.slice(i, i + q.length)}
      </mark>
      {text.slice(i + q.length)}
    </>
  );
};
