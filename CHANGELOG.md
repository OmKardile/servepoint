# Changelog

All notable changes to **TSOS (The Cafe Operating System)** are recorded in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.6.1] — 2026-09-30 — Tessera Chrome Polish: Header, Navbar, POS, Cart & KDS

### Redesigned — Explicit Tessera Surfaces (conditional `isTessera` classes; warm/dark/obsidian styling preserved untouched)
- **Header** (`src/components/common/Header.tsx`): TSOS brand pill is now a chartreuse block (`#C5F82A` on forest text) with `tessera-block` 3D offset shadow + uppercase tracking; tenant name set in italic serif; model line shows `₹0/mo` in emerald + per-order fee in chartreuse; outlet selector, printer chip, audio toggle, dark-mode toggle and profile chip restyled as forest ghost buttons with chartreuse hover borders; **Fast PIN promoted to the primary `tessera-cta`** (chartreuse block with hover lift); profile dropdown uses `tessera-block` shadow, forest gradient identity card, uppercase tracked chartreuse role badge, and serif italic user name; role avatars use the Tessera status palette (superadmin `#C084FC`, owner `#C5F82A`, manager `#60A5FA`, cashier `#34D399`); SuperAdmin impersonation banner tuned to accent `#C084FC` on forest.
- **WebNavbar** (`src/components/common/WebNavbar.tsx`): active tab is a chartreuse tint block (`bg-[#C5F82A]/15`, chartreuse text + border) with a new **chartreuse baseline marker** (2px underline) beneath it; inactive tabs are sage ghost buttons with forest hover; KDS/Staff/Stock count badges restyled as soft-tinted status chips (amber/emerald/rose at 15% opacity + 40% border) instead of solid fills; "More" dropdown is a `tessera-block` forest panel with chartreuse active rows; low-stock alert chip restyled in rose soft tint.
- **PosScreen** (`src/components/pos/PosScreen.tsx`): status ribbon on forest surface with chartreuse outlet name, emerald drawer chip and chartreuse tabular-nums clock; search input with chartreuse focus ring; category pills use solid chartreuse active state with `2px 2px 0` block shadow; menu cards get forest surface + chartreuse hover border + lift (`hover:-translate-y-0.5` + layered shadow), uppercase tracked chartreuse "Customizable" badge, chartreuse prices in `tabular-nums`, and chartreuse-tinted Add buttons that fill solid on hover; veg toggle, BT chip and empty state tuned to the forest palette.
- **CartDrawer** (`src/components/pos/CartDrawer.tsx`): drawer shell + footer on forest canvas with moss dividers; "Current Order" header with chartreuse items pill; order-type selector is a forest-inset segmented control with solid chartreuse active segment + block shadow; cart rows on canvas-inset with chartreuse item totals and chartreuse kitchen notes; qty stepper on forest inset with chartreuse hover; **Charge / Pay checkout button is the full `tessera-cta`** (chartreuse block, forest text, 3D hover lift); coupon Apply is a `tessera-ghost` button; discount/coupon confirmations in emerald soft tint.
- **KdsScreen** (`src/components/kds/KdsScreen.tsx`): ChefHat icon tile and KITCHEN DISPLAY mono chip switch to chartreuse tint in Tessera (amber in other themes); the board surface itself converts via the new CSS remap below.

### Added — Tessera CSS Override Layer Extensions (`src/index.css` §11)
- **KDS zinc→forest terminal remap**: the KDS board is an always-dark surface built on zinc hexes (`#18181B`, `#121110`, `#0C0A09`, `#27272A`, `#FAFAFA`, `#A1A1AA`, `#71717A`, `#3F3F46`) plus `text-zinc-400/500`. All of these are now remapped to the forest palette under `[data-theme="tessera"]`, so the whole board (tickets, columns, course filter, SLA chips) matches the Tessera canvas while keeping its semantic status accents (blue/amber/emerald/rose).
- **Bug fix**: `hover:bg-[#FAFAFA]` (used by Settings, Inventory, Offers table rows) previously flashed near-white on forest cards in Tessera mode; it now resolves to the forest hover surface `#1A2E25`.

