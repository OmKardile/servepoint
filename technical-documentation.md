# TSOS Technical Documentation & Architecture Specification

- **System**: TSOS (The Cafe Operating System)
- **Version**: 2.5.0
- **Architect**: Lead Full-Stack Security & Platform Architect
- **Updated**: September 30, 2026

---

## 1. System Overview & Architecture

TSOS is a cloud-native, multi-tenant B2B SaaS platform engineered specifically for cafes, specialty coffee roasters, bakeries, and quick-service restaurants (QSRs). It provides a unified system spanning counter POS, kitchen display (KDS), inventory recipe depletion, shifts reconciliation, and guest tableside self-ordering.

```mermaid
graph TD
  subgraph Client Surfaces
    POS["Counter POS (/:slug/pos)"]
    KDS["Kitchen Display (/:slug/kds)"]
    STORE["Tableside QR Storefront (/:slug/t:table)"]
    ADMIN["SuperAdmin Console (/superadmin)"]
  end

  subgraph State & Client Logic
    STORE_ZUSTAND["Zustand State Store (Optimistic Updates)"]
    SESSION_SVC["Session Security Service (HMAC-SHA256)"]
    ROUTER["Scoped URL Router (/:slug/*)"]
  end

  subgraph Supabase Cloud Backend
    POSTGRES[("PostgreSQL 15+ (RLS Multi-Tenant)")]
    RPC["Atomic Stored Procedures (PL/pgSQL)"]
    REALTIME["Supabase Realtime WebSockets"]
  end

  POS --> STORE_ZUSTAND
  KDS --> STORE_ZUSTAND
  STORE --> SESSION_SVC
  STORE_ZUSTAND --> POSTGRES
  SESSION_SVC --> RPC
  RPC --> POSTGRES
  POSTGRES --> REALTIME
  REALTIME --> KDS
```

---

## 2. Frontend Architecture

### 2.1 Technology Stack
- **Framework**: React 19 with TypeScript 7.0.
- **Build Tool**: Vite 8.3 (ESM-native fast HMR and optimized production bundling).
- **Styling**: Tailwind CSS 4.3 with custom design tokens for Warm Cafe Cream and Obsidian Dark Terminal.
- **Icons**: Lucide React.
- **State Management**: Zustand 5 with `persist` middleware for zero-latency local caching.

### 2.2 Component Hierarchy & Surfaces
- `src/App.tsx`: Root router parsing path-based tenant slugs and rendering active surface components.
- `src/components/layout/Header.tsx`: Global system bar featuring tenant identity, offline/online sync status pill, shift indicator, and the **single-button Obsidian Mode toggle**.
- `src/components/layout/NavigationSidebar.tsx`: Surface switcher for authenticated staff (POS, KDS, Orders, Inventory, Reports, Settings).
- `src/components/pos/PosScreen.tsx`: High-velocity cash register with category tabs, dish search, customizable modifiers modal (`VariantModal`), dine-in table selector, and cart drawer.
- `src/components/kds/KdsScreen.tsx`: Kitchen display pipeline showing active tickets grouped by stage (`new`, `preparing`, `ready`, `completed`) with SLA progress timers.
- `src/components/storefront/StorefrontScreen.tsx`: Guest mobile self-ordering surface with live 10-minute session countdown, warning banners, security auto-lock modal, and UPI payment integration.

---

## 3. Dynamic Scoped Path-Based Routing Engine

The routing layer extracts tenant slugs dynamically from the window location pathname:

| Route Pattern | Target Component | Access Role | Description |
|---|---|---|---|
| `/:slug/pos` | `PosScreen` | Cashier, Manager, Owner | Scoped point of sale billing terminal. |
| `/:slug/kds` | `KdsScreen` | Kitchen Staff, Barista | Real-time kitchen display board. |
| `/:slug/orders` | `OrdersScreen` | Cashier, Manager | Master order directory with status filtering & receipt reprinting. |
| `/:slug/inventory` | `InventoryScreen` | Manager, Owner | Ingredient stock ledger and recipe consumption costs. |
| `/:slug/reports` | `ReportsScreen` | Manager, Owner | Sales telemetry, payment modes, order-type analytics, and tax reporting. |
| `/:slug/settings` | `SettingsScreen` | Owner, Manager | Outlet profile, thermal printers, and tax configuration. |
| `/:slug/t:tableNumber?token=:token` | `StorefrontScreen` | Anonymous Diner | Guest self-ordering with 10-minute ephemeral session validation. |
| `/superadmin` | `SuperAdminScreen` | Platform SuperAdmin | Tenant provisioning, SaaS telemetry, and workspace impersonation. |

