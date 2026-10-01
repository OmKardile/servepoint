# ADR 0011 — ServePoint UI Adoption (Owner Figma) as the Default Post-Login Design

- **Status**: Accepted
- **Date**: 2026-10-01
- **Deciders**: Omkar Kardile (owner), directive issued 2026-10-01
- **Tags**: `design`, `theme`, `servepoint`, `ui`

## Context

The owner provided their own Figma file — [*ServePoint POS Preview*](https://www.figma.com/design/P14mYyvxyrZlkMonqobnWL/ServePoint-POS-Preview) (LOKOMAX STUDIO; "Every order, room, and receipt in one view") — and directed: *"refer this UI from my figma; explore all pages; use this ui."*

**Asset access reality (verified 2026-10-01)**: the sandbox is CloudFront-blocked from `figma.com` app pages (HTTP 403 via curl and agent-browser). The Figma REST API likewise requires a personal access token (403 without one). The **file cover thumbnail** (800×450 WebP) *is* reachable via the thumbnail CDN redirect and was recovered and analyzed. The cover exposes the design language and two key screens (Dashboard with dark-green sidebar, and the POS menu grid); the remaining pages are not retrievable programmatically today.

**Extracted ServePoint design language** (from the cover):
- Warm ivory canvas (`#F2EFE5`), pure-white rounded cards with soft forest-tinted shadows
- Deep forest-green primary (`#17402E` headings/sidebar), deep-green dark panels
- Amber/mustard action accent (`#E9A63C`) — active nav, category banners ("BURGERS"), highlight numerals
- Bold geometric sans headings (Plus Jakarta Sans), warm hairline borders (`#E7E2D2`)
- Chart donut/line in teal/blue/amber/green; stat chips ("98% UPTIME", "24 ACTIVE TABLES", "1.8s SYNC TIME")

## Decision

1. **ServePoint becomes the default theme** for the **authenticated app**: a new `servepoint` ThemeMode ships as the default (fresh sessions; stored `tessera` values are one-time-migrated because Tessera was agent-imposed, never owner-chosen). Toggle cycles `servepoint → tessera → dark → servepoint`; warm/obsidian remain reachable via `setThemeMode`.
2. **The unauthenticated document stays force-pinned to Tessera**: while `!authSession` (login screen, public storefront/track routes) App.tsx sets `data-theme="tessera"` regardless of stored preference. This keeps ADR-0010's frozen login pixel-identical (its approved environment was Tessera) with **zero edits to `AuthScreen.tsx`**, and preserves public surfaces' approved look.
3. **Implementation** (same CSS-variable + remap architecture as Tessera, ADR-0004): `[data-theme="servepoint"]` token layer in `src/index.css` (ivory canvas, white cards + soft shadow treatment on `.bg-white`, stone→forest text remaps, orange→amber accent remaps, dark-stone strips→forest-green remap, Plus Jakarta Sans headings — geometric bold, *not* italic), plus `sp-cta` / `sp-sidebar` / `sp-banner` / `sp-ghost` utilities. Header and WebNavbar carry explicit `isServepoint` branches (amber brand block, amber active tab + baseline marker, `sp-cta` Fast PIN, ivory chrome). All existing themes remain fully functional behind conditionals.
4. **Surface-by-surface ServePoint pass continues** in subsequent rounds: POS menu cards + CartDrawer banner treatment, Reports/SuperAdmin dashboard (line + donut charts, stat chips per the cover), Orders/Customers/Tables/Inventory/Menu/Offers/Shifts/Settings, PrintLogsSection, Storefront.

## Figma Access Paths (to unlock "explore all pages")

- **Path A (preferred)**: owner creates a Figma personal access token (Settings → Security) and places `FIGMA_TOKEN=<pat>` in `.env` — the REST API (`/v1/files/:key`, `/v1/images/:key`) then yields every page's node tree + rendered PNGs for pixel-exact matching.
- **Path B**: owner exports page screenshots into the repo (e.g. `docs/design/servepoint/`).
- Until then, the cover thumbnail (`/tmp` copy archived as `docs/design/servepoint/cover-thumbnail.webp`) is the single source of truth.

## Alternatives Rejected

- **Restyling Tessera in place**: destroys the owner-approved dark editorial theme (ADR-0010 freeze pins the login to it) and conflates two design systems.
- **Making ServePoint global including unauthenticated routes**: would visually change the frozen login (its h1 typography and canvas are theme-dependent) — violates ADR-0010.
- **Waiting for full Figma access before starting**: the cover carries the complete token set; surface passes can refine when assets arrive.

## Consequences

- ✅ The app now wears the owner's own design; login stays frozen (ADR-0010) via auth-scoped theme pinning.
- ✅ All four prior themes remain intact and reachable; zero destructive migration.
- ⚠️ Non-explicit surfaces approximate ServePoint through the CSS remap layer until their explicit pass (warm-branch fallbacks are already light-themed, so the approximation is close).
- ⚠️ Full-page Fidelity is blocked on a Figma PAT or exported screenshots (paths documented above).
