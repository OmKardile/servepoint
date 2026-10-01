# ADR 0004: Obsidian Terminal Theme Engine

- **Status**: Accepted
- **Date**: 2026-09-25
- **Deciders**: Lead Full-Stack Security Architect

---

## Context
Commercial cafe environments vary widely in ambient lighting—from bright outdoor sun-drenched counters to dimly lit cocktail lounges, late-night cafes, and steam-heavy kitchen lines. Operators requested a dark, high-contrast, industrial theme ("Obsidian Mode") that could be activated across the entire application with a single click.

## Decision
1. **Design System**: Built "Obsidian Mode" utilizing a dark palette:
   - Primary Surface: `#0C0A09` (Stone-950)
   - Secondary Surface: `#1C1917` (Stone-900)
   - Hairline Grid Borders: `#292524` (Stone-800) and `#44403C` (Stone-700)
   - Typography: Crisp white text with monospace numerical displays for prices, order numbers, and countdown timers.
   - Accents: Phosphor Amber (`#F59E0B`), Safety Emerald (`#10B981`), High-Visibility Orange (`#F97316`).
2. **Global Single-Button Toggle**: Placed an unobtrusive Sun/Moon toggle button in the central navigation header.
3. **State Management**: Managed via Zustand store property `isObsidianMode` and synced with `localStorage`.

## Consequences
- **Positive**: Drastically reduces eye strain during long cashier shifts; improves readability under kitchen spotlights; provides a distinctive, premium Bloomberg Terminal aesthetic.
- **Negative**: Requires maintaining dual styling classes across all presentational components.
