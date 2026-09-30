# TSOS Compact — One-Page Project State

> **Purpose**: Single-page dense summary of the current TSOS project state, for fast cold re-onboarding by any agent or contributor. Updated alongside every code change. For full chronological detail, see [`docs/compacts/`](docs/compacts/README.md) (7 compacts) and [`worklog.md`](worklog.md) (live agent handover).

- **Project**: TSOS — The Cafe Operating System
- **Version**: 2.8.0
- **Repo**: https://github.com/OmKardile/tsos-alt
- **Author**: Omkar Kardile <omkardile84@gmail.com>
- **Last Updated**: 2026-10-01
- **Default Theme**: **ServePoint** (owner Figma, EXACT tokens since v2.6.7/ADR-0012: ivory `#F6F5F2` canvas, deep-teal `#0F3D3E` primary, gold `#B88E2F` accent (pressed `#967221`), signature sage `#D9E2DD` surfaces, text `#1A1A1A`/`#6B6B6B`, **Poppins**) for the authenticated app since v2.6.6; unauthenticated routes (frozen login, storefront) stay force-pinned Tessera — see [`CHANGELOG.md`](CHANGELOG.md) v2.6.0–v2.8.0 and ADR-0010/0011/0012
- **Render Blueprint**: `render.yaml` → Static Site **`tsos-pos`** (v2.6.3 hardened; v2.6.4 re-hardcoded live Supabase keys — zero-touch apply)
- **Design Governance**: **Login screen FROZEN** at v2.6.4 (ADR-0010) — no changes until owner unfreezes; Surface Pack illustrations reserved for login; **ServePoint UI (owner Figma) adopted as the default post-login design (ADR-0011)**; **Figma REST pipeline UNLOCKED via owner PAT (ADR-0012)** — all 6 pages explored, 57 Final UI frames rendered + archived at `docs/design/servepoint/` (frames/ + pages/); design source is now in-repo, no live Figma access needed

---

## What it is
Enterprise-grade multi-tenant B2B SaaS cloud POS & restaurant management platform for Indian specialty cafes, coffee roasteries, bakeries, and QSRs. Vite SPA + React + Zustand + Supabase (PostgreSQL + RLS + Realtime + PL/pgSQL RPCs). Single-tenant prototype → multi-tenant SaaS migration completed 2026-09-25.

## Tech stack (actual, from `package.json`)
- React `^19.0.1` + React-DOM `^19.0.1`
- TypeScript `^7.0.2`
- Vite `^8.3.0` + `@vitejs/plugin-react ^6.1.1`
- Tailwind CSS `^4.3.3` + `@tailwindcss/vite ^4.3.3`
- Zustand `^5.0.15` (persistent local store)
- Recharts `^3.10.1` (reports/charts)
- `@supabase/supabase-js ^2.116.0` (live backend)
- `lucide-react ^0.546.0`, `motion ^12.23.24`, `canvas-confetti ^1.9.4`
- `@google/genai ^2.4.0`, `express ^4.21.2`, `pg ^8.23.0`, `dotenv ^17.2.3`

## Current state (live)
- **Dev server**: Vite 8.3 on `0.0.0.0:3000`, daemonized via `start-stop-daemon` (survives shell exit). Restart: `bash .zscripts/dev.sh` (sandbox-local, gitignored).
- **Backend**: Live Supabase project `vbufsuzzmehsidshopku` (env vars in `.env`, gitignored). `isSupabaseConfigured()` returns `true`.
- **All routes render with zero console errors**: `/` (auth), `/superadmin`, `/:slug/pos|kds|orders|inventory|menu|tables|customers|offers|shifts|reports|settings`, `/:slug/t:tableNumber` (storefront), `/track/:id`.
- **Live DB data gaps** (outstanding): `categories` + `menu_items` tables exist but empty (menu served from local seed fallback); `customers` + `offers` tables return HTTP 404 to anon key (need migration re-run or RLS fix).

