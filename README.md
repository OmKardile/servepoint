# TSOS — The Cafe Operating System

> **Enterprise-Grade Multi-Tenant Cloud POS & Restaurant Management Platform**  
> Engineered for specialty coffee shops, artisan bakeries, high-volume cafes, and quick-service restaurants (QSRs).

[![TypeScript](https://img.shields.io/badge/TypeScript-7.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.3-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com/)
[![Security](https://img.shields.io/badge/Security-HMAC--SHA256-brightgreen)](/docs/decisions/0005-ephemeral-table-qr-session-security.md)

---

## 🌟 Key Platform Capabilities

### 1. Multi-Tenant SaaS Engine
- **Tenant Isolation**: Every operational entity is bound to `tenant_id` with PostgreSQL Row-Level Security (RLS).
- **Dynamic Scoped Routing**: Seamless URL pattern matching for each tenant (`/:slug/pos`, `/:slug/kds`, `/:slug/orders`, etc.).
- **Platform SuperAdmin Console**: Manage SaaS subscribers, monitor MRR/telemetry, and execute one-click workspace impersonation (`/superadmin`).

### 2. High-Speed Counter POS (`/:slug/pos`)
- Instant category switching, real-time search, and custom variant/addon modals.
- Multi-order types: Dine-In (interactive table floor plan), Takeaway, and Delivery.
- Dynamic cart engine with split payments, loyalty redemption, and platform fee computation.
- Thermal receipt preview and printing generator.

### 3. Kitchen Display System (`/:slug/kds`)
- Live order queue organized by preparation stages (`new`, `preparing`, `ready`, `completed`).
- Visual SLA countdown timers warning kitchen staff and baristas of overdue tickets.
- Automated recipe depletion deducting raw ingredient stock upon item completion.

### 4. Tableside Ordering with 10-Minute Ephemeral QR Sessions (`/:slug/t:tableNumber`)
- **Anti-Fraud Security**: Eliminates accidental or unauthorized remote orders via mobile browser history or bookmarked URLs.
- **Dual-Token Handshake**: Physical table QR sticker verifies permanent secret; backend issues a 10-minute HMAC-SHA256 session token (`table_sessions`).
- **Order Submission Guard**: Enforces `X-Table-Session-Token` on `POST /api/orders`, rejecting expired, spoofed, or settled tables.
- **Frontend UX**: Live countdown timer (`mm:ss`) in header, 2-minute warning banner, and automatic security lock overlay at 00:00 with renewal handshake.

### 5. Tessera Editorial Theme (Default) + Industrial Obsidian Mode (Global Single-Button Toggle)
- **Tessera (default since v2.6.0)**: editorial dark design pairing Instrument Serif italic headlines with Inter body, deep forest surfaces (`#0A1410`/`#0F1D17`), vivid chartreuse action accent (`#C5F82A`), and 3D isometric block-motif utilities (`.tessera-block` / `.tessera-cta` / `.tessera-ghost`). Since v2.6.1 the global chrome (Header, WebNavbar), POS (menu cards, CartDrawer, Charge/Pay CTA) and the KDS board carry explicit Tessera flourishes; warm/dark/obsidian palettes remain fully preserved behind conditional classes.
- **Industrial Obsidian Mode**: high-contrast terminal design engineered for glare resistance and reduced eye strain under cafe and kitchen lighting.
- Palette (Obsidian): Pitch obsidian `#0C0A09`, hairline borders `#292524`, phosphor amber `#F59E0B`, and emerald status glows `#10B981`.
- Single-button toggle in the global navigation bar switches the entire system instantaneously (cycles `tessera ↔ dark`; `warm` reachable via explicit set).

### 6. Real-Time WebSockets & Offline Resiliency
- **Cloud Menu Hydration (v2.6.2)**: categories + menu items load from Supabase for the active tenant at sign-in, with automatic fallback to the bundled seed menu when the cloud is empty or unreachable.
- **Supabase Realtime**: Instantaneous zero-reload ticket progression in KDS and live dining table status updates.
- **Offline-First Synchronization**: Caches pending tickets under `tsos_pending_offline_orders` with automated auto-flush upon browser reconnection.

### 7. Touchscreen Fast PIN Pad & Electron Desktop Roadmap
- **Fast 4-Digit Staff PIN Pad**: Touchscreen numeric pad for rapid 2-tap cashier and barista shift transitions.
- **Electron.js Desktop Strategy**: The legacy Windows WPF app is frozen; desktop POS terminals will focus exclusively on cross-platform Electron wrapping the web POS.
- **Pure Camera QR Browser Ordering**: Cancelled customer native apps; diners scan physical table QR stickers directly with their phone camera, immediately opening the web storefront in their mobile browser with 10-minute time-bound sessions.

---

## 🛠️ Architecture & Tech Stack

```
Frontend:       React 19 + TypeScript 7 + Vite 8.3 + Tailwind CSS 4.3 + Lucide Icons
State Engine:   Zustand (Persistent Local Store + Optimistic State Updates)
Backend & DB:   Supabase (PostgreSQL 15+ with pgcrypto, PL/pgSQL RPCs, and RLS)
Security:       Web Crypto API + PostgreSQL HMAC-SHA256 Ephemeral Tokens
Audio & Visual: Web Audio API chimes + Canvas Confetti + Recharts
```

---

## 📂 Repository Directory Structure

```
mega-tsos/
├── src/                          # Application source code
│   ├── components/               # Operational surfaces & views
│   │   ├── layout/               # Global Header, Sidebar, Obsidian Toggle
│   │   ├── pos/                  # Counter POS billing & table selector
│   │   ├── kds/                  # Kitchen Display System
│   │   ├── orders/               # Master orders directory & receipt reprint
│   │   ├── inventory/            # Ingredients, recipes, and restock logs
│   │   ├── shifts/               # Staff clock-in & cash drawer reconciliation
│   │   ├── storefront/           # Tableside QR self-ordering & countdown timer
│   │   └── superadmin/           # Platform SaaS subscription management
│   ├── hooks/                    # Reusable React hooks
│   │   └── useTableSession.ts    # 10m countdown, auto-lock & renewal hook
│   ├── lib/                      # Core business services & stores
│   │   ├── sessionService.ts     # Ephemeral session token crypto & RPC client
│   │   ├── store.ts              # Zustand root store with Obsidian theme
│   │   └── supabase.ts           # Supabase client & credentials
│   └── types.ts                  # Comprehensive TypeScript interfaces
├── supabase/                     # Database migrations & schemas
│   └── migrations/
│       ├── 001_multi_tenant_saas.sql         # 24 core SaaS tables & RLS
│       └── 002_ephemeral_table_sessions.sql  # Table sessions table & RPCs
├── docs/                         # Comprehensive engineering documentation
│   ├── compacts/                 # Conversation milestones & summaries
│   ├── requests/                 # Chronological prompt & directive ledger
│   ├── decisions/                # Architecture Decision Records (ADRs)
│   ├── worklog/                  # Daily engineering logs & commit histories
│   ├── research/                 # Security threat models & SaaS scaling
│   └── README.md                 # Documentation master index
├── schema.sql                    # Standalone export of ephemeral sessions SQL
├── technical-documentation.md    # In-depth technical architecture guide
├── business-documentation.md     # B2B SaaS business model, pricing, unit economics
├── CHANGELOG.md                  # Semantic versioning release ledger
└── vite.config.ts                # Vite build & bundler configuration
```

---

## 🚀 Getting Started

### 1. Installation & Setup
```bash
# Clone the repository
git clone https://github.com/OmKardile/tsos-alt.git
cd tsos-alt

# Install dependencies
npm install   # or: bun install / pnpm install

# Start the development server
npm run dev   # or: bun run dev / pnpm dev
```
The application will launch at `http://localhost:3000`.

### 2. Operational URL Routes
- `/coolkafe/pos`: POS workstation for tenant `coolkafe`.
- `/coolkafe/kds`: Kitchen Display System.
- `/coolkafe/orders`: Live orders directory.
- `/coolkafe/inventory`: Stock ledger & recipe costs.
- `/coolkafe/reports`: Shift and sales telemetry.
- `/coolkafe/t1?token=demo_token`: Tableside QR ordering for Table 1 with 10-minute security countdown.
- `/superadmin`: Platform SuperAdmin dashboard.

### 3. Production Cloud Deployment
- **Render (Static Site — `tsos-pos`, Zero Sleep Delay)**: Deploy via Render Blueprints using [`render.yaml`](render.yaml) — Dashboard → New + → Blueprint → pick this repo → Create. The blueprint pins the service name `tsos-pos`, SPA rewrite `/* -> /index.html`, immutable asset caching, security headers, Node 22, and ships the live `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` **hardcoded in the blueprint** (public anon key, RLS-protected — zero manual prompts, zero-touch apply). **Static Site, not Web Service** — the app is a pure client-side SPA with Supabase as backend; Render free Web Services sleep after 15 min while static sites never sleep.
- **Vercel (Edge CDN)**: Deploy via `npx vercel` or GitHub import using [`vercel.json`](vercel.json).
- See **[help.md](help.md)** for complete credentials, environment variables, and 1-minute deployment walkthroughs.

---

## 📚 Documentation Quick Links

- **[help.md](help.md)**: Production deployment guide (Render & Vercel) & credentials cheat sheet.
- **[CHANGELOG.md](CHANGELOG.md)**: Release history and version logs.
- **[technical-documentation.md](technical-documentation.md)**: Deep technical architecture, schema specifications, and cryptographic protocols.
- **[business-documentation.md](business-documentation.md)**: Multi-tenant SaaS business model, subscription tiers, and cafe unit economics.
- **[docs/decisions/](docs/decisions/README.md)**: All Architecture Decision Records (ADR 0001 through 0009).
- **[docs/compacts/](docs/compacts/README.md)**: Chronological project phase summaries.
- **[docs/worklog/](docs/worklog/2026-09-25.md)**: Detailed daily engineering commit ledger.

