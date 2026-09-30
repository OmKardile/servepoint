# TSOS Help & Credentials Reference

- **Document Version**: 2.7.0 (2026-10-01)

## 🔑 Login Credentials

| Role | Username / Email | Password | Access Level |
|---|---|---|---|
| **Super Admin** | `admin@tsos.dev` *(or `admin`)* | `admin123456` | Platform console (`/superadmin`), multi-tenant impersonation, SaaS metrics |
| **Cafe Owner** | `owner@coolkafe.com` *(or `owner`)* | `demo123456` | Full workspace access (`/:slug/pos`, inventory, shifts, reports, settings) |
| **Store Manager** | `manager@coolkafe.com` *(or `manager`)* | `demo123456` | Shift audits, recipe adjustments, register reconciliation |
| **Counter Cashier** | `cashier@coolkafe.com` *(or `cashier`)* | `demo123456` | High-velocity counter POS billing & tender payments |

---

## 🎨 Theme Appearance

- **ServePoint** (owner Figma — EXACT tokens since v2.6.7/ADR-0012: ivory `#F6F5F2` canvas, signature sage `#D9E2DD` surfaces, deep-teal `#0F3D3E` primary, gold `#B88E2F` accent, near-black text, **Poppins**) is the **default theme for the authenticated app** since v2.6.6 (ADR-0011). The header toggle cycles `servepoint → tessera → dark`; `warm`/`obsidian` remain reachable via `setThemeMode()`.
- **⚠️ Login screen is FROZEN (ADR-0010) and always renders in Tessera**: while logged out, the document is force-pinned to Tessera so the approved login look never changes — including the reserved Surface Pack illustrations, which wait for an explicit owner unfreeze. See [`decisions.md`](decisions.md) ADR-0010/0011.
- Selection persists in `localStorage` under `tsos_theme_mode` (legacy `tessera` values migrate to `servepoint` once).

---

## 🧾 Receipt Sharing (v2.7.0)

After every completed sale, the receipt modal offers three ways to get the bill to the guest:

- **Print** — sends the thermal bill (or Kitchen KOT) to the configured printer (80mm/58mm browser or Bluetooth).
- **WhatsApp** — opens `wa.me` with the plain-text bill pre-filled; if the order has a guest phone number it opens the direct chat, otherwise the WhatsApp share picker so you can choose the chat.
- **Copy** — copies the plain-text bill to the clipboard for pasting into any messaging app.

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
