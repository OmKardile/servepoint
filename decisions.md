# TSOS Decisions — Single-File ADR Summary

> **Purpose**: One-page index of all architectural decisions, for fast reference. Each entry below links to the full ADR in [`docs/decisions/`](docs/decisions/README.md). Format: Context → Decision → Consequences. All ADRs are dated 2026-09-25 and have status **Accepted**.

---

## ADR 0001 — Supabase Multi-Tenant Architecture
- **Context**: Transition single-tenant in-memory POS prototype into a multi-tenant B2B SaaS platform.
- **Decision**: Adopt **Supabase** (PostgreSQL + Auth + Realtime + Storage + RPCs) as the sole backend. All tenant data is scoped by `tenant_id` foreign key.
- **Alternatives rejected**: Custom Node/Express backend, single-tenant schema, Firebase.
- **Consequences**: ✅ Managed infra, RLS-native, realtime built-in. ⚠️ Vendor lock-in to Supabase for tenant isolation primitives.
- **Full ADR**: [docs/decisions/0001-supabase-multi-tenant-architecture.md](docs/decisions/0001-supabase-multi-tenant-architecture.md)

---

## ADR 0002 — Row-Level Security (RLS) Tenant Isolation Model
- **Context**: Tenant data must never leak across cafes (orders, customers, loyalty, recipes, shifts).
- **Decision**: Enforce isolation at the **PostgreSQL RLS layer** using `current_tenant_id()` extracted from JWT claims. Every table has `ENABLE ROW LEVEL SECURITY` + a `tenant_id = current_tenant_id()` policy.
- **Alternatives rejected**: App-layer filtering in the React client, per-tenant database schemas.
- **Consequences**: ✅ Defense-in-depth — even a stolen anon key can't read another tenant's data. ⚠️ Every query pays the RLS planner cost; need indexes on `tenant_id`.
- **Full ADR**: [docs/decisions/0002-rls-tenant-isolation-model.md](docs/decisions/0002-rls-tenant-isolation-model.md)

---

## ADR 0003 — Production Chrome Purge & Dynamic Scoped Routing
- **Context**: The prototype had a top "SURFACES" switcher bar, mock latency sliders, tutorial dots — all inappropriate for production cashier use.
- **Decision**: Purge all prototype chrome. Route by URL path: `/:slug/pos`, `/:slug/kds`, `/:slug/orders`, `/:slug/inventory`, `/:slug/reports`, `/:slug/settings`, `/:slug/t:tableNumber`, `/superadmin`. SuperAdmin gets "Enter Tenant Workspace" impersonation.
- **Alternatives rejected**: Query-string routing, hash routing, surface state in localStorage.
- **Consequences**: ✅ Deep-linkable QR table URLs, shareable tenant links, clean production UX. ⚠️ SPA needs catch-all rewrite on Render/Vercel.
- **Full ADR**: [docs/decisions/0003-production-chrome-purge-and-dynamic-routing.md](docs/decisions/0003-production-chrome-purge-and-dynamic-routing.md)

---

## ADR 0004 — Obsidian Terminal Theme Engine
- **Context**: Cafe and kitchen lighting causes glare on standard dark themes; staff need high-contrast industrial aesthetics.
- **Decision**: System-wide **Obsidian Mode** (`#0C0A09` canvas, `#292524` borders, phosphor amber `#F59E0B`, emerald `#10B981`). Single header button toggles the whole app. State persisted in `localStorage` via Zustand.
- **Alternatives rejected**: Per-screen dark mode, CSS `prefers-color-scheme`, no dark mode.
- **Consequences**: ✅ Single-button consistency, glare-resistant. ⚠️ Every component must support both palettes.
- **Update (2026-09-30, v2.6.0/2.6.1)**: The ThemeMode enum gained `'tessera'` (now the **default**) — an editorial dark forest/chartreuse design system. The single-toggle engine, `data-theme` attribute mechanism, and per-theme palettes are unchanged; Obsidian remains reachable via `setThemeMode('obsidian')`, and `toggleThemeMode()` now cycles `tessera ↔ dark`. Full Tessera flourishes shipped in v2.6.1 for Header, WebNavbar, PosScreen, CartDrawer and the KDS board (zinc→forest CSS remap, `src/index.css` §11).
- **Full ADR**: [docs/decisions/0004-obsidian-terminal-theme-engine.md](docs/decisions/0004-obsidian-terminal-theme-engine.md)

---

## ADR 0005 — 10-Minute Ephemeral Table QR Session Security
- **Context**: Diners' mobile browsers save the table QR URL in history/bookmarks → accidental remote orders days later.
- **Decision**: Dual-token architecture: physical QR sticker = permanent secret; backend issues HMAC-SHA256 session token valid for exactly **10 minutes**, stored in `table_sessions` table. Order submission requires `X-Table-Session-Token` header. Frontend has live `mm:ss` countdown, 2-min amber warning, 30s red pulse, auto-lock at 00:00.
- **RPCs**: `issue_ephemeral_table_session`, `verify_and_consume_table_session`, `renew_ephemeral_table_session`, `purge_expired_table_sessions`.
- **Alternatives rejected**: Static QR tokens, OTP codes, NFC tap.
- **Consequences**: ✅ Eliminates accidental remote orders, cryptographic anti-spoofing. ⚠️ Diner must re-scan if they linger >10 min.
- **Full ADR**: [docs/decisions/0005-ephemeral-table-qr-session-security.md](docs/decisions/0005-ephemeral-table-qr-session-security.md)

