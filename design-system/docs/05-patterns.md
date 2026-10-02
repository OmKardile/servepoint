# 05 — UX Patterns

> ServePoint Design System · v1.0.0 · The cross-component behaviors that make
> the app feel like one product. These are normative for every new surface.

## 1. Honesty patterns (the defining pattern family)

1. **Empty states explain the future** — never "No data". Grammar:
   icon → serif-italic headline → one sentence on what will fill the space →
   optional quiet action. ("No guest has scanned this table's QR yet — the
   session trail appears here the moment someone opens the menu.")
2. **Zero renders zero** — a zeroed KPI shows ₹0.00 and an honest empty chart;
   the app never shows stale numbers after a calendar flip.
3. **No fake baselines** — a comparison with no prior data says "no prior-week
   tickets in the loaded ledger yet" instead of drawing a flat lie.
4. **Dead images vanish** — every remote `<img>` self-hides on error; broken
   glyphs never render; fallbacks are pre-5.x-class layouts.
5. **Deltas cite stored facts** — green/red chips compute from the ledger;
   percentages show alongside absolutes ("+25 vs prior 7d (+1250%) · prior 2").
6. **Success is proven, not claimed** — a "Saved" chip appears only after the
   write actually held; refusals surface inline.

## 2. Two-step destructive grammar (arm → confirm)
Destructive actions never fire on first tap: first tap *arms* ("Cut" → "Cut
for session opened 20:49?" / "Cut all N live?"), ~3s window, second tap
executes. Bulk variants state the count honestly ("3 live windows open — one
photo of this sticker could be many phones") and report partial failure
("N of M cuts failed — the list shows what actually held").

## 3. IST-first calendar math
All day boundaries are Asia/Kolkata calendar days (`Intl` with `en-CA` date
keys + `+05:30` day starts) — never UTC midnights. Windows aggregate by IST
hour; labels are IST; the word "day" in UI always means IST day.

## 4. Derived, never stored
Display-only facts (table labels from FK embeds, CGST/SGST halving, clock-
derived liveness) are computed at read time — the ledger stays the only truth.
Storage schemas don't grow display columns.

## 5. Fail-soft ride-alongs
Auxiliary reads (session trails, brand payload, realtime state) never block
the primary screen: they ride along, load late, and fail into honest empty
states — the board renders without them.

## 6. One scan, one window / idempotent actions
Concurrent duplicate actions collapse onto a single in-flight promise;
re-fires after settle are genuinely fresh. The same discipline applies to
prints, saves, and session minting.

## 7. Print honesty
`window.print()` doesn't wait for images or layout: warm remote images first
(`preloadPrintImage`, 2.5s non-fatal), keep the print document alive via
afterprint + 60s fallback, and let every printed image self-hide on error.

## 8. Realtime courtesy
Live states show a chip (Live / connecting / offline); polls are 30s; optimistic
flips are always followed by a resync that treats the server as truth.

## 9. Accessibility contract
- 44px touch minimum; `aria-pressed` toggles; `aria-label` icon buttons;
  `role="group"` segmented controls; polite live regions for async results.
- `focus-visible` gold ring everywhere; keyboard path exists for every flow
  (modals: Escape + backdrop; two-step confirm works from the keyboard).
- Semantic landmarks per screen (`main`, `section` + `aria-label`, `header`).

## 10. Internationalization
Guest surfaces carry a locale ribbon (Kannada et al.) via `guest-i18n`;
staff surfaces are English. Dates: IST day-month; money: ₹ with `formatMoney`.

## 11. Progressive disclosure
Drill-downs open panels on the same screen (cards → drill), heavy lists cap
at six with "+N earlier" honest counters, and filters state what's shown
("Showing 3 of 7 tables · occupied only" + one-tap clear).