---

## 4. Supabase Database Schema & Multi-Tenancy

The database is deployed on PostgreSQL 15 with `pgcrypto` enabled. All operational tables maintain a strict `tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE`.

### 4.1 Schema Overview

```mermaid
erDiagram
  tenants ||--o{ subscriptions : has
  tenants ||--o{ locations : operates
  tenants ||--o{ tenant_users : employs
  locations ||--o{ dining_tables : contains
  dining_tables ||--o{ table_sessions : generates
  tenants ||--o{ menu_categories : defines
  menu_categories ||--o{ menu_items : categorizes
  menu_items ||--o{ menu_variants : offers
  menu_items ||--o{ recipes : requires
  tenants ||--o{ ingredients : stocks
  ingredients ||--o{ recipes : used_in
  tenants ||--o{ orders : receives
  orders ||--o{ order_items : includes
  orders ||--o{ payments : settles
  tenants ||--o{ customers : tracks
  customers ||--o{ loyalty_ledgers : records
```

### 4.2 Row-Level Security (RLS) Architecture
PostgreSQL RLS ensures that queries from one cafe never leak or touch another cafe's records:

```sql
-- Helper function to extract tenant ID from JWT claims
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'tenant_id', '')::uuid;
$$;

-- Global RLS enforcement
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Staff Full Isolation"
ON orders FOR ALL
TO authenticated
USING (tenant_id = current_tenant_id())
WITH CHECK (tenant_id = current_tenant_id());
```

---

## 5. Ephemeral Table QR Session Security Architecture

### 5.1 Threat Vector
Diners who scan a static table QR URL (`/coolkafe/t4?token=sec_xyz`) have that URL saved in mobile browser history and bookmarks. When reopening mobile tabs days later, accidental taps trigger orders at the restaurant table from home.

### 5.2 Cryptographic Solution
1. **Physical Secret**: Printed on table stickers (`dining_tables.qr_token`).
2. **Short-Lived Token**: Server validates physical secret and issues an HMAC-SHA256 session token valid for exactly **10 minutes** (`expires_at = now() + INTERVAL '10 minutes'`).
3. **Session Store (`table_sessions`)**:
   - `id`: UUID primary key.
   - `tenant_id`: Foreign key to `tenants`.
   - `table_id`: Foreign key to `dining_tables`.
   - `session_token`: Cryptographically secure unique token string.
   - `token_hash`: SHA256 HMAC digest.
   - `status`: `'active' | 'expired' | 'revoked' | 'consumed'`.
   - `expires_at`: Expiration timestamp.
4. **Order Submission Guard**: All orders submitted via `POST /api/orders` require header:
   ```
   X-Table-Session-Token: <token>
   ```
   The backend invokes `verify_and_consume_table_session(p_session_token, p_table_id)` which:
   - Validates the token exists and is in `'active'` status.
   - Verifies `session.table_id == order.table_id` (rejects table spoofing with `TABLE_MISMATCH`).
   - Checks `expires_at >= now()` (rejects expired sessions with `SESSION_EXPIRED`).
   - Checks table status in `dining_tables` (rejects settled tables with `TABLE_SETTLED`).
5. **Auto-Lock Screen**: Storefront UI countdown timer (`mm:ss`) displays remaining time. At $\le$ 2 minutes, an amber warning banner appears. At 00:00, the screen locks with a backdrop overlay prompting the diner to scan the physical QR code sticker to renew.

---

## 6. Industrial Obsidian Mode Design System

TSOS features a global, single-button **Obsidian Mode** theme designed for high-contrast visibility and glare reduction.

### 6.1 Theme Token Specifications

| Token Category | Warm Cafe Mode (Default) | Obsidian Terminal Mode |
|---|---|---|
| **App Canvas Background** | `#FFF9F2` (Cream Stone-50) | `#0C0A09` (Deep Pitch Stone-950) |
| **Card & Panel Surfaces** | `#FFFFFF` (Pure White) | `#1C1917` (Industrial Stone-900) |
| **Grid Lines & Borders** | `#E9E0D6` (Warm Sand) | `#292524` (Hairline Stone-800) |
| **Primary Typography** | `#1C1917` (Deep Espresso) | `#F5F5F4` (Crisp Chalk White) |
| **Numeric Monospace Text** | `font-mono` Deep Stone | `font-mono text-[#F59E0B]` (Phosphor Amber) |
| **Status Accents** | Warm Orange (`#F97316`) | Emerald (`#10B981`) & Amber (`#F59E0B`) |

### 6.2 Implementation
Managed centrally in `src/lib/store.ts` via `isObsidianMode` state and toggled via the global header button with `toggleObsidianMode()`. State is automatically persisted in `localStorage`.