---

## ADR 0006 — Real-Time WebSockets & Selective Migration
- **Context**: KDS tickets and dining table status need zero-reload updates; reference repo `tsos-alternate` had superior realtime + offline queue.
- **Decision**: Integrate `realtimeService.subscribeToTenantRealtime` (Supabase Realtime Postgres Changes on `orders` INSERT/UPDATE + `dining_tables` UPDATE). Offline-first: pending orders cached in `tsos_pending_offline_orders` localStorage, auto-flushed on browser `online` event.
- **Alternatives rejected**: Polling, SSE, custom WebSocket server.
- **Consequences**: ✅ Zero-reload KDS bumps, resilient to network dropouts. ⚠️ Supabase Realtime has 10 events/sec rate limit per connection.
- **Full ADR**: [docs/decisions/0006-realtime-websockets-and-selective-migration.md](docs/decisions/0006-realtime-websockets-and-selective-migration.md)

---

## ADR 0007 — Remove Hardware Hub & Freeze Native Apps for Electron
- **Context**: Native download friction (WPF .exe, Android APK) distracts from the pure browser QR flow.
- **Decision**: Purge `HardwareDownloadsModal` entirely. Freeze Windows WPF client — desktop roadmap consolidates around **Electron.js** wrapping the unified Web POS. Cancel native customer mobile app — diners scan table QR with phone camera → browser opens storefront directly.
- **Alternatives rejected**: Keep WPF + Android native apps, build Electron + React Native.
- **Consequences**: ✅ Zero-install customer flow, single codebase for desktop. ⚠️ Loses raw ESC/POS access without Electron WebUSB/WebSerial.
- **Full ADR**: [docs/decisions/0007-remove-hardware-hub-and-cancel-native-apps.md](docs/decisions/0007-remove-hardware-hub-and-cancel-native-apps.md)

---

## ADR 0008 — Multi-Platform Cloud Deployment (Render + Vercel)
- **Context**: Need free, zero-cold-start hosting for the SPA + Supabase backend.
- **Decision**: Dual cloud support: **Render Static Site** (via `render.yaml` Blueprint, `/* -> /index.html` rewrite, free tier never sleeps) + **Vercel Edge** (via `vercel.json` catch-all rewrite). Both deploy the same Vite SPA bundle.
- **Alternatives rejected**: Render Web Service (sleeps after 15 min), Netlify, custom nginx.
- **Consequences**: ✅ Free, no cold starts, deep-linkable QR URLs. ⚠️ Two configs to keep in sync.
- **Full ADR**: [docs/decisions/0008-cloud-deployment-render-and-vercel.md](docs/decisions/0008-cloud-deployment-render-and-vercel.md)
- **Update (v2.6.3, 2026-10-01)**: Blueprint hardened — service renamed **`tsos-pos`**; Supabase keys moved out of Git (`sync: false`, prompted at apply time); build pinned to `npm install --include=dev && npm run build` + `NODE_VERSION=22`; added immutable `/assets/*` caching, `no-cache` index.html, security headers, `autoDeploy` + free PR previews. Static-vs-Web-Service rationale (SPA + Supabase → no runtime server; free Web Services sleep, static sites never do) documented in the blueprint header itself.
- **Update (v2.6.4, 2026-10-01, owner decision)**: Supabase credentials **re-hardcoded** in `render.yaml` (reverting the v2.6.3 `sync: false` prompt flow) AND embedded as fallback defaults in `src/lib/supabase.ts`. Rationale: the anon key is a *public* client key — security comes from Row Level Security, not key secrecy. Hardcoding guarantees zero-touch blueprint applies and eliminates the "deployed build silently offline" failure class (missing env vars used to fall back to a fake demo key). `service_role` key remains forbidden in client-facing files.

---

## ADR 0009 — Role-Based Access Control (RBAC), Tab Filtering & Route Guards
- **Context**: Cashiers could see confidential sales telemetry, edit menu prices, access settings — no role enforcement.
- **Decision**: Role matrix in `src/lib/rbac.ts`:
  - `superadmin` → `/superadmin` + full access when impersonating
  - `owner` → all 11 tabs
  - `manager` → all tabs except `settings`
  - `cashier` → only `pos`, `orders`, `tables`, `kds` (4-tab clean interface)
- Dynamic tab filtering in `WebNavbar.tsx` via `canAccessTab(role, tabId)`. Direct URL access to blocked tabs renders `<AccessDeniedNotice>` with Manager PIN override.
- **Alternatives rejected**: Open access, server-side route guards only, no PIN override.
- **Consequences**: ✅ Protects revenue/wholesale/payroll data, clean cashier UX, instant Manager override. ⚠️ Cashier can't self-serve reports (intentional).
- **Full ADR**: [docs/decisions/0009-role-based-access-control-and-route-guards.md](docs/decisions/0009-role-based-access-control-and-route-guards.md)

---

## Decision-Making Framework
- All ADRs follow: **Context** (problem) → **Decision** (choice) → **Alternatives rejected** → **Consequences** (positive + negative).
- Statuses: `Proposed` → `Accepted` → `Deprecated` → `Superseded`.
- New ADRs go in `docs/decisions/00NN-<kebab-case-title>.md` and are indexed in [`docs/decisions/README.md`](docs/decisions/README.md).
- This file (`decisions.md`) is the **summary index** — update it whenever a new ADR is added or status changes.
