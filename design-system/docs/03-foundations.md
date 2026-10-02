# 03 — Foundations

> ServePoint Design System · v1.0.0 · Normative. Product code references
> semantic tokens (or the canonical utilities) — never raw primitives.

## 1. Design principles

1. **Honest first** — the UI never fakes data: empty states explain, deltas
   compute from stored facts, broken images hide themselves, zero renders zero.
2. **Hairline does the work** — structure comes from 1px `#E3E7E0` borders;
   shadows whisper only on hover/overlay.
3. **Teal is the spine, gold is the ask** — deep teal structures; brass gold
   is reserved for the moment we ask for action or mark the peak.
4. **Data is dense, voice is human** — 0.5px type steps for instruments;
   Instrument Serif italic for the human sentence on top.
5. **Motion is a courtesy** — 120–160ms, reduced-motion always honored.
6. **Touch is law** — 44px minimum interactive height (`h-11`).

## 2. Color

### Brand triad
| Token | Value | Use |
|---|---|---|
| `--sp-brand` | `#0F3D3E` | Primary structure: rails, primary buttons, charts, headings on light |
| `--sp-brand-deep` | `#0B2E2F` | Brand hover state |
| `--sp-accent` | `#B88E2F` | CTAs, peak markers, active toggles |
| `--sp-accent-deep` | `#967221` | Accent hover + **all focus-visible rings** |
| `--sp-accent-text` | `#8A5A00` | Gold-as-text on white (AA) |
| `--sp-accent-tint` | `#F3E8CF` | Gold washes |

### Air & canvas
| Token | Value | Use |
|---|---|---|
| `--sp-canvas` | `#F6F5F2` | App background — warm paper, never gray |
| `--sp-surface` | `#FFFFFF` | Cards, sheets, rails |
| `--sp-surface-washed` | `#FBFBF9` | Subtle inset zones |
| `--sp-sage` / `--sp-sage-light` / `--sp-sage-mist` | `#D9E2DD` / `#EAF0EC` / `#F1F4F1` | Secondary fills, quiet chips |
| `--sp-hairline` | `#E3E7E0` | Every border |

### Ink ramp (text only)
| Token | Value | Use |
|---|---|---|
| `--sp-ink` | `#1A1A1A` | Headings, values, primary text |
| `--sp-ink-soft` | `#6B6B6B` | Body, secondary |
| `--sp-ink-faint` | `#969696` | Captions, placeholders, footnotes |

### Semantics
| Token | Value | Companion |
|---|---|---|
| success | `#2E7D32` | tint `#EAF4EC` |
| danger | `#B42318` (dot `#B3261E`, text `#B4483C`) | tint `#FDF3F2` |
| warning | dot `#C2571B`, text `#8A5A16` | tint `#FDF3E4` |

Rules: status chips are **tint bg + deep text + saturated dot**; success/danger
color the *delta*, not the whole row; blue/indigo are banned (not in the
palette, not in the brand).

## 3. Typography

| Role | Family | Sizes | Weight |
|---|---|---|---|
| Display | Instrument Serif *italic* | 19 / 22 / 26 / 28 / 30 / 34 / 40 | 400 |
| UI dense | Poppins | 10 / 10.5 / 11 / 11.5 / 12 / 12.5 / 13 / 13.5 | 400–700 |
| UI standard | Poppins | 14 / 15 / 16 / 18 | 500–700 |
| KPI value | Poppins | 18 / 22 | 700–800, `tabular-nums` |
| Money / code | JetBrains Mono | 11–13 | 400–600 |

Rules: `tabular-nums` on every changing number; sentence case always; the
serif voice is italic and reserved for titles/empty-state headlines — never
for data.

## 4. Spacing, radius, elevation

- Space: 4px grid — 4 / 8 / 12 / 16 / 20 / 24 / 32. Card padding `p-5`
  (dense rails `p-4`); grid gaps `gap-2/3/4`.
- Radius: controls **12** (`--sp-r-xl`) · cards **16** (`--sp-r-2xl`) ·
  sheets **24** (`--sp-r-3xl`) · chips/buttons-pills **100** (`--sp-r-pill`).
- Elevation tiers: `rest` (shadow-sm) → `hover` (0 4px 12px) → `overlay`
  (tooltips) → `modal` (0 20px 50px). A card without a border is naked —
  always pair shadow with hairline.

## 5. Motion

| Token | Value |
|---|---|
| press scale | `0.985` (large quiet buttons `0.99`) |
| hover lift | `translateY(-2px)` + elevation hover |
| duration | 120–160ms ease |
| shimmer | 1.4s ease infinite (skeletons) |

Every keyframe ships a `prefers-reduced-motion: reduce` kill switch.

## 6. Iconography

Lucide only. Stroke inherits currentColor. Dense UI sizes: 11–15px; nav 15–18.
Icon-only interactive elements MUST carry `aria-label`.

## 7. Voice & content

Short declarative sentences, plain words, zero exclamation marks in product
copy. Numbers speak exactly ("27", "+25 vs prior 7d (+1250%) · prior 2").
Empty states follow the grammar in 05-patterns §1.