## Architecture (9 ADRs, all Accepted 2026-09-25)
1. **ADR 0001** — Supabase multi-tenant backend (rejected: custom backend, single-tenant)
2. **ADR 0002** — RLS for tenant isolation (rejected: app-layer filtering)
3. **ADR 0003** — Production chrome purge + path-based dynamic routing `/:slug/*` (rejected: prototype surface switcher)
4. **ADR 0004** — Obsidian terminal theme engine, system-wide single toggle (rejected: per-screen dark mode)
5. **ADR 0005** — 10-min ephemeral HMAC-SHA256 QR sessions (rejected: static QR tokens) — eliminates accidental remote orders from browser history
6. **ADR 0006** — Supabase Realtime websockets + offline-resilient queue `tsos_pending_offline_orders` (rejected: polling)
7. **ADR 0007** — Purge hardware hub, freeze WPF for Electron, cancel native mobile apps → pure camera QR browser ordering (rejected: native clients)
8. **ADR 0008** — Render Static Site + Vercel Edge dual cloud deploy (rejected: single host)
9. **ADR 0009** — RBAC role matrix (superadmin/owner/manager/cashier) + tab filtering + route guards + Manager PIN override (rejected: open access)

## Key surfaces & routes
| Surface | Route | Roles |
|---|---|---|
| Auth / login | `/` | public |
| SuperAdmin SaaS console | `/superadmin` | superadmin |
| Counter POS | `/:slug/pos` | cashier, manager, owner |
| Kitchen Display (KDS) | `/:slug/kds` | kitchen, barista |
| Orders directory | `/:slug/orders` | cashier, manager |
| Inventory & recipes | `/:slug/inventory` | manager, owner |
| Menu builder | `/:slug/menu` | manager, owner |
| Tables floor plan | `/:slug/tables` | cashier, manager |
| Customers CRM + loyalty | `/:slug/customers` | manager, owner |
| Offers & promos | `/:slug/offers` | manager, owner |
| Staff & shifts | `/:slug/shifts` | manager, owner |
| Reports & analytics | `/:slug/reports` | manager, owner |
| Settings & fee engine | `/:slug/settings` | owner |
| Storefront (table QR) | `/:slug/t:tableNumber` | anonymous diner (10-min ephemeral session) |
| Order tracking | `/track/:id` | anonymous diner |

## Demo credentials (offline-resilient mode)
- SuperAdmin: `admin@tsos.dev` / `admin123456` (or just `admin`)
- Owner: `owner@coolkafe.com` / `demo123456` (or just `owner`)
- Manager: `manager@coolkafe.com` / `demo123456` (or just `manager`)
- Cashier: `cashier@coolkafe.com` / `demo123456` (or just `cashier`)

## Run it
```bash
git clone https://github.com/OmKardile/tsos-alt.git
cd tsos-alt
npm install   # or bun install / pnpm install
npm run dev   # or bun run dev
# App at http://localhost:3000
```

## Recent activity (live agent handover)
See [`worklog.md`](worklog.md) for the chronological agent work log.

