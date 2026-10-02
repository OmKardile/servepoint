# 01 — Research: How a Design System Is Created

> ServePoint Design System · v1.0.0 · 2026-10-03
> Methodology research performed before building `design-system/`, per the owner's
> directive: "FIRST RESEARCH ON HOW TO CREATE A DESIGN SYSTEM."

## 1. What a design system actually is

A design system is **not** a Figma file, not a component library, and not a style
guide alone. The working definition used across the industry:

> A design system is the single source of truth — **tokens + foundations +
> components + patterns + documentation + governance** — that lets a team
> assemble consistent product experiences faster than rebuilding them.

The canonical public systems all ship the same six layers, differing only in
depth: **Material** (m3.material.io), **IBM Carbon** (carbondesignsystem.com),
**Shopify Polaris** (polaris.shopify.com), **Atlassian Design**
(atlassian.design), **Salesforce Lightning** (lightningdesignsystem.com), **US
Web Design System** (designsystem.digital.gov — whose "design principles" page
appeared in our live research sweep and states the same layering).

## 2. The industry-standard creation sequence

Synthesized from the research sweep (Figma's "Documentation That Drives
Adoption", Brad Frost's atomic-design maintenance essays, USWDS principles,
UXPin/oneThing complete guides) and the published practices of the systems
above:

| # | Step | What it means | Where it lands in this repo |
|---|------|---------------|------------------------------|
| 1 | **Audit** | Crawl the existing product; count every color, size, radius, component. Evidence, not taste. | `docs/02-audit.md` (rg-based censuses with real counts) |
| 2 | **Tokenize** | Freeze raw values into a 3-tier token architecture (see §3). | `tokens/servepoint.tokens.json` + `tokens/servepoint.css` |
| 3 | **Foundations** | Color roles, type scale, spacing grid, radius, elevation, motion, iconography, voice. | `docs/03-foundations.md` |
| 4 | **Component specs** | Anatomy, variants, states, a11y contract per recurring component. | `docs/04-components.md` |
| 5 | **Patterns** | Cross-component UX rules (empty states, confirmation grammar, time math). | `docs/05-patterns.md` |
| 6 | **Documentation + living showcase** | A style guide that *renders* the system, not just describes it. | `showcase/index.html` |
| 7 | **Governance** | Versioning, change rules, deprecation policy — or the system rots. | `docs/06-governance.md` + DS `CHANGELOG.md` |

Key industry lesson we adopt explicitly: **start from an audit of real usage**,
not from an idealized palette. (Frost: "maintaining" a system is the hard part;
USWDS: principles must be actionable; Carbon: tokens are the contract between
design and code.)

## 3. Token architecture (the 3-tier contract)

The modern standard (W3C Design Tokens Community Group draft format,
design-tokens.github.io/community-group/format/):

- **Tier 1 — Primitive**: raw, context-free values (`#0F3D3E`, `12px`, `Poppins`).
  Named by scale, not by use.
- **Tier 2 — Semantic**: role-named aliases (`--sp-brand`, `--sp-danger-tint`,
  `--sp-r-card`). Product code references ONLY this tier + component tier.
- **Tier 3 — Component**: assembled constants (`--sp-elev-rest`, button heights).

Rules we adopt:
1. Product code never hard-codes a hex that exists in the token file.
2. Every semantic token cites its primitive; every primitive cites its census
   evidence (usage count in the audit).
3. Renames are forbidden — add, alias, deprecate (see governance).

## 4. What "around the whole web app" means here

The owner's directive: the system must capture the **ServePoint web app's actual
UI/UX** — the warm-paper canvas, deep-teal spine, brass-gold accent, hairline-led
cards, Instrument Serif italic display voice, Poppins data-dense body, pill
geometry, honest empty/delta states, two-step destructive grammar, IST-first
calendar math, and print-grade honesty. `docs/02-audit.md` proves every claim
with codebase censuses; nothing in this system is invented.

## 5. Sources consulted (live sweep + canonical references)

Live search sweep (2026-10-03, z-ai web_search):
- Figma — *Documentation That Drives Adoption (Design Systems 103)* — figma.com
- US Web Design System — *Design principles* — designsystem.digital.gov
- Brad Frost — *Maintaining Design Systems* — atomicdesign.bradfrost.com
- oneThing design — *What is a Design System? The Complete Guide*
- UXPin — *Content Design System — Do You Need It?*
- Muz.li / Design Systems Collective — token & AI-era system essays

Canonical systems referenced as methodology benchmarks:
- Material Design 3 — m3.material.io
- IBM Carbon — carbondesignsystem.com (token tiers, governance)
- Shopify Polaris — polaris.shopify.com (foundations docs shape)
- Atlassian Design System — atlassian.design (patterns + content voice)
- Salesforce Lightning — lightningdesignsystem.com (component states)
- W3C DTCG token format — design-tokens.github.io/community-group/format/
