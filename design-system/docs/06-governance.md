# 06 — Governance

> ServePoint Design System · v1.0.0

## 1. Ownership & cadence

- The design system lives at repo root `design-system/` and evolves with the
  app it describes. It is maintained in the same commit discipline as app code
  (every change lands with a DS `CHANGELOG.md` entry).
- The **tokens JSON is the source of truth**; `tokens/servepoint.css` is its
  build; `src/index.css` is the app's runtime copy. When they drift, the JSON
  wins and the others follow in the same PR.

## 2. Change rules

1. **Add, don't rename.** Renames break consumers; deprecate instead
   (mark `"$deprecated": true` + replacement token, keep shipping).
2. **New values need evidence.** A primitive enters only with a usage census
   (audit-style count) or a written use case; one-off hexes in product code
   are bugs, not precedents.
3. **Semantic before raw.** Product code may reference semantic tokens and
   canonical utilities only.
4. **Every component change updates its spec** in `docs/04-components.md`
   and, when visible, the showcase — docs and pixels ship together.
5. **Versioning**: semver. MAJOR = breaking token/grammar change; MINOR = new
   tokens/components/patterns; PATCH = corrections, docs, showcase polish.

## 3. Contribution checklist

- [ ] Tokens changed? JSON + CSS build + `src/index.css` sync + DS changelog.
- [ ] New component/pattern? Spec in 04/05 + showcase specimen + a11y contract.
- [ ] Census re-run if the palette/type/geometry sets move (document counts).
- [ ] `tsc` clean; showcase renders in agent-browser with zero console errors.
- [ ] App `CHANGELOG.md` entry when the deliverable is user-visible.

## 4. Relationship to the app's ADRs

- ADR-0012 (production theme tokens) — this system is its formalization.
- ADR-0014 (production rebuild) — the utility layer mirrors its conventions.
- ADR-0016 (login screen frozen read-only) — the showcase may *document* the
  auth screen but no token change may alter it without the owner's explicit
  instruction.

## 5. Out of scope for v1.0

Dark theming (app is light-only by declared design), multi-brand theming,
Figma-side libraries, icon font (Lucide dependency suffices). These are
deliberate non-goals until the product asks.