**v2.8.0 (2026-10-01) shipped**: **SuperAdmin ServePoint per Dashboard frame + 4 new features** — the `/superadmin` surface now renders the owner's filled Dashboard frame `219:29880`: deep-teal sidebar (gold roundel, **gold active nav pills**, gold count badges, OTHERS section, pinned profile card with Sign Out), breadcrumb top bar with **quick tenant-jump search** (matches name/city/owner/slug → lands on the Directory pre-filtered via `selectedSuperAdminBusinessId`, now consumed by BusinessDirectory), and the frame's 6-card dashboard: **Daily Sales** dual-axis line chart (teal orders left/integer, gold ₹ revenue right/dashed, deterministic hash-weighted series — Today 9AM–9PM rush curve or 7d/30d weekday series with weekend lift), **MRR by Plan interactive donut** (center swaps to hovered plan; starter sage/growth gold/pro teal/enterprise red; zero-MRR trials kept in legend only), two sage stat tiles (Platform Orders + Recurring Revenue with square chips + dark underlines), **Top Tenants** (Best-Employees analog) + **Busiest Tenants** (Trending-Dishes analog) leaderboards with click-to-jump, **Trial Radar** urgency strip (≤3d red/≤7d gold), lifecycle/health/ops-log cards. **New: shared date-range selector** (Today/7d/30d segmented control drives trend + leaderboard scaling + banner GMV), **CSV platform snapshot export** (verified on disk). Height contract upgraded to **self-measuring** (shell measures own offsetTop + resize listener — zero page scroll at 720p/844p/577p windows; app Header height varies 92–100px). Mobile <lg: sidebar → scrollable pill nav strip + title-row Sign Out. ServePoint remap **section 5e** added (purple→teal, greens→#17803D, ambers→gold, soft-reds→#DC2626) so Directory/Wizard/Subscriptions/Audit tabs ride the owner theme. Legacy TableSide shell+dashboard byte-preserved for tessera/dark/warm. Verified: tsc 0; range switch (GMV ₹6,864→₹15,929); quick-jump E2E; CSV on disk; 3-mode round-trip; mobile 390px; zero console errors.

**v2.7.2 (2026-10-01) shipped**: **Orders two-pane per Bills frames + 3 new features** — the Orders Directory now renders the ServePoint two-pane from frames `219:23130`/`219:24297`: left 420px card list (status dots, table/type·items·customer subtitles, amounts+timestamps, status pills, **date-range filter All/Today/7d**, **summary strip N orders · ₹X combined**, bottom-pinned search) + right detail pane (breadcrumb, status+payment chips, Details 4-col card, Order Info with sage thumbs + gold qty chips + add-ons, full totals block, notes/loyalty strips, **sticky contextual CTA**: deep-teal Move-to-Next via `advanceOrderStatus` / gold Print Invoice for completed) with auto-select of the first order. **New: filtered CSV export** (reuses `exportFinancialLedgerCSV`), **one-tap status advance** (same cloud+KDS path as KDS bump, toast feedback). Two real bugs fixed en route: (1) page-scroll — the two-pane relied on flex inheritance through the auto-height shell (`min-height:auto` growth); heights now measured (`100vh−145px` root, `100vh−204px` container, `min-h-0` on scrollers) and verified `bodyHeight === innerHeight`; (2) **dark-mode hybrid** — the pane was gated `!isTessera` so theme `dark` (servepoint→tessera→dark cycle) rendered the light two-pane under the dark shell; now ServePoint-only, tessera keeps its byte-identical table, dark/warm keep the legacy table + CSS remap (all warm ternaries restored). Verified: tsc 0; 3-mode round-trip; Move-to-Ready E2E (card+KDS count 4→3+toast); Today filter 18→10; zero console errors.

**v2.7.1 (2026-10-01) shipped**: **Reports analytics complete + 2 new features** — Reports internals got their explicit ServePoint passes (the whole screen is now 100% on-theme): **LiveOpsPulse** (was hardcoded Tessera dark; now white card, gold LIVE pill, ivory metric tiles, ServePoint kitchen-severity ramp, sage insight strip) with a **30s auto-refresh heartbeat** ("auto 30s · upd HH:MM:SS"); **WeeklySalesLineChart** (deep-teal `#0F3D3E` revenue line, gold orders line + Daily-Avg reference, sage grid/switcher, Poppins values, white tooltip) with a new **Week-over-Week comparison** — dashed "Last Week (₹)" curve, **+% WoW delta chip** in the highlights strip (green/red), "Same day last week" tooltip row, and a totals footnote; **DailySalesHeatmap** made theme-aware from JS (inline SVG attrs bypass CSS remaps): deep-teal monochrome rush ramp on ComposedChart bars + matrix heat cells + matched legend, gold orders line, `#E3E7E0` chrome. Global ServePoint remap extended (deep warm ramp→teal/sage, blues→info-teal, `#B91C1C`→`#DC2626`, hover/ring variants) benefiting all remaining warm surfaces. Verified: tsc 0; heartbeat ticking; WoW chip +259% rendering; teal ComposedChart + matrix; theme cycle round-trip with Tessera branch intact; Menu/Orders zero remap regressions; zero console errors.

**v2.7.0 (2026-10-01) shipped**: **Cloud order sync FIX + Reports/Receipt ServePoint + receipt sharing** — QA found orders NEVER reached Supabase: `syncOrderToSupabase` pushed demo ids (`biz_coolkafe_99`/`loc-demo-01`) into UUID columns → 22P02 on every sale since v2.6.2. Fix: cached `resolveCloudIds` (tenant by slug, location by tenant — same path as menu hydration), local→cloud order-id map so KDS bumps target cloud rows, guarded `updateOrderStatus`, offline queue carries `tenantSlug`. Sale E2E now passes 22P02 → reaches `42501` RLS (anon INSERT policy pending migration-001 re-run; discriminated info log). Added top-level **ErrorBoundary** (ServePoint recovery card — React had none) + **ReceiptModal WhatsApp share (wa.me, direct chat with guest phone) / Copy receipt** features. Reports/Dashboard explicit ServePoint (frame 219:23581): white header + gold Export split-CTA, white KPI cards (Poppins values, gold Savings hero), gold Top-Items bars on sage tracks, restrained payment trio (sage/gold/teal), Export modal, **OrderTypeBreakdown donut deep-teal/gold/sage on white**. ReceiptModal explicit ServePoint: sage header, gold PAID + tabs, deep-teal Print CTA, gold Next Sale. Verified: tsc 0; console 0/0 on fresh load; Order #105 E2E (sale→receipt→Copy→KDS bump, zero UUID errors); theme round-trip.

**v2.6.9 (2026-10-01) shipped**: **PaymentModal + Dine-in Tables explicit ServePoint** — PaymentModal: sage `#D9E2DD` header with "Amount to Collect" in Poppins semibold `#1A1A1A` + pressed-gold `#967221` amount, all four method tabs share the gold active state (single-accent language replaces the warm four-color rainbow), UPI/Card/Split wells on sage + Cash well on canvas `#F6F5F2`, deep-teal Exact + **Confirm Payment CTA (exact "Charge customer" button `#0F3D3E`→`#0B3132`)**, Poppins semibold summary values (mono retired), ServePoint confetti `[gold, teal, sage]`. TablesScreen (first theme-aware version): ivory canvas, sage icon chip + gold Add CTA, white floor cards (`#E3E7E0` hairlines, gold-ring occupied + deep-teal free badges, gold-tinted order insets), sage selects, Add-Table modal + **QR Stand printout (sage well, deep-teal cafe name, gold CTA)**. Fixed a transient doubled-`>` JSX artifact via byte-level check. Verified: tsc 0 errors; E2E full tender (UPI→Cash→Split) + Order #104 PAID + Tables + QR stand; theme cycle round-trips; zero console errors.

**v2.6.8 (2026-10-01) shipped**: **CartDrawer explicit ServePoint (Bills detail-pane language, frame 219:23130)** — sage `#D9E2DD` header strip (gold bag icon, near-black Poppins title, gold-tinted items pill), order-type tabs on `#E3E7E0` inset; white item cards with `#E3E7E0` hairlines + gold hover ring, Poppins semibold near-black totals (mono retired per Figma), sage qty steppers with gold hover; footer white pane with sage coupon input (gold focus) + **deep-teal `#0F3D3E` Apply button**; totals labels `#6B6B6B` / values semibold `#1A1A1A`; To Pay in pressed-gold `#967221`; **Charge CTA = Figma "Charge customer" button (full-width deep teal → #0B3132, white text)**; empty state sage well + gold bag. Verified: tsc 0 errors; E2E add→cart→PaymentModal→Back round-trip clean; zero console errors; tessera/warm untouched.

**v2.6.7 (2026-10-01) shipped**: **Figma REST pipeline + EXACT ServePoint tokens (ADR-0012)** — owner supplied a `file_content:read` PAT (stored in gitignored `.env`; Render `sync: false` — GitHub Push Protection forbids committing Figma PATs) and 4 local UI kits; all 6 ServePoint pages explored via REST, **57 Final UI frames rendered to PNG** and archived at `docs/design/servepoint/frames/` (+ 6 page overviews); node-fill mining replaced every estimated token: canvas `#F6F5F2`, deep-teal `#0F3D3E`, **gold `#B88E2F`/pressed `#967221`**, signature **sage `#D9E2DD`**, text `#1A1A1A`/`#6B6B6B`, **Poppins**, radii 12/16/24/100; `index.css` token block + remaps rewritten, Header/WebNavbar re-tokened hex-for-hex, PosScreen menu cards got the explicit Figma card (sage surface, gold Add CTA, near-black text, `#DC2626` low-stock badge); fig-kiwi v4 `.fig` uploads documented dead end (below fig2sketch v15). Verified: tsc 0 errors; frozen login pixel-identical; sage/gold POS E2E + cart golden path + 4-theme cycle clean.

**v2.6.6 (2026-10-01) shipped**: **ServePoint UI adoption (ADR-0011)** — `servepoint` ThemeMode as default (stored tessera one-time migrated); `App.tsx` auth-scoped theme pinning (document pinned Tessera while logged out — frozen login untouched); `index.css` servepoint token layer + remaps + `sp-cta`/`sp-sidebar`/`sp-banner`/`sp-ghost`; Header/WebNavbar explicit ServePoint chrome; toggle cycles servepoint→tessera→dark. Tokens were cover-thumbnail ESTIMATES then — replaced by exact values in v2.6.7.

**v2.6.5 (2026-10-01) shipped**: **OrdersScreen explicit Tessera + design governance (ADR-0010)** — Orders tabs as uppercase chartreuse `tessera-block` pills with forest-ghost inactive state; forest-inset search with chartreuse focus ring; status pills chartreuse-active/forest-chip; orders table as `tessera-block` card with serif-italic customer names, chartreuse mono totals, status-palette badges/chips/icons, ghost action buttons, editorial empty state. Warm styling untouched via `isTessera` conditionals. **Owner directives recorded as ADR-0010: login screen (`AuthScreen.tsx`) FROZEN at v2.6.4 (commit 5f38efc) until explicit unfreeze — Surface Pack (Figma Community) illustrations are the future login artwork, shadcn/ui Design System (Figma Community) is the post-login component reference; sandbox is CloudFront-blocked from figma.com (403 verified), asset-export path documented.** Verified: tsc 0 errors; browser E2E filter/tab round-trip clean.

**v2.6.4 (2026-10-01) shipped**: **Live credentials re-hardcoded (owner decision)** — `render.yaml` `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` restored to hardcoded values (reverting v2.6.3's `sync: false` prompt flow → zero-touch blueprint apply); `src/lib/supabase.ts` now embeds the live URL + public anon key as fallback defaults (was a fake `demo-tsos-project` key that silently forced offline-resilient mode when env vars were missing); `import.meta.env` overrides still take precedence; `isSupabaseConfigured()` evaluates resolved constants. Rationale: anon key is public (RLS-protected, not secret); hardcoding kills the "deployed build silently offline" failure class. `service_role` key still forbidden client-side. All other v2.6.3 blueprint hardening untouched. Verified: `tsc --noEmit` 0 errors; browser E2E shows Cloud Synced (24 ms) live session.

**v2.6.3 (2026-10-01) shipped**: **Render blueprint hardened** — `render.yaml` rewritten: service renamed **`tsos-pos`** (was `tsos-cafe-pos`), hardcoded Supabase anon key removed from Git (`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` now `sync: false` → prompted at apply time), build command `npm install --include=dev && npm run build` + `NODE_VERSION=22` (deterministic; repo has bun.lock which Render's npm flow ignores), immutable `/assets/*` cache + `no-cache` index.html + security headers (nosniff/referrer/permissions), `autoDeploy` + free PR previews. Blueprint header documents **why Static Site not Web Service** (pure SPA + Supabase backend; free Web Services sleep after 15 min → 50s+ cold starts vs static sites that never sleep) per ADR-0008. YAML validated; no app code changed.

**v2.6.2 (2026-09-30) shipped**: **Live cloud menu + tender polish** — `loadMenuFromCloud()` in store.ts hydrates categories/menu_items from Supabase per tenant (resolves live tenant UUID by slug when currentTenant.id is a local seed id; falls back to seed menu when empty/unreachable). Live DB seeded: 4 categories + 7 menu_items for CoolKafe (anon-readable; POS/Menu/Storefront render cloud data — confirmed via console log + alphabetical sort). Fixed provisionTenant UUID bug (string ids like `cat_<slug>_coffee` silently failed against UUID PKs → crypto.randomUUID()). VariantModal + PaymentModal fully Tessera (forest shells, tessera-block shadows, status-palette method tiles, tessera-cta Confirm Payment, chartreuse confetti; QR kept white for scanning). E2E verified: live menu → cart → Charge/Pay → Escape closes PaymentModal (outstanding v2.5.0 test ✓) → UPI simulate → Order #104. tsc 0 errors, all routes clean.

**v2.6.1 (2026-09-30) shipped**: **Tessera chrome polish** — explicit `isTessera` conditional styling shipped for Header (chartreuse TSOS brand block + `tessera-block` shadow, serif tenant name, Fast PIN as `tessera-cta`, forest profile dropdown), WebNavbar (chartreuse active tab + 2px baseline marker, soft-tinted status badges, `tessera-block` More dropdown), PosScreen (forest ribbon, chartreuse category pills with block shadow, lifted menu cards with chartreuse hover, chartreuse prices), CartDrawer (forest drawer, chartreuse items pill, `tessera-cta` Charge/Pay checkout). KDS board converted via new CSS zinc→forest remap (`src/index.css` §11) + chartreuse header flourishes. Bug fix: `hover:bg-[#FAFAFA]` white-flash on forest cards (Settings/Inventory/Offers). Theme round-trip tessera↔dark regression-verified in browser; tsc 0 errors; all routes console-clean.

**v2.6.0 (2026-09-30) shipped**: **Tessera UI Kit redesign** — new `tessera` ThemeMode (default), Instrument Serif italic headlines + Inter body, deep forest surfaces (`#0A1410`/`#0F1D17`/`#1F3D2E`), vivid chartreuse action accent (`#C5F82A`), 3D isometric block-motif utilities (`.tessera-block`/`.tessera-cta`/`.tessera-ghost`/`.tessera-grain`). AuthScreen fully redesigned as Tessera showcase; Reports widgets (LiveOpsPulse, OrderTypeBreakdown, KPI cards) polished with explicit `tessera-block` shadows + chartreuse accents. CSS variable override layer maps every warm-cream hex to forest when `[data-theme="tessera"]`. Inspired by [uiverse.io/ui-kits/tessera](https://uiverse.io/ui-kits/tessera).

**v2.5.0 (2026-09-30) shipped**: Reports screen expanded with **LiveOpsPulse**, **OrderTypeBreakdown** donut, **useCountUp** animated KPIs. Modal Escape/backdrop UX fixed. Docs re-aligned (version drift, stale URLs, index fixes, created root `compact.md` + `decisions.md`, deleted typo'd `technical-dcoumentation.md`). Build config hardened. Live Supabase DB connected. Git history recovered via fresh re-clone.

## Canonical doc map (where to look)
| Need | Read |
|---|---|
| Catch-up (this file, dense) | `compact.md` (root) |
| Decisions / ADRs (single-file summary) | `decisions.md` (root) → detail in `docs/decisions/` |
| Live agent handover | `worklog.md` (root) |
| Original engineering log | `docs/worklog/2026-09-25.md` |
| Versioned releases | `CHANGELOG.md` |
| Architecture / schema / RPCs | `technical-documentation.md` |
| Business model / pricing / ROI | `business-documentation.md` |
| Setup / deploy / credentials | `help.md` |
| Chronological milestones | `docs/compacts/compact1-7.md` |
| Prompt / directive ledger | `docs/requests/request-history.md` |
| Security & scaling research | `docs/research/01,02` |

## Open issues / next priorities
1. Seed live `menu_items` + `categories` for the `coolkafe` tenant (currently served from local fallback).
2. Create / unblock `customers` + `offers` tables in live Supabase (re-run migration `001_multi_tenant_saas.sql`).
3. Verify realtime: a new order inserted via POS should appear in KDS instantly (now that live DB is connected).
4. Add Vitest + React Testing Library smoke tests (repo ships no automated tests).
5. Styling polish + feature expansion per the recurring 15-min `webDevReview` cron (job 425841).
