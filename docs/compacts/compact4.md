# TSOS Compact 4 — Obsidian Mode & System-Wide Theme Engine

- **Date**: 2026-09-25
- **Phase**: Design System Refinement & High-Contrast Terminal Mode
- **Workspace**: `d:\work\megatech\mega-tsos`

---

## 1. Executive Summary

Implemented "Obsidian Mode" as a first-class, system-wide design aesthetic across all operational surfaces of TSOS. Responding to user feedback, elevated Obsidian Mode from a local KDS dark theme into a single-button global toggle accessible across the entire application header.

---

## 2. What Obsidian Mode Is

- **Inspiration**: Industrial terminal displays, Bloomberg Terminal aesthetics, and high-efficiency dark room workflows.
- **Palette Tokens**:
  - Background: Deep pitch obsidian `#0C0A09` (Stone-950) with secondary `#1C1917` (Stone-900).
  - Borders: Crisp hairline contrasts `#292524` (Stone-800) and `#44403C` (Stone-700).
  - Accents: Vibrant phosphor amber (`#F59E0B`), warm orange (`#F97316`), and emerald status glows (`#10B981`).
  - Typography: Monospace numerical values, high-contrast labels, anti-glare readability under cafe lighting.

---

## 3. Global Single-Button Toggle Implementation

1. **State Engine (`src/lib/store.ts`)**:
   - Added `isObsidianMode: boolean` to `TsosState`.
   - Added `toggleObsidianMode: () => void` action.
   - Synchronized with `localStorage` for cross-session persistence.
2. **Global Header Component (`src/components/layout/Header.tsx`)**:
   - Added an elegant high-contrast toggle button directly in the main header:
     - Warm Cafe Mode: Shows moon icon with "Obsidian Mode" tooltip.
     - Obsidian Mode: Shows sun icon with "Warm Cafe Mode" tooltip and luminous amber border.
3. **Multi-Surface Adaptation**:
   - POS workstation adapts background, card containers, item selectors, and cart drawer.
   - Orders directory and shift reconciliation screens adopt dark terminal card styling.
   - KDS maintains optimal high-visibility ticket cards for steam and grease resistance in the kitchen.
