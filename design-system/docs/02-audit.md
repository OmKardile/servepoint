# 02 — Audit: The ServePoint Web App's Real Design Language

> ServePoint Design System · v1.0.0 · 2026-10-03
> Every number below is a live census of `src/` (rg counts, 2026-10-03, HEAD
> `13cd105`). This system codifies what the app already does — nothing invented.

## 1. Where the current system lives

- `src/index.css` — the ADR-0012 `:root` token block (17 custom properties),
  canonical utilities (`sp-cta`, `sp-teal-btn`, `sp-card`, `sp-input`,
  `sp-nav-pill`, `sp-skeleton`), scrollbar spec, five `@keyframes` with
  `prefers-reduced-motion` guards.
- Tailwind CSS 4 utility classes inline across ~180 component files.
- The app is **light-theme only by design** ("no theme system" — `prefs.ts`),
  with compact-mode + region prefs instead. Dark mode is out of scope for v1.

## 2. Color census (hex occurrences in src/, top 30)

| Rank | Hex | Count | Role (semantic tier) |
|---|---|---|---|
| 1 | `#1A1A1A` | 316 | ink — primary text, headings |
| 2 | `#6B6B6B` | 292 | ink-soft — body/secondary text |
| 3 | `#0F3D3E` | 280 | brand deep teal — the spine |
| 4 | `#E3E7E0` | 269 | hairline — every border |
| 5 | `#B88E2F` | 219 | accent brass gold — CTAs, peaks |
| 6 | `#969696` | 207 | ink-faint — captions, placeholders |
| 7 | `#2E7D32` | 111 | success green |
| 8 | `#F6F5F2` | 97 | canvas — warm paper background |
| 9 | `#B42318` | 67 | danger red |
| 10 | `#B3261E` | 66 | danger dot (session "cut" state) |
| 11 | `#967221` | 52 | accent-deep — hover gold, focus rings |
| 12 | `#8A5A00` | 49 | accent-text — gold readable on white |
| 13 | `#D9E2DD` | 44 | sage |
| 14 | `#B4483C` | 37 | danger-text terracotta |
| 15 | `#EAF0EC` | 36 | sage-light |
| 16 | `#8A938C` | 34 | sage-600 text |
| 17 | `#FEF2F2` | 22 | danger wash |
| 18 | `#FDF3F2` | 17 | danger tint (terracotta-50) |
| 19 | `#5F6B63` | 17 | sage-700 text |
| 20 | `#C9CFC9` | 16 | scroll thumb |
| 21 | `#F0F2EF` | 15 | paper-100 |
| 22 | `#8A5A16` | 15 | amber-800 (occupied fg) |
| 23 | `#FFF4DB` | 12 | gold-50 wash |
| 24 | `#FCEBEA` | 12 | danger wash alt |
| 25 | `#F3E8CF` | 12 | gold tint |
| 26 | `#F1F4F1` | 11 | sage mist (reserved bg) |
| 27 | `#FBFBF9` | 10 | paper-150 (washed surface) |
| 28 | `#C8CFC9` | 10 | sage border alt |
| 29 | `#F7F8F6` | 9 | paper alt |

**Reading**: the palette is a *triad* — deep teal (structure) + brass gold
(action) + sage/paper (air) — with a strict ink ramp (#1A1A1A → #6B6B6B →
#969696) and semantic greens/reds used sparingly. No blue, no indigo, anywhere.

### Status semantics (Floor `STATUS_META` — the canonical status grammar)

| Status | bg | fg | dot |
|---|---|---|---|
| Available | `#EAF4EC` | `#2E7D32` | `#2E7D32` |
| Occupied | `#FDF3E4` | `#8A5A16` | `#C2571B` |
| Reserved | `#F1F4F1` | `#0F3D3E` | `#0F3D3E` |
| Billing | `#FDECEA` | `#B4483C` | `#B4483C` |

Pattern: **tint background + readable-deep text + saturated dot** — the dot
carries the state at a glance, the text stays AA-legible.

## 3. Typography

Loaded (Google Fonts, `index.html`): **Poppins** 400–700, **Inter** 300–800,
**Instrument Serif** ital 0/1, **JetBrains Mono** 400–600, **Plus Jakarta
Sans** 400–800. Body stack: `Poppins, Inter, system-ui`.

Roles:
- **Display / voice**: Instrument Serif, *italic* — screen titles, section
  poetry ("Floor", "Nothing reserved right now"). 21 uses, 19–40px.
- **UI / data**: Poppins — every control, label, table, chip. 10–15px is the
  dense working range.
- **Numbers / code / print**: JetBrains Mono (13 uses) — money figures,
  QR URLs, session tokens, receipts.

Size census (top of ~60 distinct values):
`13px ×154 · 12.5px ×148 · 12px ×117 · 11px ×93 · 11.5px ×89 · 13.5px ×82 ·
10.5px ×82 · 14px ×62 · 15px ×50 · 10px ×43 · 18px ×17 · 22px ×12 · 16px ×11 …`
The scale is **deliberately dense** (0.5px steps in the working range) because
POS surfaces are data instruments; display sizes step coarsely (19→22→26→28→30).

## 4. Geometry

- **Radius census**: `rounded-full ×306 · rounded-xl ×190 (12px) ·
  rounded-2xl ×98 (16px) · rounded-lg ×39 · rounded-3xl ×18 (24px)`.
  Pills dominate — controls, chips, filters; cards live at 16px; sheets 24px.
  (ADR-0012 comment: "Radii 12/16/24/100".)
- **Space grid**: 4px base; `p-5/p-4` card paddings, `gap-2/3/4` rhythm.
- **Elevation is hairline-first**: `shadow-sm ×32 · md ×7 · xl ×6 · lg ×4` —
  borders (`#E3E7E0`) carry structure; shadows are a whisper, reserved for
  hover lift and overlays.

## 5. Iconography

Lucide only (26 files import from `lucide-react`). Top: RefreshCw ×14,
Loader2 ×12, Plus ×9, X ×8, ChevronDown ×8, AlertTriangle ×7, Copy ×6,
Clock ×6, Check ×6. Stroke inherits text color; sizes 11–15px in dense UI.

## 6. Motion

- Durations 120–160ms `ease`; press `scale(0.985)` (0.99 on large quiet
  buttons); hover lift `-translate-y-0.5` (−2px) with shadow-md.
- Keyframes: `sp-shimmer` (skeletons, 1.4s), `spPwaDrop/spPwaRise`,
  `spDrawerIn/spFadeIn` (guest drawer), `spStarPop/spThanksRise` (feedback).
- Every decorative animation carries a `prefers-reduced-motion: reduce` kill
  switch. Motion is a courtesy, never a requirement.

## 7. Accessibility census

741 lines carrying `aria-*`/`sr-only` attributes across components. Conventions:
semantic landmarks (`main/header/nav/section`), `aria-pressed` on toggles,
`aria-label` on icon-only buttons, `sr-only` for screen-reader-only content,
`focus-visible` gold rings on every interactive element, 44px (`h-11`) minimum
touch targets.

## 8. The voice (content design)

Sentence-case everywhere; British-neutral English; the app speaks in small
honest sentences — "tables hold themselves when orders land", "the rhythm
builds itself as rounds land", "no prior-week tickets in the loaded ledger
yet". Numbers are never rounded into fiction; empty states explain what will
fill them. This voice is part of the system (see 05-patterns §1).