### Verified
- `npx tsc --noEmit` → 0 errors. `agent-browser errors` → clean across `/` (auth), `/coolkafe/pos` (incl. variant modal → add to cart → cart drawer → Charge/Pay footer), `/coolkafe/kds`, `/coolkafe/orders`, `/coolkafe/reports`, `/coolkafe/t1`, `/superadmin`.
- Theme round-trip regression: tessera → dark → tessera verified in-browser; dark mode reverts to zinc/amber/orange chrome as designed; console clean throughout.

## [2.6.0] — 2026-09-30 — Tessera UI Kit Redesign (Editorial Dark / Forest + Chartreuse)

### Added — Tessera Theme System
- **New `tessera` ThemeMode** (`src/types.ts`, `src/lib/store.ts`, `src/App.tsx`): a fourth theme option alongside `warm` / `dark` / `obsidian`. Tessera is the new **default theme** — an editorial dark design system pairing italic serif headlines with crisp sans body, deep forest surfaces, and a vivid chartreuse action accent. Inspired by [uiverse.io/ui-kits/tessera](https://uiverse.io/ui-kits/tessera).
- **Tessera design tokens** (`src/index.css` ~330 new lines): a full `[data-theme="tessera"]` / `.tessera` CSS variable layer mapping every warm-cream hex color to forest equivalents when the theme is active:
  - **Forest palette**: canvas `#0A1410`, surface `#0F1D17`, surface-2 `#142620`, divider `#1F3D2E`, border-strong `#2A4A37`
  - **Chartreuse action accent**: `#C5F82A` (hover `#B8E633`), with soft tint `rgba(197,248,42,0.12)`
  - **Text hierarchy on forest**: primary `#F5F4EE` (warm off-white), secondary `#9BB5A5` (sage), muted `#6B8579` (moss)
  - **Status colors tuned for forest**: emerald `#34D399`, amber `#FBBF24`, rose `#F87171`, info `#60A5FA`, accent `#C084FC`
- **Typography pairing** (the Tessera signature): `Instrument Serif` italic for h1/h2/h3 headlines + `.font-display`; `Inter` for body; h4 stays sans uppercase tracked for sub-section labels. `Instrument Serif` + `Inter` + `JetBrains Mono` loaded via Google Fonts in `index.html`.
- **3D isometric block-motif utilities** (Tessera signature volume):
  - `.tessera-block` — hard 3D offset shadow (`3px 3px 0 #1F3D2E`) for hero cards.
  - `.tessera-block-chartreuse` — chartreuse-offset variant for accent cards.
  - `.tessera-cta` — chartreuse CTA button with `translateY(-1px)` hover lift + 3D shadow.
  - `.tessera-ghost` — transparent forest button with chartreuse hover border.
  - `.tessera-grain` — subtle CSS-only radial-gradient grain texture for forest surfaces.
- **Tessera override layer** for: deep backgrounds, elevated card surfaces, inset surfaces, text hierarchy, moss borders, hover states, header/nav, form controls (chartreuse focus ring), status badges (emerald/amber/rose/info/accent tuned for forest), 3D shadows on `.shadow-xs/sm/lg/xl/2xl`, scrollbar (chartreuse hover).

### Redesigned — Surfaces (Tessera Showcase)
- **AuthScreen** (`src/components/auth/AuthScreen.tsx`): full Tessera redesign — forest card with `tessera-block` shadow, italic serif "TSOS Cafe Operating System" headline, chartreuse coffee-cube icon with 3D offset, 3D isometric block motif accents (chartreuse + emerald cubes) in the brand banner, ghost tab-toggle with chartreuse active underline, forest-inset form inputs with chartreuse focus ring, chartreuse `tessera-cta` primary submit button, 4 ghost quick-demo role buttons (SuperAdmin highlighted chartreuse), forest-inset credentials cheat-sheet with pulsing emerald "Active" indicator.
- **ReportsScreen** (`src/components/reports/ReportsScreen.tsx`): Tessera polish — forest header bar with `tessera-block` icon tile, italic serif section heading, chartreuse `tessera-cta` Export button, 4 KPI cards now use `tessera-block` shadow + uppercase tracked labels + forest-inset icon chips. The "Savings with TSOS" card is a chartreuse-tinted hero (`tessera-block-chartreuse`).
- **LiveOpsPulse** (`src/components/reports/LiveOpsPulse.tsx`): `tessera-block` shadow, chartreuse pulsing Activity icon, solid chartreuse "● LIVE" badge with 3D offset, forest-inset stat tiles, chartreuse insight-strip icon.
- **OrderTypeBreakdown** (`src/components/reports/OrderTypeBreakdown.tsx`): `tessera-block` shadow, chartreuse Utensils icon, forest tooltip with 3D offset + chartreuse revenue figure, bordered percentage bars on forest inset.
- **Loading screen** (`src/App.tsx`): forest bg with chartreuse pulsing dot + sage "Starting TSOS Cloud Engine…" text.
- **App wrapper** (`src/App.tsx`): `tessera-grain` texture on the main min-h-screen wrapper when tessera theme is active.

### Fixed — Build / Sandbox Infrastructure
- **Restored `.gitignore`** that was accidentally reverted to a minimal version (only `skills/` + `node_modules/`) during the fresh re-clone — the full exclusion list (`.env*`, `*.log`, `.zscripts/`, `Caddyfile`, `vite.pid`, `start-dev.sh`, `skills/`, `mini-services/`, `tests/`, `examples/`, `download/`, `upload/`, `db/`, `prisma/`) is back in place. Prevented accidental commit of `.env` (live Supabase anon key) + `dev.log` + sandbox infra.
- **Fixed file modes** on 40+ tracked files that had been flipped to `100755` (executable) by the `tar` extraction during the fresh re-clone — reset to `100644` via `git config core.fileMode` + `chmod`. No content changes, just mode restoration.
- **Recreated `.zscripts/dev.sh` + `.zscripts/run-vite.sh`** (the sandbox dev-server launcher) after the `/tmp` backup was cleaned up by the sandbox between turns. The launcher uses `start-stop-daemon --background` to daemonize Vite so it survives shell exit.

### Verification (agent-browser)
- All surfaces render with zero console errors: `/` (auth, Tessera showcase), `/superadmin`, `/:slug/pos`, `/:slug/kds`, `/:slug/orders`, `/:slug/reports` (LiveOpsPulse + KPI cards + OrderTypeBreakdown with explicit `tessera-block` shadows), `/:slug/t1` (storefront), `/track/live`.
- Tessera styles verified via `getComputedStyle`: body bg = `rgb(10, 20, 16)` (forest `#0A1410`), cards = `rgb(15, 29, 23)` (forest `#0F1D17`), CTA bg = `rgb(197, 248, 42)` (chartreuse `#C5F82A`), h1/h2/h3 font-family = `"Instrument Serif", ...` with `font-style: italic`, `data-theme="tessera"` on `<html>`.
- `npx tsc --noEmit` → **0 errors**.

---

## [2.5.0] — 2026-09-30 — Reports Analytics Expansion, Modal UX Fix & Documentation Re-alignment

### Added — Reports Screen
- **Live Operational Pulse widget** (`src/components/reports/LiveOpsPulse.tsx`): a real-time "right now" dashboard card showing orders in the last 60 minutes (revenue + count + per-minute velocity), active dining tables (occupied/total + % occupied), kitchen load (tickets in `new`+`preparing` state, color-coded idle→light→moderate→busy→critical), and staff currently on shift. Includes a contextual insight strip that adapts its message to the current state ("kitchen at critical load — consider pulling a runner" vs "floor is quiet — good moment for restocks").
- **Order Type Breakdown donut chart** (`src/components/reports/OrderTypeBreakdown.tsx`): a Recharts donut visualizing the split of orders by type (Dine-In / Takeaway / Delivery) with revenue + percentage share per slice. Fills a gap in the Reports screen — previously only payment-method breakdown was shown, not order-type analytics. Renders an empty state when no orders exist.
- **`useCountUp` / `useCountUpFormatted` hook** (`src/hooks/useCountUp.ts`): animates a number from its previous value to the target over a configurable duration (default 900ms) using `requestAnimationFrame` + an ease-out cubic curve. Used by the 4 Reports KPI cards (Gross Sales, Orders Placed, AOV, Savings) so they visibly "tick up" on mount and when values change — gives the dashboard a live feel without re-rendering the whole tree.

### Fixed — POS Modal UX
- **Escape key + backdrop-click now dismiss `PaymentModal` and `VariantModal`**. Previously the only dismiss affordances were the X button and "Back to Cart" — a friction point for fast cashier flow. Added a `useEffect` keydown listener for `Escape` to both modals; the PaymentModal handler is gated on `!isProcessing` so a mid-flight payment can't be aborted by a stray keystroke. Backdrop click (`if (e.target === e.currentTarget) onClose()`) added as a second standard affordance.

### Fixed — Documentation Re-alignment
- **Version drift corrected**: README badges, tech-doc §2.1, PROMPT.md, and business-doc all claimed React 18 / Vite 6 / TypeScript 5.2 / Tailwind 3.4. Updated to match the actual `package.json`: React 19 / Vite 8.3 / TypeScript 7.0 / Tailwind 4.3.
- **Stale git URL fixed**: README now points to `https://github.com/OmKardile/tsos-alt.git` (was `jhonny-silverhand/tsos-alternate`, the reference repo that was audited, not this repo). Clone dir corrected to `tsos-alt`.
- **`docs/README.md` index corrected**: added `compact6.md` + `compact7.md` (was stopping at 5), added ADRs `0006`–`0009` (was stopping at 5), removed the nonexistent `specifications/` subfolder (the 10 spec `.md` files live directly in `docs/`).
- **README "ADRs 0001 through 0008"** corrected to **"0001 through 0009"** (ADR 0009 RBAC was missing from the mention).
- **Deleted `technical-dcoumentation.md`** (the typo'd byte-identical duplicate of `technical-documentation.md` — same MD5 `ca478d34…`).
- **Created root `compact.md`**: single-page dense project-state summary for fast cold re-onboarding, points to `docs/compacts/` for chronological detail.
- **Created root `decisions.md`**: single-file ADR summary (Context → Decision → Alternatives → Consequences for all 9 ADRs), points to `docs/decisions/` for full ADRs.

### Fixed — Build / Type Configuration
- **`tsconfig.json` now scopes type-checking to `src/**/*`** and excludes sandbox-only dirs (`skills`, `mini-services`, `tests`, `examples`, `download`, `upload`, `db`, `prisma`). Previously `npx tsc --noEmit` would surface dozens of spurious errors from sandbox infrastructure files (e.g. `skills/*/scripts/*.ts` importing `z-ai-web-dev-sdk`, `examples/websocket/*.ts` importing `socket.io-client`).
- **Added `"node"` to tsconfig `types`** (alongside `vite/client`) so the `Buffer` global in `src/lib/sessionService.ts` resolves — was a pre-existing 2-error type leak.
- **`.gitignore` extended** to exclude sandbox-only infrastructure (`Caddyfile`, `vite.pid`, `.zscripts/`, `start-dev.sh`, `skills/`, `mini-services/`, `tests/`, `examples/`, `download/`, `upload/`, `db/`, `prisma/`) so it doesn't pollute the upstream repo when committing local changes.

### Infrastructure — Live Supabase DB
- **`.env` now configured with live Supabase credentials** (`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` for project `vbufsuzzmehsidshopku`). `isSupabaseConfigured()` returns `true`; all Supabase-aware code paths (auth `getSession`, tenant provisioning, realtime subscriptions, ephemeral table-session RPC) now hit the live DB instead of the offline-resilient fallback. Live DB data gaps outstanding: `categories` + `menu_items` tables empty (menu served from local seed fallback); `customers` + `offers` tables return HTTP 404 to anon (migration re-run needed).

### Git History Recovery
- **Re-cloned fresh from `github.com/OmKardile/tsos-alt`** to recover the real git history (the local `.git` was previously the Next.js sandbox template — only 4 UUID-named commits, no remote, wrong author). The fresh clone preserves the upstream commit history (`944ddb6 feat(rbac)…`, `d26a136 feat(security)…`, etc.) and the `origin` remote. Git identity set to `Omkar Kardile (Z) <omkardile84@gmail.com>`. Local changes (`.env`, `vite.config.ts`, `.zscripts/`, `worklog.md`, PaymentModal/VariantModal Escape fixes) re-applied on top.

---

## [2.4.0] — 2026-09-25 — Multi-Platform Cloud Deployment: Render & Vercel Blueprints

### Deployment & Cloud Infrastructure
- **Render Cloud Configuration (`render.yaml`)**: Added Infrastructure-as-Code Blueprint for 1-click Render deployment as a free, high-performance **Static Site**.
- **Edge Routing & SPA Rewrites**: Configured `/* -> /index.html` rewrites on both Vercel (`vercel.json`) and Render (`render.yaml`) to ensure seamless deep-linking for tableside QR sessions (`/:slug/t1?token=...`), KDS, and POS terminals without 404 errors.
- **Zero Cold-Start Architecture**: Documented hosting benefits of Render Static Sites over web services (free tier CDN hosting with zero spin-down / sleep delays).
- **Deployment Documentation**: Expanded `help.md` and `README.md` with side-by-side deployment walkthroughs and feature comparisons for Vercel vs. Render.

---

## [2.3.0] — 2026-09-25 — Strategic Streamlining: Purged Hardware Hub & Electron Pivot

### Removed & Deprecated
- **Removed Hardware Hub & Downloads Modal**: Completely deleted `HardwareDownloadsModal.tsx` and removed all download triggers from `Header.tsx`, `SettingsScreen.tsx`, and `App.tsx`.
- **Cancelled Native Customer Mobile App**: Eliminated Android APK showcase. Established pure camera QR ordering workflow: diners scan the physical QR code with their mobile phone camera, instantly opening the web storefront directly in their mobile browser with time-bound 10-minute sessions.
- **Frozen Windows WPF Native Client**: Standalone C# / WPF desktop client is officially frozen. Transitioned all desktop POS roadmap to cross-platform **Electron.js** wrapping the unified Web POS codebase for raw ESC/POS WebUSB/WebSerial access.

---

## [2.2.0] — 2026-09-25 — Realtime WebSockets & Comparative Feature Migration

### Real-Time Synchronization & Offline Resiliency
- **Supabase Realtime WebSockets**: Integrated `realtimeService.subscribeToTenantRealtime` for instant zero-reload KDS ticket progression, live order arrivals with synthesized Web Audio chimes, and automatic floor table occupancy syncing.
- **Offline Order Queue**: Implemented localStorage-backed queue (`tsos_pending_offline_orders`) ensuring continuous checkout operations during network dropouts, with automatic background synchronization on browser `'online'` reconnection.

### Hardware & Operations Hub
- **Hardware Integration & Downloads Modal**: Added centralized hub accessible via Header and Settings for downloading the Windows Desktop POS client (.exe), Android Tablet APK, and thermal printer ESC/POS driver documentation.
- **Fast Touchscreen Staff PIN Pad**: Integrated `StaffPinPadModal` featuring an on-screen numeric keypad for 2-tap cashier and barista shift transitions on counter touchscreens.

### Testing & Table QR Hardening
- **Storefront Testing Toggles**: Added `[Expire (Test History)]` and `[Tamper]` buttons to easily simulate and test browser history protections and anti-spoofing guards.
- **Table Card Guidance**: Updated table card modal with security advisories on short-lived sessions and anti-tamper QR protocols.

---

## [2.1.0] — 2026-09-25 — 10-Minute Ephemeral Table QR Session Security

### Security & Anti-Fraud
- **Ephemeral Session Tokens**: Implemented a dual-token architecture where scanning a table's physical QR code (`GET /api/table/:slug/:tableNumber?token=:permanentQrToken`) verifies the permanent secret and issues a cryptographically signed HMAC-SHA256 session token with `expires_at = now() + INTERVAL '10 minutes'`.
- **Database Backed Session Store**: Created `table_sessions` table with foreign keys, indexes, and RLS policies for tenant staff and anonymous diners.
- **Order Submission Guard**: Added enforcement requiring `X-Table-Session-Token` header on `POST /api/orders`. Rejects with 401/403 if signature is invalid, table ID is spoofed (`TABLE_MISMATCH`), session is expired (`SESSION_EXPIRED`), or the table is settled (`TABLE_SETTLED`).
- **PostgreSQL Session RPCs**:
  - `issue_ephemeral_table_session`: Verifies physical token, revokes stale sessions, issues fresh 600s token.
  - `verify_and_consume_table_session`: Validates token signature, table ID, and table dining status.
  - `renew_ephemeral_table_session`: Re-scans physical token for renewal handshake.
  - `purge_expired_table_sessions`: Maintenance procedure to purge sessions older than 24 hours.

### Storefront UI / UX
- **Live Countdown Timer**: Integrated a real-time `mm:ss` countdown badge in the storefront header.
- **Warning States**:
  - Amber warning banner appears at $\le$ 2 minutes remaining with instant `[Renew Now]` action.
  - Pulsing red badge at $\le$ 30 seconds remaining.
- **Security Auto-Lock Screen**: Fullscreen backdrop overlay triggers automatically when the timer reaches 00:00, disabling item selection and checkout with instructions to scan the physical QR sticker to renew.

---

## [2.0.0] — 2026-09-25 — Multi-Tenant Cloud Architecture & Obsidian Mode

### Multi-Tenant Core & Backend
- **PostgreSQL Schema (Migration 001)**: Deployed 24 core tables to Supabase with strict `tenant_id` foreign keys and cascading deletes.
- **Row-Level Security (RLS)**: Enforced tenant isolation across all tables using session-based `current_tenant_id()` extraction.
- **Dynamic Scoped Routing**: Implemented path-based URL routing (`/:slug/pos`, `/:slug/kds`, `/:slug/orders`, `/:slug/inventory`, `/:slug/reports`, `/:slug/settings`, `/:slug/t:tableNumber`, `/superadmin`).
- **SuperAdmin Workspace Impersonation**: One-click "Enter Tenant Workspace" hook for operator support.

### Prototype Chrome Purge & Production Hardening
- **Removed Prototype Chrome**: Eliminated top "SURFACES" switcher bar, mock network sliders, fake latency toggles, tutorial purple dots (`GuidanceTooltip`), and demo reset handlers.
- **Production Store Bindings**: Connected POS actions, cart workflows, and customer lookup directly to persistent Zustand stores and live Supabase queries.

### Design System & Obsidian Mode
- **System-Wide Obsidian Terminal Theme**: Added global high-contrast industrial dark mode (`#0C0A09` background, `#292524` borders, phosphor amber `#F59E0B` and safety emerald `#10B981` accents).
- **Single-Button Header Toggle**: Added header Sun/Moon button toggling the entire system between Warm Cafe Cream and Obsidian Dark Terminal.

---

## [1.0.0] — 2026-09-24 — Initial Offline-First POS Prototype

### Added
- Core POS billing terminal with category selection, search, variant customization, and order type selector (Dine-In, Takeaway, Delivery).
- Kitchen Display System (KDS) board with stage filtering (`new`, `preparing`, `ready`, `completed`) and SLA timers.
- Loyalty & Customer CRM engine with 1 pt per ₹10 accrual, 1 pt = ₹1 redemption, and tier progression.
- Multi-mode payment engine: Dynamic UPI QR code generator, cash tender calculator, card terminal mock.
- Thermal receipt preview and printing generator.
- Inventory recipe depletion tracking on order completion.
