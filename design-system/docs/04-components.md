# 04 — Components

> ServePoint Design System · v1.0.0 · Specs for the recurring components of
> the web app. Anatomy references real selectors/classes in `src/`.

## Buttons

### 1. Gold CTA (`.sp-cta`) — "the ask"
- bg `--sp-accent`, white text, 600, r-12. Hover → `--sp-accent-deep`.
- Active `scale(0.985)`; focus-visible 2px gold-deep outline +2px offset;
  disabled opacity .55.
- Use: one per view — complete sale, save, confirm.

### 2. Teal button (`.sp-teal-btn`) — "the structure"
- bg `--sp-brand`, white text, 600, r-12. Hover → `--sp-brand-deep`.
- Use: structural actions (Add table, arm/confirm destructive grammar).

### 3. Ghost pill — "the quiet tool"
- `rounded-full border border-[#E3E7E0] bg-white` ink text, hover border-gold.
- Heights: 44px (`h-11`) standard, 40px (`h-10`) in rails. Icon-only must be
  44×44 with `aria-label`.

### 4. Segmented toggle (rhythm-style)
- Container: `rounded-full border hairline bg-white p-0.5`, `role="group"`.
- Active option: `bg-[#0F3D3E] text-white`; inactive: ink-soft, hover ink.
- `aria-pressed` on each option.

## Cards

### `.sp-card` — the container
- White bg, 1px hairline, r-16. Padding `p-5` (dense `p-4`); internal
  vertical rhythm `gap-4`/`gap-3`. Hover (interactive cards): `-translate-y-0.5`
  + shadow-md.

### KPI tile
- Same card skin, `px-3/4 py-2/3`; label 10.5px 600 uppercase tracking-wide
  ink-faint; value 18–22px bold `tabular-nums` (semantic color allowed);
  optional delta line 10.5px 600 (green/red + faint context).
- Tap-to-filter variants add `aria-pressed` + active ring
  `ring-2 ring-[#B88E2F]/30`.

## Status chip
- Tint bg + deep fg + 10px dot (see 02-audit §2 table). Sentence-case label,
  11.5px 600. The dot survives color-blindness; the text survives everything.

## Delta chip
- `+N vs …` green `#2E7D32` / `−N` red `#B4483C`; context span 400 ink-faint.
- Always computed from stored facts; never "—" when the truth is "no data yet"
  — write the honest sentence instead.

## Inputs
- `.sp-input`: white, hairline, r-12; focus = gold border + 3px 18% gold halo;
  placeholder ink-faint. Labels above, sentence case; helper text 11.5px
  ink-faint; errors use terracotta text + `#FDF3F2` panel.

## Lists / rows
- Row: white, hairline bottom, `py-2.5/3`, hover `#FBFBF9`. Dense tables:
  12–13px Poppins, `tabular-nums` right-aligned money in JetBrains Mono.

## Empty state
- Centered stack: Armchair/lucide icon 22–30px ink-faint → serif-italic
  headline (19–22px ink) → 11.5–12.5px ink-soft explanation of what will fill
  it → optional quiet action. Never a bare "No data".

## Skeleton (`.sp-skeleton`)
- Shimmer block, r-16, `#E9E9E6→#F2F1EE`. Shapes mirror the content they
  replace; never a spinner where layout can pre-render.

## Modal / drawer
- Modal: white, r-24 sheet, elevation-modal, Escape closes (unless mid-flight),
  backdrop `rgba(15,61,62,0.4)` click-to-close. Drawer: right slide
  `spDrawerIn` 240ms; backdrop `spFadeIn`.

## Toast / banner
- Tint panel (semantic), terracotta/teal text 13px, Retry ghost pill when
  actionable. Live region polite.

## Print artifacts (receipt / sticker sheet / Z-report)
- Hidden-iframe engine (`lib/printFrame.ts`): afterprint-driven removal +
  60s fallback; remote images pre-warmed (`preloadPrintImage`) because print()
  doesn't wait; every printed `<img>` self-hides on error. Monospace receipt
  302px; A4 sticker sheet with dashed cut lines.

## Charts (Recharts conventions)
- Grid `#E3E7E0` dashed 3/3, horizontal only; X/Y tick 10px ink ramp; bars
  brand teal with gold for the peak/maximum; reference series gray dashed
  (`#969696`, dots r2); tooltip white r-12 hairline + overlay shadow; compare
  mode labels both series by name.
