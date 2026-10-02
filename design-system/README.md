# ServePoint Design System

> The formal design language of **ServePoint — smartPOS**, extracted from the
> production web app by evidence (code censuses), organized for reuse.
> v1.0.0 · 2026-10-03 · light theme (the app's declared design)

## Why this exists

The owner's directive: *"I liked the whole site's UI/UX very much — create one
whole design system around the web app. First research how to create a design
system, then create it in a separate root directory."* This folder is that
system: research first, then an evidence-based audit, then tokens, foundations,
component specs, patterns, governance, and a living showcase that renders it all.

## Structure

```
design-system/
├── README.md            ← you are here
├── CHANGELOG.md         ← DS version history (semver)
├── docs/
│   ├── 01-research.md      ← how design systems are created (methodology + sources)
│   ├── 02-audit.md         ← the app's real design language, with census counts
│   ├── 03-foundations.md   ← color, type, space, radius, elevation, motion, icons, voice
│   ├── 04-components.md    ← button/card/chip/input/modal/chart/print specs
│   ├── 05-patterns.md      ← honesty, arm→confirm, IST math, print honesty, a11y…
│   └── 06-governance.md    ← change rules, versioning, contribution checklist
├── tokens/
│   ├── servepoint.tokens.json  ← source of truth (W3C DTCG-style, 3 tiers)
│   └── servepoint.css          ← drop-in CSS custom properties + utilities
└── showcase/
    └── index.html          ← the living style guide (open it in a browser)
```

## The system in one paragraph

A warm-paper canvas (`#F6F5F2`) under hairline-led white cards (16px radius,
`#E3E7E0` borders), structured by a deep-teal spine (`#0F3D3E`) with a brass
gold accent (`#B88E2F`) reserved for asks and peaks; Poppins carries dense
10–15px UI data, Instrument Serif *italic* speaks the human titles, JetBrains
Mono handles money and code; pills dominate the geometry (306 of them); motion
is a 120–160ms courtesy with reduced-motion kill switches; Lucide icons inherit
text color; and the whole thing is governed by **honesty** — empty states
explain, deltas cite stored facts, broken images vanish, zero renders zero.

## Quick start

```css
/* Adopt the tokens in any surface: */
@import url('../tokens/servepoint.css');  /* or copy the :root block */

.card {
  background: var(--sp-surface);
  border: 1px solid var(--sp-hairline);   /* hairline does the work */
  border-radius: var(--sp-r-2xl);         /* 16px */
}
.cta { background: var(--sp-accent); }    /* gold is the ask */
```

Read the docs in order (01 → 06) when adopting; open
`showcase/index.html` to see every token and component rendered live.
