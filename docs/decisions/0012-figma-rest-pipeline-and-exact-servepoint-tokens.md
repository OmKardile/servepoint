# ADR-0012: Figma REST Pipeline & Exact ServePoint Design Tokens

- **Status**: Accepted
- **Date**: 2026-10-01
- **Deciders**: Owner (Om Kardile) + TSOS engineering agent
- **Supersedes**: the "estimated tokens" state of ADR-0011 (§ Interim source of truth)
- **Related**: ADR-0010 (login freeze — unchanged), ADR-0011 (ServePoint adoption)

## Context

ADR-0011 adopted the owner's *ServePoint POS Preview* Figma as the default
post-login UI, but the sandbox could not read figma.com (CloudFront 403), so
the v2.6.6 token set was **estimated from an 800×450 cover thumbnail**
(ivory `#F2EFE5`, forest `#17402E`, amber `#E9A63C`, Plus Jakarta Sans).

Two unlocks arrived together:

1. **Owner supplied a Figma Personal Access Token** with `file_content:read`
   scope, explicitly instructing it be stored in `.env` **and** `render.yaml`.
2. **Owner uploaded 4 local design kits** to `upload/` for reference:
   *ServePoint*-adjacent POS/dashboard kits — `POS ui kit.rar` (Dae Alright!
   food-delivery kit, 2019), `FoodPOSDark_Tablet.fig` + `Dazboard .fig`
   (fig-kiwi **v4** binaries), and a Dashboard UI Kit `.sketch`.

## Decision

1. **Token custody**: `FIGMA_TOKEN` is stored verbatim in `.env` (gitignored,
   tooling use). For Render, the blueprint declares `- key: FIGMA_TOKEN,
   sync: false` — the owner pastes the value once at blueprint apply and
   Render stores it in the service environment. **The token cannot be
   committed**: GitHub Push Protection (GH013) classifies Figma PATs as
   protected secrets and rejects pushes containing them (verified live,
   2026-10-01). Scope is read-only for file content; revocable from
   Figma → Settings at any time.
2. **REST pipeline**: agents may now call `api.figma.com/v1` directly
   (`/v1/files/:key`, `/v1/files/:key/nodes`, `/v1/images/:key`) to explore
   every page and render any frame to PNG. Renders are archived under
   `docs/design/servepoint/` (`frames/` = all 57 "04 Final UI" screens,
   `pages/` = 6 page overviews) so future agents never need live API access
   to reason about the design.
3. **Exact tokens replace estimates.** Mined from node fills of "04 Final UI"
   + "05 Components" (Add-to-Order frame 219:30062 et al.):

   | Role | EXACT value | Replaces estimate |
   |---|---|---|
   | Page canvas | **`#F6F5F2`** ivory | ~~#F2EFE5~~ |
   | Depth / sidebar / dark CTA | **`#0F3D3E`** deep teal | ~~#17402E forest~~ |
   | Action accent | **`#B88E2F`** gold, pressed **`#967221`** | ~~#E9A63C / #D89430 amber~~ |
   | Signature surface (cards, inputs, user card) | **`#D9E2DD`** sage | (new) |
   | Detail cards / chat | `#FFFFFF` + soft teal shadow | unchanged |
   | Text primary / muted | **`#1A1A1A`** / **`#6B6B6B`** (light `#969696`) | ~~forest-greens~~ |
   | Danger | `#DC2626` | confirmed |
   | Type | **Poppins** 400/16 · 500/16 · 600/24 (captions 12/14) | ~~Plus Jakarta Sans~~ |
   | Radii | 4 chips · 12 buttons/inputs · 16 cards · 24 large · 100 pills | confirmed |

4. **Application surface (v2.6.7)**: `[data-theme="servepoint"]` token block +
   all remaps in `index.css`; `Header.tsx` / `WebNavbar.tsx` ServePoint
   branches re-tokened hex-for-hex; `index.html` imports Poppins and serves
   ServePoint body classes; **PosScreen menu cards** get the Figma card
   language explicitly (`isServepoint` branch): sage `#D9E2DD` card,
   `#E3E7E0` image well, gold Add button (`#B88E2F` → `#967221`), near-black
   text, `#C9D3CC` footer divider, `#DC2626` low-stock badge.
5. **Local kits triage**: `.sketch` (zip) and `.rar` (PNG exports) are mined
   for layout reference only; the two fig-kiwi **v4** `.fig` files are below
   fig2sketch's minimum (v15) and image-carving yields only chunk-internal
   buffers — documented as a dead end so future agents don't retry. They are
   superseded by the live REST pipeline for the operative design (ServePoint).

## Frozen surfaces

**ADR-0010 stands**: `AuthScreen.tsx` remains untouched; the unauthenticated
document is still force-pinned to Tessera by `App.tsx` (re-verified this
release — logged-out screenshot pixel-identical to the frozen v2.6.4 state).

## Consequences

- **Positive**: ServePoint fidelity is now pixel-sourced, not guessed; the
  full design corpus (57 screens + components) is archived in-repo; future
  screens (CartDrawer, Bills→Orders, Dashboard/SuperAdmin) can be built
  against exact frames without network access.
- **Negative**: the PAT lives in `.env` + Render service env (`sync: false` — GitHub Push Protection forbids committing it; rotate = update `.env`, re-paste in Render, and touch up this ADR).
- **Neutral**: theme cycle, other themes, and the frozen login are unaffected
  (verified by E2E).
