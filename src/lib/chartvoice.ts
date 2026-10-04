/* ── The charts stand down, and speak in one voice (v5.132.0) ───────────────
 *
 *   The app's nine recharts surfaces (Reports ×5, Dashboard ×3, Floor ×1)
 *   had two loose ends, both inherited from the library's defaults:
 *
 *   1. THE FOCUS LEAK — recharts renders every chart <svg> with
 *      tabindex="0", so a Tab from the KPI cards landed INSIDE the chart:
 *      a UA auto-outline dead stop in a figure that is either aria-hidden
 *      (decorative — the sibling text already speaks its numbers: "best
 *      day", "peak hour") or role="img" (labelled — the label IS the
 *      chart's voice). In both cases the focusable internals are a stop
 *      with nothing to read and nothing to press, invisible to screen
 *      readers in the aria-hidden case. installChartHush() strips
 *      svg[tabindex] inside .recharts-wrapper the moment a chart mounts.
 *      One rAF-coalesced MutationObserver, installed once from main.tsx —
 *      charts remount on every data/window change, so per-site refs would
 *      miss them, and future chart surfaces inherit the discipline free.
 *
 *   2. THE TOOLTIP VOICE — Dashboard's TOOLTIP_STYLE (white card, hairline
 *      #E3E7E0 border, radius 12, the deep 28px shadow, padded) was the
 *      designed register, but Reports and Floor hand-rolled their own
 *      blocks and drifted: three Reports tooltips carried a weaker 14px
 *      shadow, one had none at all, and none spoke the gray label line.
 *      CHART_TOOLTIP_STYLE + CHART_TOOLTIP_LABEL promote that register
 *      here so every tooltip in the house is byte-identical.
 */

import type { CSSProperties } from 'react';

/** The house tooltip register — Dashboard's designed voice, promoted. */
export const CHART_TOOLTIP_STYLE: CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E3E7E0',
  borderRadius: 12,
  fontSize: 12,
  color: '#1A1A1A',
  boxShadow: '0 10px 28px rgba(15, 61, 62, 0.10)',
  padding: '8px 12px',
};

/** The tooltip's label line — the quiet gray the series colors read against. */
export const CHART_TOOLTIP_LABEL: CSSProperties = {
  color: '#6B6B6B',
  marginBottom: 4,
};

let installed = false;

/** Strip recharts' svg[tabindex="0"] wherever a chart mounts. Idempotent;
 *  call once at app bootstrap (main.tsx). Removing the attribute is an
 *  attribute mutation, not a childList one — the observer never feeds
 *  itself. */
export function installChartHush(): void {
  if (installed || typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
    return;
  }
  installed = true;
  const sweep = () => {
    document.querySelectorAll('.recharts-wrapper svg[tabindex="0"]').forEach((svg) => {
      svg.removeAttribute('tabindex');
    });
  };
  let queued = false;
  const mo = new MutationObserver((records) => {
    if (queued || !records.some((r) => r.addedNodes.length > 0)) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      sweep();
    });
  });
  mo.observe(document.body, { childList: true, subtree: true });
  sweep();
}
