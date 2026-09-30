# TSOS Help & Credentials Reference

- **Document Version**: 2.8.0 (2026-10-01)

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

## 🛰️ SuperAdmin Platform Console (v2.8.0)

Log in as **Super Admin** and open `/superadmin` (or use the sidebar's *Switch to Cafe View* to come back). In the default theme the console matches the owner's ServePoint Dashboard frame:

- **Navigate** — deep-teal sidebar with gold active pills: **Dashboard**, **Businesses** (count badge), **Provisioning Wizard**, **Subscriptions**, **Audit Trail** (count badge). The profile card at the bottom signs you out. On phones/tablets the sidebar becomes a scrollable pill strip at the top of the content.
- **Jump to a tenant** — the "Jump to tenant..." search in the top bar matches business name, city, owner or slug; picking a result opens the Businesses Directory pre-filtered to that cafe.
- **Read the dashboard** — Daily Sales shows platform orders (teal, left axis) and revenue (gold ₹, right axis); **MRR by Plan** donut swaps its center to any plan you hover; the sage tiles show Platform Orders and Recurring Revenue; Top/Busiest Tenants leaderboards click through to the Directory; the **Trials ending soon** strip flags trials running out (red ≤3 days, gold ≤7 days).
- **Change the window** — the **Today / Last 7 Days / Last 30 Days** selector re-scales the trend chart, the Top-Tenants revenue and the banner GMV line. **Export CSV** downloads the full tenant snapshot (status, plan, rates, orders, revenue, trial/billing dates).
- **Themes** — the sidebar shell is ServePoint-only; Tessera and dark mode keep the classic "TableSide" console (the toggle cycles servepoint → tessera → dark).

---

## 🧾 Orders Workspace (v2.7.2)

The **Orders → Orders Directory** tab is now a two-pane bill browser (matching the owner's ServePoint Figma) in the default theme:

- **Browse** — the left list shows every order as a card (`Order #N` + status dot, table/type · items · customer, amount + time). Click a card to open its **full detail pane** on the right: status & payment chips, Details (Table / Items / Customer / Payment), the complete item list with add-ons, GST/fee/total breakdown, kitchen notes and loyalty points.
- **Filter** — status pills (All / New / Preparing / Ready / Completed / Cancelled) plus a **date filter** (All Time / Today / Last 7 Days); the summary line under the title always shows how many orders are in view and their combined value. The search bar at the bottom of the list matches order #, customer or dish.
- **Act** — active orders show a **"Move to Preparing/Ready/Completed"** button (same sync path as the KDS bump); completed orders show **"Print Invoice"**; the top actions open the Thermal Workstation or the quick receipt. **Export** downloads the filtered orders as a CSV ledger (Excel-friendly UTF-8).
- **Themes** — the two-pane is ServePoint-only; Tessera and dark mode keep the classic dense table.

---

## 📊 Reports Analytics (v2.7.1)

The **Reports, Sales & Unit Economics** screen is now fully ServePoint-themed, with two new owner-facing features:

- **Week-over-Week comparison** — the *Current Week Daily Sales & Revenue Trend* chart draws a dashed **"Last Week (₹)"** curve behind this week's solid line. The highlights strip shows a **+% WoW** chip (green = growing, red = shrinking) next to Total Orders, the chart tooltip reveals *"Same day last week"* for every hovered day, and a footnote spells out the totals (e.g. *week-to-date ₹5,779 vs ₹1,608 (+259% WoW)*).
- **Live Operational Pulse auto-refresh** — the *Live Operational Pulse* strip (last-60-min revenue, active tables, kitchen load, staff on shift) now refreshes itself **every 30 seconds**, with an "auto 30s" badge and a live "upd HH:MM:SS" timestamp.
- **Rush heatmap in ServePoint teal** — the *Daily Sales Heatmap* bars and 7-Day Grid cells use a calm deep-teal intensity ramp (darkest = busiest) with the gold Orders line; the dashed red Peak Rush Threshold stays as the staffing alarm.

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