---

## 7. Stored Procedures & API Specifications

### `issue_ephemeral_table_session`
- **Arguments**:
  - `p_tenant_slug`: String (e.g. `'coolkafe'`)
  - `p_table_number`: String (e.g. `'T-01'`)
  - `p_permanent_token`: String (permanent physical QR secret)
- **Returns**:
  ```json
  {
    "is_valid": true,
    "session_token": "tsos_tkn_...",
    "session_id": "uuid",
    "expires_at": "2026-09-25T11:15:00Z",
    "remaining_seconds": 600,
    "table": { "id": "uuid", "table_number": "T-01" },
    "tenant": { "id": "uuid", "name": "CoolKafe", "slug": "coolkafe" }
  }
  ```

### `verify_and_consume_table_session`
- **Arguments**:
  - `p_session_token`: String (`X-Table-Session-Token`)
  - `p_table_id`: UUID
- **Error Responses**:
  - `401 / INVALID_SESSION_TOKEN`: Token not found.
  - `403 / TABLE_MISMATCH`: Token belongs to a different table.
  - `403 / SESSION_EXPIRED`: 10-minute window elapsed.
  - `403 / TABLE_SETTLED`: Dining table has already been closed by cashier.

### `purge_expired_table_sessions`
- **Arguments**: None
- **Action**: Deletes records from `table_sessions` where `expires_at < now() - INTERVAL '24 hours'`.
- **Returns**: Integer count of purged records.

---

## 8. Real-Time WebSocket Synchronization & Offline-First Engine

### 8.1 Supabase Realtime Channels
The application maintains persistent PostgreSQL change subscriptions per tenant using `realtimeService.subscribeToTenantRealtime`:
- **Table Subscriptions**: `orders` (INSERT, UPDATE) and `dining_tables` (UPDATE).
- **Zero-Reload KDS**: Tickets bump automatically across stations without manual page refreshes.
- **Audio Chimes**: Plays synthesized double-ding chimes (`playChime('new_order')`) using the Web Audio API without external audio file latency.

### 8.2 Offline-First Queue & Sync
- **Queue Storage**: Unsynced orders are cached under `tsos_pending_offline_orders` in `localStorage`.
- **Auto-Flush Reconnect**: Listens to browser `'online'` events and flushes pending tickets immediately upon connection restoration.

---

## 9. Touchscreen Shift Keypad & Desktop Electron Architecture

### 9.1 Fast Touchscreen PIN Pad (`StaffPinPadModal`)
- On-screen 4-digit keypad designed for tablet cashiers and baristas.
- Enables rapid 2-tap clock-ins and shift handovers during high-volume service rushes.

### 9.2 Strategic Desktop Roadmap: Electron.js Transition
- **Windows WPF Frozen**: Standalone C# / WPF native desktop client is frozen.
- **Electron.js Framework**: Desktop POS terminals will leverage cross-platform Electron.js wrapping the unified React/TypeScript POS codebase to access raw USB/COM ESC/POS thermal printers and cash drawers.
- **Zero-Install Camera QR Ordering**: Cancelled customer native apps. Diners scan physical QR table stickers with their mobile camera; the storefront opens directly in the browser with 10-minute ephemeral sessions.

---

## 9.5 Reports Analytics Suite (v2.5.0)

The `ReportsScreen` aggregates four complementary analytics views, each backed by the live Zustand store (and, when Supabase is configured, by realtime Postgres Changes).

### 9.5.1 Live Operational Pulse (`src/components/reports/LiveOpsPulse.tsx`)
A real-time "right now" dashboard card sitting at the top of the Reports screen. Four stat tiles:
- **Last 60 min**: revenue + order count + per-minute velocity (`orders / 60`).
- **Active Tables**: occupied tables / total tables + % occupied.
- **Kitchen Load**: count of tickets currently in `new` + `preparing` state, color-coded `idle → light → moderate → busy → critical` (grey → emerald → orange → red-orange → red).
- **Staff On Shift**: count of shifts with `status === 'active'`.
A contextual insight strip at the bottom adapts its message to the current state (e.g. "kitchen at critical load — consider pulling a runner" vs "floor is quiet — good moment for restocks").

### 9.5.2 Animated KPI Cards (`useCountUp` hook)
The four summary KPIs (Gross Sales, Orders Placed, Average Order Value, Savings vs Traditional POS) now use `src/hooks/useCountUp.ts`. The hook animates from the previous value to the new target over a configurable duration (default 900 ms) using `requestAnimationFrame` + an ease-out cubic curve. This gives the dashboard a "live ticking" feel on mount and whenever the underlying metrics change, without re-rendering the whole Reports tree.

