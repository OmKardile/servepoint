# TSOS Help & Credentials Reference

- **Document Version**: 2.6.3 (2026-10-01)

## 🔑 Login Credentials

| Role | Username / Email | Password | Access Level |
|---|---|---|---|
| **Super Admin** | `admin@tsos.dev` *(or `admin`)* | `admin123456` | Platform console (`/superadmin`), multi-tenant impersonation, SaaS metrics |
| **Cafe Owner** | `owner@coolkafe.com` *(or `owner`)* | `demo123456` | Full workspace access (`/:slug/pos`, inventory, shifts, reports, settings) |
| **Store Manager** | `manager@coolkafe.com` *(or `manager`)* | `demo123456` | Shift audits, recipe adjustments, register reconciliation |
| **Counter Cashier** | `cashier@coolkafe.com` *(or `cashier`)* | `demo123456` | High-velocity counter POS billing & tender payments |

---

## 🎨 Theme Appearance

- **Tessera** (editorial dark, forest + chartreuse) is the **default** theme since v2.6.0; since v2.6.1 the header, navbar, POS and KDS carry full Tessera styling; since v2.6.5 the OrdersScreen does too.
- **⚠️ Login screen is FROZEN (ADR-0010)**: the login screen is owner-approved as-is — no changes (including the reserved Surface Pack illustrations) until the owner explicitly unfreezes it. See [`decisions.md`](decisions.md) ADR-0010.
- The header **Dark Mode** button cycles `tessera ↔ dark`. The warm-cream and obsidian themes remain available to developers via `setThemeMode('warm' | 'obsidian')` (Zustand store).
- Selection persists in `localStorage` under `tsos_theme_mode`. Clearing that key restores the Tessera default.

---

## ⚙️ Environment Variables (`.env`)

**Since v2.6.4 the live Supabase URL and public anon key are hardcoded as fallback defaults in `src/lib/supabase.ts` and in `render.yaml`** — the app builds and connects to the live project with zero env configuration. The entries below are therefore **optional overrides** (useful for pointing a local dev copy at a different Supabase project).

Configure these in your local `.env` or in your cloud deployment settings (Render / Vercel):

```env
# Supabase Live Cloud Project
VITE_SUPABASE_URL="https://vbufsuzzmehsidshopku.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZidWZzdXp6bWVoc2lkc2hvcGt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyOTE0MjMsImV4cCI6MjEwNTg2NzQyM30.kymgulEpO3R7FRhrfFO-lpmYrAcOqBF82sSW4unZHBE"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZidWZzdXp6bWVoc2lkc2hvcGt1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDI5MTQyMywiZXhwIjoyMTA1ODY3NDIzfQ.7ChyfZnWQeb5V0ZWJZD5hYY1-DpN-yg4gK_PXfrvSlk"
```
