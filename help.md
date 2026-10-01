# ServePoint Help & Credentials Reference

- **Document Version**: 2.8.1 (2026-10-01)

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

## 🍽️ Guest Table Ordering (v2.8.1)

- **Diner flow (real QR sticker)**: scanning the table QR opens `https://<app>/coolkafe/t01?token=<table-token>` → the guest Storefront launches with a **10-minute ephemeral session** (countdown chip in the hero; ≤2min turns gold, expiry auto-locks the screen — rescan the sticker to renew). Add dishes (with the **Veg only** filter and **price sort**), open **View Order**, add name/phone/kitchen notes, then **Pay & Send** — you land on the live **Order Tracking** card with an estimated-ready countdown and progress bar.
- **In-app demo**: Owner → **Dine-in Tables → Test QR** launches the same guest experience for the selected table (locally-verified demo session). **View QR** shows the sticker URL a diner would scan.
- **Guest actions**: **Call Waiter** (chime + 5s confirmation), **Digital Bill** modal — **WhatsApp** share (direct chat when the order has a guest phone), **Copy** to clipboard, **Download** the text invoice, or **Print**.
- **Security model**: sessions are cryptographically bound to the table's permanent QR token; a tampered URL or a link opened from browser history after expiry is rejected ("Security Auto-Lock"). The lock screen shows the exact rejection reason for supportability.

---

## 🛰️ SuperAdmin Platform Console (v2.8.0)

