# Design System Changelog

Semver. The tokens JSON is the source of truth; see docs/06-governance.md.

## [1.0.0] — 2026-10-03

### Added
- **Research** (`docs/01-research.md`): industry methodology for creating a
  design system (audit → tokenize → foundations → components → patterns →
  documentation → governance), grounded in a live web-search sweep (Figma,
  USWDS, Brad Frost) and the canonical public systems (Material, Carbon,
  Polaris, Atlassian, Lightning, W3C DTCG token format).
- **Audit** (`docs/02-audit.md`): evidence-based extraction of the web app's
  design language — full color census (top 30 hexes with counts), typography
  roles + size census, radius/shadow/icon/motion/a11y censuses, the status
  semantic table, and the content voice. Nothing invented.
- **Tokens**: `tokens/servepoint.tokens.json` — 3-tier architecture
  (primitive → semantic → component), 31 internal references, all validated
  resolving; `tokens/servepoint.css` — the drop-in build with the canonical
  utility layer (`sp-cta`, `sp-teal-btn`, `sp-card`, `sp-input`, `sp-skeleton`).
- **Foundations** (`docs/03-foundations.md`): six design principles + color /
  type / space / radius / elevation / motion / iconography / voice norms.
- **Components** (`docs/04-components.md`): specs for buttons (4 variants),
  cards, KPI tiles, status chips, delta chips, inputs, lists, empty states,
  skeletons, modal/drawer, toasts, print artifacts, chart conventions.
- **Patterns** (`docs/05-patterns.md`): eleven normative UX patterns — the
  honesty family, two-step destructive grammar, IST-first calendar math,
  derived-never-stored, fail-soft ride-alongs, one-scan-one-window, print
  honesty, realtime courtesy, the a11y contract, i18n, progressive disclosure.
- **Governance** (`docs/06-governance.md`): add-don't-rename, evidence-based
  tokens, docs-and-pixels-ship-together, semver, ADR relationships, v1
  non-goals.
- **Showcase** (`showcase/index.html`): the living style guide — palette,
  ink ramp, status semantics, typography specimens, geometry, motion, and
  live component specimens rendered with the real tokens.