### 9.5.3 Order Type Breakdown (`src/components/reports/OrderTypeBreakdown.tsx`)
A Recharts donut chart visualizing the split of orders by type: **Dine-In** (orange), **Takeaway** (violet), **Delivery** (sky blue). Each slice shows order count + revenue + percentage share. The center label renders the total order count. Empty slices are filtered out so the donut only shows types with actual sales. Renders an empty state when no orders exist. This fills a gap in the prior Reports screen, which previously showed only payment-method breakdown (UPI / Cash / Card) and not order-type analytics.

### 9.5.4 Existing Analytics (unchanged)
- **WeeklySalesLineChart** (`WeeklySalesLineChart.tsx`): Recharts line chart of day-by-day gross sales for the current week, with Revenue / Order Volume / Dual Trend toggle.
- **DailySalesHeatmap** (`DailySalesHeatmap.tsx`): hour-by-hour sales heatmap (07:00–23:00) with peak-hour detection, recommended staffing, and a schedule view.

---

## 10. Comparative Audit & Strategic Realignment Matrix

| Capability | Reference Repo | Local Repo | Current Architecture Status |
|---|---|---|---|
| Realtime WebSockets | Yes | Previously Mock | **ACTIVE**: Implemented `realtimeService` WebSocket subscription. |
| Offline Order Sync | Yes | In-memory | **ACTIVE**: Implemented `tsos_pending_offline_orders` queue & auto-flush. |
| Fast PIN Keypad | Yes | Missing | **ACTIVE**: Added `StaffPinPadModal` with 4-digit touchscreen pad. |
| 10m QR Session | Yes | Basic | **ACTIVE**: Full cryptographic dual-token session architecture. |
| Hardware Hub Modal | Yes | Ported | **PURGED**: Removed modal & buttons per user directive. |
| Native Windows App | WPF | WPF Prototype | **FROZEN**: Transitioned to Electron.js desktop POS shell. |
| Native Customer App | Compose APK | Prototype | **CANCELLED**: Zero-install mobile browser camera QR flow. |
| 10m QR Test Harness | Yes | Basic | **PORTED**: Added `[Expire (Test History)]` & `[Tamper]` buttons. |
| Obsidian Theme Engine | Limited KDS | System-Wide | **KEPT LOCAL**: Retained superior full-system Obsidian Terminal mode. |
| Multi-Tenant Schema | Split | Unified (24 tables) | **KEPT LOCAL**: Retained unified PostgreSQL schema and RLS policies. |

---

## 11. Verification & Production Build

- **Static Type Checking**: `npx tsc --noEmit` $\rightarrow$ 0 errors.
- **Production Bundle**: `npm run build` $\rightarrow$ Built with Vite in 8.22s; production assets chunked into `dist/`.
- **Database Connection**: Tested via PostgreSQL pooler connection over port 5432. All RPC procedures verified with positive and negative security assertions.
- **Browser Automation Walkthrough**: Verified complete end-to-end POS, KDS, Shifts, Inventory, and SuperAdmin flows.

---

## 12. Production Cloud Hosting Architecture (Render & Vercel)

TSOS is architected as a decoupled client-side Single-Page Application (SPA) interfacing with a managed Supabase PostgreSQL backend. It supports dual enterprise cloud hosting deployments:

### 12.1 Render Static Site (`render.yaml`)
- **Runtime**: `static` (zero-cost edge CDN hosting).
- **Zero Cold Starts**: Unlike Render Web Services (which spin down after 15 min on the free tier), Render Static Sites are globally distributed CDN assets and **never sleep**, guaranteeing immediate response times when diners scan table QR codes.
- **Infrastructure-as-Code (IaC)**: Managed via [`render.yaml`](file:///d:/work/megatech/mega-tsos/render.yaml) using Render Blueprints.
- **Client-Side Routing Rewrite**:
  ```yaml
  routes:
    - type: rewrite
      source: /*
      destination: /index.html
  ```
  Ensures dynamic scoped paths (`/:slug/pos`, `/:slug/t1?token=...`, `/superadmin`) resolve directly to `index.html` without 404 HTTP errors.

### 12.2 Vercel Edge CDN (`vercel.json`)
- **Runtime**: Vercel Edge Network.
- **Configuration**: Managed via [`vercel.json`](file:///d:/work/megatech/mega-tsos/vercel.json) with catch-all rewrites (`"source": "/(.*)", "destination": "/index.html"`).
- **Fast CLI Deployment**: Supports one-command builds and instant previews via `npx vercel`.