Log in as **Super Admin** and open `/superadmin` (or use the sidebar's *Switch to Cafe View* to come back). In the default theme the console matches the owner's ServePoint Dashboard frame:

- **Navigate** — deep-teal sidebar with gold active pills: **Dashboard**, **Businesses** (count badge), **Provisioning Wizard**, **Subscriptions**, **Audit Trail** (count badge). The profile card at the bottom signs you out. On phones/tablets the sidebar becomes a scrollable pill strip at the top of the content.
- **Jump to a tenant** — the "Jump to tenant..." search in the top bar matches business name, city, owner or slug; picking a result opens the Businesses Directory pre-filtered to that cafe.
- **Read the dashboard** — Daily Sales shows platform orders (teal, left axis) and revenue (gold ₹, right axis); **MRR by Plan** donut swaps its center to any plan you hover; the sage tiles show Platform Orders and Recurring Revenue; Top/Busiest Tenants leaderboards click through to the Directory; the **Trials ending soon** strip flags trials running out (red ≤3 days, gold ≤7 days).
- **Change the window** — the **Today / Last 7 Days / Last 30 Days** selector re-scales the trend chart, the Top-Tenants revenue and the banner GMV line. **Export CSV** downloads the full tenant snapshot (status, plan, rates, orders, revenue, trial/billing dates).
- **Themes** — the sidebar shell is ServePoint-only; Tessera and dark mode keep the classic "TableSide" console (the toggle cycles servepoint → tessera → dark).

---

## 🔐 Sign-In & Roles (v4.0.0)

The platform now has **three roles** and a credentials-based login (email + password — no self-serve signup, no magic links, no demo buttons).

- **Where are the passwords?** In [`docs/CREDENTIALS.md`](docs/CREDENTIALS.md) — copy & paste from there. The login screen no longer displays any credentials.
- **SuperAdmin (ServePoint developer)** — `admin@tsos.dev` / `admin123456`. Always lands on the **SuperAdmin Platform** (Businesses, Provisioning Wizard, Subscriptions, Audit). Use the wizard to create a new cafe: it generates the **owner's password** — copy it from the success screen and hand it over securely.
- **Owner** — e.g. `owner@coolkafe.com` / `demo123456`. Gets the full cafe app (POS, KDS, Orders, Menu, Inventory, Tables, Customers, Offers, Shifts, Reports, Settings) and creates **staff logins** in **Settings → Staff Accounts → Create Staff Login** (name + email + temporary password).
- **Staff (merged Manager + Cashier)** — operates the **whole POS app**; no account creation. Old manager/cashier accounts still work — they automatically resolve to Staff. Example: `manager` (alias) / `demo123456`.
- **Aliases**: typing `admin`, `owner`, `staff`, `manager` or `cashier` as the email works with the default passwords (`admin123456` for SuperAdmin, `demo123456` for cafe accounts).

## 🍽️ Inventory, Menu, Shifts & Settings (v3.0.0)

The final four operator surfaces are now fully on the ServePoint look (ivory canvas, sage tracks, deep-teal accents, gold actions) — completing the design rollout across the whole app.

- **Stock & Recipes (Inventory)** — the tab switcher (Stock / Recipes / Audit) uses deep-teal active pills; stock cards highlight low stock with a red tint ring and gold hover border; **Generate Restock Order List** builds a purchase order with white quantity inputs (gold focus) and a gold **1-Click Apply Restock**.
- **Menu & Variants** — a live **availability strip** ("7 of 7 items available • 0 sold out") sits above the table and reacts to filters and toggles; the **Sort menu items** dropdown orders the list by Name A–Z, Price Low–High or High–Low; category pills are deep-teal when active; **Add Menu Item** is gold.
- **Staff & Shifts** — every active shift card now shows a **live Shift duration** (elapsed time net of breaks, refreshed every minute); the history list can be filtered **All / Open / Closed**; the Drawer Reconciliation flow shows the sage Cash-Audit chip with gold Match Expected / Save Audit actions.
- **Settings & Fee Engine** — restyled to the owner's Figma: a sage section-nav card (Printer & Hardware / Checkout Settings / Staff Accounts / Cafe Profile / Reset Data) with a deep-teal active row, setting rows with **gold toggle switches** and hairline dividers, and a full-width gold **Save Changes**. All sections and handlers work exactly as before.

## 👥 Customers & Offers (v2.9.0)

Open **More → Customers & Loyalty** (or **Offers & Promos**). Both surfaces follow the ServePoint look: ivory canvas, white cards with hairline borders, deep-teal accents and gold actions.

- **Customers**: filter by tier tabs (deep-teal active pill); each row shows the sage loyalty chip, tier badge (Platinum = deep-teal, Gold = gold, Silver = sage-slate, Bronze = sage) and a gold progress bar toward the next tier. Click **Receipts / Ledger / Adjust** to open the member detail; the deep-teal member card shows the points balance and the gold **Redeem at POS** button starts a sale with the customer attached. **Register New Customer** (gold button) credits the +25 pts welcome bonus.
- **Offers**: coupon cards show the sage code chip and status; **Create Coupon** opens the form (code auto-uppercases); **Pause Offer / Activate Offer** (gold link) toggles availability instantly at POS and on the guest storefront.

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
VITE_SUPABASE_URL="https://gehjsxopcowmotgrrcgc.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZidWZzdXp6bWVoc2lkc2hvcGt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyOTE0MjMsImV4cCI6MjEwNTg2NzQyM30.kymgulEpO3R7FRhrfFO-lpmYrAcOqBF82sSW4unZHBE"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZidWZzdXp6bWVoc2lkc2hvcGt1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDI5MTQyMywiZXhwIjoyMTA1ODY3NDIzfQ.7ChyfZnWQeb5V0ZWJZD5hYY1-DpN-yg4gK_PXfrvSlk"
```


## 🏁 ServePoint Production App (v5.0.0)

The product was rebuilt to match the ServePoint design exactly. What you see now **is** the Figma:

- **Signing in** — email + password from `docs/CREDENTIALS.md` (no signup, no magic link, no one-click). The Platform Operator lands on the **Platform console**; owners & staff land in their **business app**.
- **Platform console** (Platform Operator only) — Businesses, Subscriptions, Audit log, and **+ Add Business**: a 3-step wizard that creates the business AND its owner login (temporary password shown + copyable — hand it over).
- **Dashboard** — Daily Sales, Total Revenue mix, orders & new-customer counters, Best Employees, Trending Dishes. Empty until orders exist for the day (no fake numbers, ever).
- **Food & Drinks** — browse categories → items (tap a card; it turns gold) → item details (quantity + add-ons) → **Add to Order** → Review order (Dine-in/Takeaway/Delivery, table & guests, GST 5%) → **Place Order**.
- **Bills** — every order with status dots (gold = Active, green = Paid, red = Cancelled), filters, search; open one and **Charge customer** (Cash / Bank Card / UPI — configurable in Settings → Checkout settings). Legacy "new" orders count as Active.
- **Messages & Notifications** — team + personal chats and notification cards. Require migration 004 on Supabase; until then you'll see an honest note instead of fake data.
- **Settings** — Profile, Notification, Appearance, Checkout settings, Security, Language & Region (currency defaults to ₹), and **Staff accounts** (owners only): create staff logins with generated temporary passwords.
- **Anything empty or failing tells the truth** — skeletons while loading, real error text + Retry, Figma-style empty states. No demo data exists anywhere in the app.
