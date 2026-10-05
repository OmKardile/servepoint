# ServePoint — The Cafe Operating System

> The owner's own cafe OS, exactly as designed: one route, fourteen screens, a
> platform console, and guest QR surfaces — React 19 + TypeScript + Vite +
> Tailwind 4 + Zustand + Supabase, installable as a PWA.

[![TypeScript](https://img.shields.io/badge/TypeScript-7.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.3-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com/)
[![Security](https://img.shields.io/badge/Security-HMAC--SHA256-brightgreen)](/docs/decisions/0005-ephemeral-table-qr-session-security.md)

---

## What ServePoint is (v5 line)

Since the v5 production rebuild (ADR-0014), the app **equals the owner's
ServePoint Figma** — zero demo data, zero dev tools, a single ServePoint theme,
and a typed Supabase-only data layer. Three roles (ADR-0013): **SuperAdmin**
(provisions businesses + owners via the wizard, sees the platform console
only), **Owner** (the full cafe app), **Staff** (the same app, merged
Manager+Cashier). Login is email + password only — no signup, no magic links
(ADR-0016 freezes the login screen).

The fourteen staff screens, named exactly what the sidebar says:

| Rail label | Section id | What it does |
| --- | --- | --- |
| Dashboard | `dashboard` | The day at a glance — collections, giveaways, unpaid bills, arrivals |
| Food & Drinks | `food` | Ordering → GST checkout → Bills |
| Kitchen | `kitchen` | Live kitchen queue |
| Bills | `bills` | Payment collection |
| Close-out | `eod` | End-of-day Z-report |
| Reports | `reports` | Sales telemetry |
| Inventory | `inventory` | Stock ledger & recipes |
| Guests | `customers` | Loyalty & CRM |
| Floor | `floor` | Live tables & the booking book |
| Menu | `menu` | Catalog management |
| Settings | `settings` | Workspace preferences |
| Messages | `messages` | Staff chat |
| Notifications | `notifications` | The bell feed |
| Support | `support` | Help desk |

A **superadmin** account instead gets the **Platform console** — provisioning
businesses + owners, platform analytics, and the guest **QR surfaces** serve
the cafe's diners (below).

---

## Route grammar (source of truth: `src/App.tsx`)

The user-visible SPA lives on **one route, `/`**. Sections are **app state,
not routes** — in-app navigation keeps the URL where it is; the paths below
are read once on mount as doors into the app.

| Path | Who | What happens |
| --- | --- | --- |
| `/` | anyone | Auth gate → signed-out sees the frozen login; owner/staff land in the cafe app; `superadmin` lands in the platform console — always. |
| `/:screen` · `/:slug/:screen` | staff | **Deep links** (v5.32.0): boots straight into the named screen — bookmarks, staff shortcuts, pinned wall displays. The slug segment is decorative; the signed-in session decides the workspace. |
| `/close-out`, `/guests` | staff | **Spoken-name aliases** (v5.93.0): the rail's words resolve — `/close-out` → Close-out (`eod`), `/guests` → Guests (`customers`). Plain ids (`/eod`, `/customers`) keep working untouched. |
| unknown path | anyone | **Honest 404** (v5.141.0): every address that is not the staff root, a porch page, a guest surface, or a known staff slug lands on the 404 register — nothing is silently swallowed into login. |
| `/showcase` | public | Product showcase porch (no auth, first-paint marketing). |
| `/help`, `/index-help` | public | Help porch. |
| `/t/:qr_token` | guest | **Table gate** (v5.3.0): the physical table's permanent QR token is the capability — resolves the table, opens the menu. |
| `/menu/:qr_token` | guest | **Menu + cart**: ordering with GST checkout; persists across reload. |
| `/track/:orderId` | guest | **Order tracking**: the order UUID is the pager — live status without login. |

Guest surfaces are public and capability-addressed: no session, the token in
the URL is the permission (table QR flow per ADR-0005 — ephemeral 10-minute
HMAC-SHA256 table sessions). Full spec:
[`docs/TABLE_SIDE_ORDERING_AND_QR_CLIENT_SPEC.md`](docs/TABLE_SIDE_ORDERING_AND_QR_CLIENT_SPEC.md).

Deep links resolve through `SECTION_SLUGS` in `src/App.tsx`, which is derived
from `SECTION_LABELS` in `src/components/shell/Sidebar.tsx` — **the sidebar's
words are the URLs**. Two rail names differ from their section ids (the rail
says "Close-out", the code says `eod`; the rail says "Guests", the code says
`customers`), so both words resolve.

---

## Theme — the owner's Figma, pinned

- **ServePoint (default)**: ivory canvas `#F6F5F2`, sage surfaces `#D9E2DD`,
  deep-teal primary `#0F3D3E`, gold accent `#B88E2F`, Poppins type, radii
  12/16/24/100 — EXACT tokens per ADR-0012 (Figma REST pipeline; all 57 Final
  UI screens archived at `docs/design/servepoint/`).
- **Header toggle** cycles `servepoint → tessera → dark`.
- **Auth-scoped pinning**: unauthenticated routes (the frozen login per
  ADR-0010/0016, plus porch and guest surfaces) stay force-pinned **Tessera**.

---

## Architecture & Tech Stack

```
Frontend:       React 19 + TypeScript 7.0 + Vite 8.3 + Tailwind CSS 4.3 + Lucide Icons
State engine:   Zustand (persistent local store + optimistic updates)
Backend & DB:   Supabase (PostgreSQL 15+, PL/pgSQL RPCs, Row-Level Security)
PWA:            Service worker with versioned precache (public/sw.js); offline banner + install card
Screens:        Lazy-loaded per section (v5.143.0) — a failed chunk import degrades into
                that screen's recovery card while the shell stays up
```

- **Error containment**: one error boundary per screen — a render error takes
  the content card, never the shell.
- **Presence**: a 45s heartbeat (migration 035) keeps staff "on the line"
  while the app is open; platform accounts skip it.
- **Migrations**: `supabase/migrations/` — numbered, **additive-only**
  (no drops, no renames, no NOT NULL without default), applied via the
  `scripts/apply-*.mjs` pooler pattern.

---

## Repository Directory Structure

```
servepoint/
├── src/
│   ├── App.tsx                    # Route grammar + role gates (the file this README narrates)
│   ├── components/
│   │   ├── auth/                  # Frozen login screen (ADR-0016)
│   │   ├── shell/                 # AppShell, Sidebar, PwaLayer, boundaries, skeleton
│   │   ├── dashboard/ food/ kitchen/ bills/ eod/ reports/
│   │   ├── inventory/ customers/ floor/ menu/ settings/
│   │   ├── messages/ notifications/ support/
│   │   ├── platform/              # SuperAdmin console
│   │   ├── guest/                 # Guest QR surfaces (gate / menu / track)
│   │   ├── pages/                 # Porch + 404 register (eager on purpose)
│   │   └── common/                # Shared primitives
│   ├── lib/                       # Typed data layer & pure derivations
│   │   ├── api.ts supabase.ts authService.ts tenant.ts rbac.ts
│   │   ├── billing.ts csv.ts printFrame.ts prefs.ts
│   │   └── appday.ts bookingday.ts day.ts turn.ts   # Day/verdict grammar (IST, one clock per surface)
│   ├── store/                     # Zustand root store (session, UI)
│   └── types.ts
├── public/sw.js                   # Service worker — VERSION bumped per release
├── supabase/migrations/           # Numbered, additive-only SQL (001 → 038)
├── scripts/                       # apply-*.mjs appliers, unit suites, QA probes
├── docs/
│   ├── decisions/                 # ADRs 0001 → 0016
│   ├── design/servepoint/         # The owner's Figma, archived (57 screens)
│   ├── compacts/ requests/ research/ worklog/
│   ├── CREDENTIALS.md             # All logins (not for production use)
│   └── *_SPEC.md                  # Surface specs (QR, loyalty, printers, inventory…)
├── CHANGELOG.md                   # Release ledger (v5 line)
├── render.yaml vercel.json        # Deployment blueprints
└── vite.config.ts
```

---

## Getting Started

```bash
git clone https://github.com/OmKardile/servepoint.git
cd servepoint
npm install          # or: bun install
npm run dev          # or: bun run dev — serves on http://localhost:3000
```

Gates: `npm run lint` (TypeScript, `--noEmit`) must be green before every
commit. There is no unit test framework — verification is browser QA against
the dev server plus the pure-derivation probe scripts in `scripts/`.

---

## Production Cloud Deployment

- **Render (Static Site — `servepoint-tsos`, zero sleep delay)**: deploy via
  Render Blueprints using [`render.yaml`](render.yaml) — the blueprint pins
  the service name, SPA rewrite `/* -> /index.html`, immutable asset caching,
  security headers, Node 22, and the public anon env vars (RLS-protected).
  **Static Site, not Web Service** — the app is a pure client-side SPA with
  Supabase as backend; static sites never sleep.
- **Vercel (Edge CDN)**: `npx vercel` or GitHub import using
  [`vercel.json`](vercel.json).
- See **[help.md](help.md)** for deployment walkthroughs and
  **[docs/CREDENTIALS.md](docs/CREDENTIALS.md)** for logins.

---

## Documentation Quick Links

- **[CHANGELOG.md](CHANGELOG.md)** — release history, v5 line.
- **[docs/decisions/](docs/decisions/README.md)** — ADR 0001 through 0016
  (multi-tenant core, RLS model, ephemeral QR sessions, theme tokens, role
  model, the v5 rebuild, login freeze).
- **[docs/README.md](docs/README.md)** — documentation master index.
- **[technical-documentation.md](technical-documentation.md)** — deep
  architecture & schema.
- **[business-documentation.md](business-documentation.md)** — SaaS model,
  tiers, unit economics.
- **[worklog.md](worklog.md)** — the running engineering log (agent rounds,
  watch items, deferred census).
