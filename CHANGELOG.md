# Changelog

All notable changes to **TSOS (The Cafe Operating System)** are recorded in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.8.1] — 2026-10-01 — Storefront + OrderTracking ServePoint (Guest QR Surfaces) + Deep-Link Session Fixes + Veg Filter/Sort + Live ETA + Bill Sharing

### Added — Guest QR surfaces rebuilt to the ServePoint language (12th + 13th explicit surfaces)
- **Storefront ServePoint branch (`StorefrontScreen.tsx`)**: ivory `#F6F5F2` canvas, white phone-frame card with `#E3E7E0` hairline + deep-teal ambient shadow; deep-teal `#0F3D3E` hero bar (gold roundel with cafe initials, cafe name, gold table chip, theme-aware session timer chip: sage/white-on-teal → gold at ≤2min → danger pulse at ≤30s/expired); sage security strip (10m ephemeral session + Expire/Tamper/Renew controls restyled); gold "expiring soon" banner; deep-teal active category pills on sage tracks; white menu cards with gold-border hover, deep-teal prices (mono retired), deep-teal Add CTAs with sage glyphs, sage qty steppers with gold plus; gold "View Order" cart bar; deep-teal/95 auto-lock overlay with gold lock chip + gold Renew CTA; ServePoint confetti (`#B88E2F`/`#0F3D3E`/`#D9E2DD`); sage-tinted cart drawer (gold variant labels, ivory bill breakdown, deep-teal Pay & Send with gold check). Legacy warm branch **byte-preserved** for tessera/dark/warm (remap layer handles palette). FSSAI veg/non-veg marks intentionally keep the regulatory green/brown.
- **OrderTracking ServePoint branch (`OrderTrackingScreen.tsx`)**: ivory canvas + white frame; status hero (sage/gold/gold/teal rings per step); **NEW live ETA card** — status-based estimate ("Estimated ~12–15 min" → "~7–10 min" → "Ready now" → "Served"), "Placed X min ago", gold progress bar (15% → 55% → 90% → deep-teal 100%); **stepper upgraded with connector rail** (absolute `#E3E7E0` line, deep-teal passed nodes, gold-ringed current node with gold **NOW** chip); sage Call Waiter + deep-teal Digital Bill tiles; sage items summary with deep-teal total. Legacy branch byte-preserved.
- **New feature — bill sharing on the guest bill modal (parity with ReceiptModal v2.7.0)**: WhatsApp share (gold CTA; direct `wa.me/<phone>` chat when the order carries a guest phone, else the share picker), Copy-to-clipboard (white/teal CTA) with a merged sage/danger feedback chip, Download Bill (deep-teal + gold glyph), Print (sage ghost).
- **New feature — storefront veg filter + price sort (ServePoint branch)**: "Veg only" leaf toggle (deep-teal active pill) and a sort select (Most Popular / Price: Low → High / Price: High → Low) layered over the base category+search filter via a memoized `serveFilteredItems`; ServePoint-only empty state (sage search circle + "Clear filters" reset). Verified sort ordering ₹40 → ₹160.

### Fixed — QR deep-link session + navigation (guest journey was broken end-to-end)
- **Route clobbering (`App.tsx`)**: the URL-route effect re-ran on every `tables` change and re-processed the current path mid-session — placing an order deterministically flipped `order_track` back to `storefront` (stale `/coolkafe/t1` path re-matched) and clobbered the tracked order id. Route handling now runs **once at boot** (waiting for table hydration so deep-links still match tables) and on `popstate` only (latest-handler ref).
- **Tenant slug for sessions (`StorefrontScreen.tsx`)**: the session RPC was called with `location.slug` (`demo-cafe`) instead of the tenant slug (`coolkafe`) → the live RPC always rejected. Now `currentTenant?.slug || location.slug || 'coolkafe'`.
- **Session RPC fall-through (`sessionService.ts`)**: an explicit RPC rejection (unknown tenant, `INVALID_PERMANENT_QR`) returned early and skipped the documented offline HMAC fallback — locking every path. `issueEphemeralSession` now remembers the rejection and falls through (the local fallback still only mints a session when `fallbackTable.qr_token` matches the presented token, so tampered tokens can never pass); `verifyOrderSubmissionSession` falls through to the local HMAC verdict for locally-signed `v1.` tokens, and verifies opaque live tokens **by token alone** (`p_table_id: null` — the live session belongs to the live table uuid, so comparing against the local demo id always failed `TABLE_MISMATCH`).
- **Lock-screen diagnosability**: `sessionError` is now displayed on the auto-lock overlay (gold note in ServePoint, rose in legacy) instead of failing silently.
- **`App.tsx` public surfaces**: the standalone storefront/tracking `<main>` canvas follows the active theme (ServePoint ivory vs warm legacy).

### Verified
- `tsc --noEmit` → 0 errors; `bun run lint` clean. Browser E2E: **live deep-link** `/:slug/t01?token=<live-uuid>` → session issued by RPC (09:56) → add items → cart → guest name/note → **Pay & Send ₹630** → Order #107 → ServePoint tracking with ETA card + NOW stepper → **Digital Bill modal** (Copy feedback chip verified, WhatsApp/Download/Print present) → URL stayed `/track/live` (clobber fixed); **in-app Test QR** path with the local `qr-demo-t1` token → RPC rejection → local HMAC `v1.` session minted → order placed → tracking shows "Table T1 (Window)"; theme round-trip servepoint → tessera (legacy warm branch + remap intact) → dark → servepoint; **mobile 390px** storefront renders cleanly (hero wraps, controls stack, categories scroll); zero browser console errors (only the known 42501 RLS queue-locally info line).

---

## [2.8.0] — 2026-10-01 — SuperAdmin ServePoint (Dashboard Frame) + Range Selector + Interactive MRR Donut + Quick Jump + Trial Radar + CSV Snapshot

### Added — SuperAdmin surface rebuilt to the owner's Dashboard frame (`Dashboard_219:29880` filled / `219:23581` wireframe)
- **ServePoint shell (`SuperAdminScreen.tsx` ServePoint branch)**: deep-teal `#0F3D3E` sidebar per the frame — gold roundel logo + "TSOS Platform" wordmark, nav pills with **gold active state** (`#B88E2F` pill, deep-teal text, exactly like the frame's Dashboard item) and gold count badges (Businesses 5, Audit Trail 3 — the frame's Notifications "5" language), gold-highlighted Provisioning Wizard, **OTHERS** section with Switch to Cafe View, and the frame's **pinned profile card** (SA avatar, name, role, Sign Out outline button, © 2026 footer). Main column: breadcrumb top bar (back arrow → cafe view, `Platform › {Tab}`), **quick tenant-jump search** (type ≥2 chars → dropdown of name/city/owner/slug matches → click lands on the Businesses Directory pre-filtered to that tenant via `setSelectedSuperAdminBusinessId`), RLS-Active live chip, page title row with mobile sign-out.
- **ServePoint dashboard (`SuperAdminDashboard.tsx` ServePoint branch)** — the frame's 6-card grid: **Daily Sales** line chart (dual Y-axes: integer orders left in teal `#0F3D3E` with white-stroked dots, ₹ revenue right in gold `#B88E2F` dashed, `#E3E7E0` dashed grid, white tooltip with teal/gold dots, footer totals + %-vs-yesterday chip); **MRR by Plan** interactive donut (center swaps to the hovered plan's MRR on mouseenter — Starter sage `#8FA99B` / Growth gold `#B88E2F` / Pro deep-teal `#0F3D3E` / Enterprise danger `#DC2626`, legend with per-plan counts + ₹ values, zero-MRR trial plans filtered from the arcs but kept in the legend); the frame's two **sage stat tiles** (Platform Orders with danger-red square chip + dark underline, Recurring Revenue with gold square chip + MoM delta + lifetime-GMV sub-line); **Top Tenants** leaderboard (Best-Employees analog: initial avatars in the teal/gold/sage cycle, `plan · city` subtitles, range-scaled revenue, click-to-jump); **Busiest Tenants** (Trending-Dishes analog: gold `business_type` badge chips, all-time orders, click-to-jump) with the **Trial Radar** strip (trials ending soon, urgency-colored day chips: ≤3d red, ≤7d gold, else white); **Tenant Lifecycle** (sage/gold/red 2×2 tiles + archived footer), **System Health** (teal icon chips on ivory wells, sage 99.98% Uptime pill), **Recent Operations** (sage action chips, Poppins timestamps, Full Audit Log link).
- **New feature — shared date-range selector**: Today / Last 7 Days / Last 30 Days segmented control (sage track, white active pill) driving the Daily Sales trend, the Top-Tenants revenue scaling and the banner GMV line. Today renders the frame's 9 AM–9 PM hourly buckets with a café rush curve; 7d/30d render per-day series with weekend lift. All series are **deterministic** (stable string-hash weights over each tenant's lifetime orders/revenue — no `Math.random`, no flicker across renders).
- **New feature — CSV platform snapshot**: gold-outline Export button downloads the full tenant roster (name, status, plan, rate, cycle, orders, lifetime revenue, city, owner, trial end, next billing) with proper CSV escaping.
- **BusinessDirectory quick-jump consumer**: pending `selectedSuperAdminBusinessId` now pre-filters the directory's search to that business and clears itself.

### Fixed
- **Height contract, self-measuring**: the app Header's height varies with viewport width (92px desktop, ~100px mobile). The shell now measures its own `offsetTop` (with resize listener) and sizes to `calc(100vh − inset)` — verified zero page scroll at 1280×720, 390×844 and a 577px-tall window.
- **Orders/revenue scale mismatch**: single-axis chart made the orders line flat against the ₹ scale → dual Y-axes with `allowDecimals={false}` on the orders side.

### Changed
- **ServePoint remap layer extended (section 5e)**: purple/violet family (`#7C3AED`, `#9333EA`, `#6B21A8`…) → deep-teal/info-teal, green family → ServePoint `#17803D`, amber family → pressed gold, soft-red family → exact `#DC2626`, plus their tint backgrounds → sage/danger tints. The Directory, Wizard, Subscriptions and Audit tabs now ride the owner theme without individual rewrites.
- **Mobile (<lg)**: sidebar hidden; a horizontally-scrollable pill nav strip replaces it (teal active pill, gold Provisioning, Cafe View quick-switch) and Sign Out moves to the title row.
- Legacy "TableSide" shell + dashboard **byte-preserved** for tessera/dark/warm behind the `themeMode === 'servepoint'` gate; `App.tsx` passes `onSignOut` to the screen for the sidebar profile card.

### Verified
- `tsc --noEmit` → 0 errors; `bun run lint` clean. Browser E2E as superadmin: shell + all 6 dashboard cards render; **range switch** (Today → 7 Days: banner GMV ₹6,864→₹15,929, weekday X labels, integer axes); **quick jump** "cool" → CoolKafe Indiranagar → Businesses tab with search pre-filled; **CSV download** verified on disk (header + 5 tenant rows); **theme round-trip** servepoint → tessera (legacy TableSide shell intact) → dark (legacy, remap) → servepoint (shell, zero scroll); **mobile 390px** pill-strip nav + stacked banner + full-width chart; Directory/Subscriptions/Audit/Wizard tabs all ServePoint-consistent via the 5e remap; zero browser console errors.

---

## [2.7.2] — 2026-10-01 — Orders Two-Pane (Bills Frames) + Date Filter + CSV Export + One-Tap Status Advance

### Added — Orders Directory rebuilt as the ServePoint two-pane (`Bills_219:23130` / `219:24297`)
- **Left pane — order cards list** (420px, white): `Orders` title + sage count chip + gold-tinted **Export** button, live summary strip (`N orders in view · ₹X combined value`, cancelled excluded), status pill row (active = deep-teal pill), **date-range filter** (All Time / Today / Last 7 Days — the frame's date dropdown), order cards (`Order #N` + ServePoint status dot/label, table-or-type · items · customer subtitle, amount + timestamp right-aligned, selected card = ivory bg + deep-teal ring), and the frame's **bottom-pinned search bar** ("Search for order #, customer, dish...").
- **Right pane — order detail**: breadcrumb (`Orders / Order #N`), Poppins-bold `Order #N` title + status chip + **PAID/pending payment chip** (payment_status-aware: completed→PAID gold-tinted, failed→danger, else neutral), placed-at meta line, Print/Eye icon actions; **Details card** (Table / Items / Customer / Payment 4-column grid incl. fee payer microcopy); **Order Info card** (sage thumbnails, gold `2x` qty chips, variant + add-on lines, per-item totals, full totals block: Subtotal → Discount (gold, when >0) → GST → Platform Fee → bold Total); **Kitchen Notes sage strip** + loyalty earned/redeemed chips when present.
- **Contextual sticky CTA**: active orders get a full-width deep-teal **Move to Preparing/Ready/Completed** button (`advanceOrderStatus` — same cloud+KDS path as KDS bump) with "syncs to KDS, cloud & receipts instantly" microcopy; completed orders get a gold **Print Invoice** CTA; cancelled orders show a neutral no-actions note.
- **New features**: date-range filter, **filtered CSV export** (reuses `exportFinancialLedgerCSV`), one-tap status advance with deep-teal toast, combined-value summary strip, and auto-select of the first filtered order (detail pane never empty while orders exist).

### Fixed — layout height + theme gating
- **Page-scroll bug**: the two-pane relied on flex height inheritance through the auto-height app shell → content grew the page (`min-height:auto` chain). Root now `h-[calc(100vh-145px)]` (measured shell chrome) and the two-pane container `h-[calc(100vh-204px)]`; verified `document.body.scrollHeight === innerHeight` (zero page scroll) with the detail pane scrolling internally.
- **Dark-mode hybrid**: the two-pane originally gated on `!isTessera`, so theme `dark` (cycle servepoint→tessera→dark→servepoint) rendered the *light* ServePoint two-pane under the dark-remapped shell. The two-pane is now **ServePoint-only** (`themeMode === 'servepoint'`); Tessera keeps its explicit table byte-identical and dark/warm keep the legacy table via the CSS remap (all warm ternaries restored in the legacy branch).

### Verified
- `tsc --noEmit` → 0 errors. Browser E2E across all three theme modes: ServePoint two-pane (auto-selected Order #105, card selection, Details/Order Info/totals/loyalty rendering), **Move to Ready** click → card + KDS nav count updated (4→3) + toast "Order #105 moved to Ready — KDS & cloud synced", **Today filter** 18→10 cards with summary recompute, Export click clean; Tessera round-trip shows the untouched 8-column table; dark mode shows the warm-remapped table (hybrid gone); zero browser console errors beyond the known 42501 RLS queue line.

---

## [2.7.1] — 2026-10-01 — Reports Analytics Complete: ServePoint Internals + Week-over-Week Comparison + Live Pulse Auto-Refresh

### Added — New analytics features
- **Week-over-Week comparison in WeeklySalesLineChart**: the chart now computes the *previous* week's same-weekday revenue and draws it as a dashed comparison curve behind this week's solid line ("Last Week (₹)" legend entry). The metric highlights strip gained a **+% WoW delta chip** (green TrendingUp / red TrendingDown, tooltip shows last week's total), the chart tooltip shows "Same day last week" per hovered day, and a footnote under the chart spells out week-to-date vs last-week totals (e.g. "week-to-date ₹5,779 vs ₹1,608 (+259% WoW)").
- **LiveOpsPulse 30s auto-refresh heartbeat**: the pulse widget now re-computes its "last 60 min / tables / kitchen load / staff" windows every 30 seconds even when the manager leaves the tab open — with a "auto 30s" indicator and a live "upd HH:MM:SS" timestamp so staff can trust what they're seeing.

### Changed — Reports internals explicit ServePoint (screen now 100% on-theme)
- **LiveOpsPulse**: first theme-aware pass (was hardcoded Tessera dark forest). ServePoint branch = white card, gold LIVE pill with pulsing dot, deep-teal icon chip, ivory metric tiles with gold-border hover, Poppins values, ServePoint kitchen-severity ramp (idle `#969696` → light `#17803D` → moderate `#B88E2F` → busy `#967221` → critical `#DC2626`), sage insight strip. Tessera branch byte-preserved.
- **WeeklySalesLineChart**: ServePoint branch = deep-teal `#0F3D3E` revenue line + white-stroked dots, gold `#B88E2F` orders line, gold dashed Daily-Avg reference (pressed-gold label), sage hairline grid/axes, sage inset metric switcher with white active pill, Poppins semibold highlight values (mono retired), white tooltip with teal/gold dots, ivory footer. Warm branch byte-preserved.
- **DailySalesHeatmap**: theme-aware from JS (inline SVG attrs bypass CSS remaps) — ComposedChart bars now use the ServePoint **deep-teal monochrome rush ramp** (ivory → sage → sage-dark → mid-teal `#2C6E64` → deep-teal `#0F3D3E`), orders line gold with pressed-gold active dots, `#E3E7E0` grid/axes, matrix heat cells + legend swatches on the same teal ramp. Peak-threshold stays ServePoint danger red.
- **Global ServePoint remap extended** (benefits all remaining warm surfaces): deep warm ramp `#C2410C`→deep teal / `#EA580C`→mid teal / `#FED7AA`·`#FFEDD5`·`#FFF7ED`·`#FFF4E5`→sage-tint / warm borders→`#E3E7E0`; cool blues `#2563EB`→deep-teal/info-teal, `#E0F2FE`→info-soft; danger variants `#B91C1C`→exact `#DC2626`; `hover:bg-[#EA580C]`→pressed gold; `ring-[#F97316]`→gold ring.

### Verified
- `tsc --noEmit` → 0 errors. Browser E2E: LiveOpsPulse white/ServePoint + heartbeat ticking (upd timestamp advancing), weekly chart teal line + dashed last-week curve + "+259% WoW" chip, heatmap ComposedChart teal ramp + gold orders line, matrix view teal heat cells + matched legend, Staffing Planner gold CTA via remap; theme cycle servepoint→dark→tessera→servepoint round-trips (Tessera branch: forest pulse + orange line + white comparison curve intact); Menu/Orders screens re-checked with zero remap regressions; zero browser console errors.

---

## [2.7.0] — 2026-10-01 — Cloud Order Sync Fix + Reports/Receipt ServePoint + Receipt Sharing

### Fixed — Orders never reached the live cloud (QA-discovered, highest priority)
- **Root cause**: `realtimeService.syncOrderToSupabase` pushed local demo ids (`biz_coolkafe_99`, `loc-demo-01`) straight into the live schema's UUID columns → Postgres `22P02 invalid input syntax for type uuid` on **every** sale since v2.6.2; zero orders ever landed in Supabase and the offline queue silently collected every attempt.
- **Fix**: added a cached `resolveCloudIds` resolver — tenant UUID resolved by slug lookup (the exact path menu hydration has used since v2.6.2), location UUID resolved as the tenant's first `locations` row; valid UUID pairs pass through untouched. Resolution failure now queues locally instead of hammering Postgres.
- **Local→cloud id map**: after a successful insert, the local `ord-…` id maps to the returned cloud UUID so KDS bump / cashier status advances target the correct cloud row (previously `updateOrderStatus` also risked 22P02 on non-UUID ids — now guarded: unmapped non-UUID ids skip the cloud call cleanly).
- **Offline queue carries `tenantSlug`** so deferred flushes resolve ids too; `order_items` insert uses the resolved tenant UUID.
- **Verification**: sale E2E now fails past 22P02 into `42501` RLS (anon INSERT policy pending — migration 001 re-run still owed); the insert *reaches* the orders table with valid UUIDs. Catch block now discriminates: `42501` logs an actionable info line ("RLS blocked — order kept local + queued"), other failures keep the full warning.

### Added — Top-level ErrorBoundary (QA gap)
- React DevTools warned "An error occurred in the \<App\> component. Consider adding an error boundary" — any screen crash unmounted the whole tree into a white screen. New `src/components/common/ErrorBoundary.tsx` wraps `<App />` in `main.tsx`: ServePoint recovery card (ivory canvas, deep-teal Reload CTA, Back-to-POS ghost, error message inspector) instead of a blank page.

### Added — Receipt sharing (WhatsApp + Copy) in ReceiptModal
- **WhatsApp share**: builds a plain-text bill (cafe header, GSTIN, order meta, items, totals, payment mode, footer) and opens `wa.me` — direct chat when the guest's phone is on the order, else the share picker. Indian-counter-native: receipts go where guests actually read them.
- **Copy to clipboard** with success/failure feedback chips; both buttons sit beside Kick Drawer in the receipt footer.

### Redesigned — Reports/Dashboard explicit ServePoint pass (per Dashboard frame 219:23581)
- **Header**: white with `#E3E7E0` hairline, sage icon chip + gold `BarChart3`, near-black Poppins title; **gold `#B88E2F`→`#967221` Export split-CTA** replacing the Tessera chartreuse pill; snapshot chip on sage.
- **KPI cards ×4**: white cards + `#E3E7E0` hairlines + gold-border hover + soft shadow, labels `#6B6B6B`, values Poppins bold `#1A1A1A` (mono retired), sage icon chips (deep-teal glyphs); **Savings card = gold-tinted hero** (`#D9E2DD`/70 + `#B88E2F`/40 border, pressed-gold value).
- **Top Selling Items**: gold `#B88E2F` bars on sage `#D9E2DD`/70 tracks (was orange on warm); `#6B6B6B`/`#1A1A1A` text.
- **Payment Method tiles**: UPI on sage + deep-teal icon, Cash on gold tint + pressed-gold icon, Card on deep-teal tint + deep-teal icon (replaces warm orange/green/blue rainbow with the restrained ServePoint trio); tabular-nums values in `#1A1A1A`.
- **Export modal**: white/`#E3E7E0` chrome, ivory option wells, gold Ledger / deep-teal Daily / pressed-gold Inventory download CTAs; toast = deep-teal `#0F3D3E` with gold check.
- **OrderTypeBreakdown donut**: white card + `#E3E7E0`, slices **Dine-In = deep-teal `#0F3D3E`, Takeaway = gold `#B88E2F`, Delivery = sage `#8FA99B`** (exact frame language), ivory slice strokes, `#1A1A1A` center count, `#6B6B6B` legend stats, white ServePoint tooltip; Tessera branch preserved untouched.

### Redesigned — ReceiptModal explicit ServePoint pass (7th surface)
- **Header**: sage `#D9E2DD` strip, white icon chip with gold printer glyph, gold-tinted PAID badge (was emerald), paper-width selector with **deep-teal active pill**.
- **Tabs**: gold `#B88E2F` active underline + pressed-gold text (was orange); receipt canvas on ivory `#F6F5F2`; feedback banners sage/deep-teal.
- **Footer**: white; Kick Drawer + Copy ghosts, gold-tinted WhatsApp chip, **Print = deep-teal `#0F3D3E`→`#0B3132` CTA with gold printer glyph**, **Next Sale = gold `#B88E2F`→`#967221`**. Thermal bill/KOT previews stay monochrome paper (print artifacts, correctly untouched).

### Verified
- `tsc --noEmit` → 0 errors; fresh-load console = **0 errors / 0 warnings** (previously: 22P02 warning on every sale); full sale E2E in ServePoint — 2-item cart ₹126 → UPI tender → Confirm → Order #105 PAID with receipt (Copy → "Receipt copied to clipboard."; WhatsApp button opens wa.me); KDS board shows #105 as NEW ticket → bump to PREPARING with **zero UUID errors**; Reports header/KPIs/donut/payment tiles/Export modal render exact ServePoint; theme cycle servepoint→dark→servepoint round-trips with Tessera Reports intact in dark.

## [2.6.9] — 2026-10-01 — PaymentModal + Dine-in Tables Explicit ServePoint

### Redesigned — PaymentModal now follows the ServePoint tender language (Bills/Charge frames)
- **Header**: sage `#D9E2DD` strip, "Complete Sale Tender" eyebrow `#6B6B6B`, **"Amount to Collect" in Poppins semibold `#1A1A1A` with the amount in pressed-gold `#967221`** (mono retired for ServePoint); close `#6B6B6B`→`#DC2626` hover on white pill.
- **Method tabs**: all four (UPI QR / Cash / Card / Split Bill) share the gold active state — `#B88E2F` border + `#B88E2F/10` tint + `#967221` text + gold ring (replaces the four-color warm rainbow, matching ServePoint's restrained accent); inactive `#E3E7E0` hairline with `#1A1A1A` icons and gold-tint hover.
- **Method wells**: UPI/Card/Split on sage `#D9E2DD`, Cash on canvas `#F6F5F2` (input-bearing well stays quieter); white QR card with `#E3E7E0` border; VPA row `#6B6B6B` with `#967221` copy hover; "Simulate UPI App Confirmation" as white ghost with gold hover.
- **Cash**: white input with gold focus ring, **Exact = mini deep-teal `#0F3D3E` button**, denomination chips white/`#E3E7E0` with gold hover (Poppins semibold, mono retired), change-due card white with deep-teal (sufficient) / `#DC2626` (short) value.
- **Split**: sage well, gold active diner count, white diner rows with ghost UPI/Cash/Card chips (gold hover), paid rows in deep-teal tint, "Remaining" in pressed-gold.
- **Bill summary**: labels `#6B6B6B`, values Poppins semibold `#1A1A1A` (mono retired), discount in `#967221`, loyalty chip gold-tinted, platform-fee chip `#B88E2F/15`.
- **Footer**: white with `#E3E7E0` hairline; **Confirm Payment CTA = deep-teal `#0F3D3E` → `#0B3132` with white text + soft teal shadow** (exact "Charge customer" button); Back to Cart `#6B6B6B`→`#1A1A1A`.
- **Confetti**: ServePoint palette `[#B88E2F, #0F3D3E, #D9E2DD]`.
- **Fixed**: transient JSX artifact (doubled `>` on the Copied! span) caught by byte-level verification during the pass.

### Redesigned — Dine-in Tables full ServePoint pass (first theme-aware version of this screen)
- **Canvas/header**: ivory `#F6F5F2` canvas, white header bar with `#E3E7E0` hairline, sage icon chip + gold grid icon, near-black title, **gold `#B88E2F`→`#967221` "Add New Table" CTA**.
- **Floor cards**: free = white card + `#E3E7E0` hairline + gold-border hover lift; occupied = white card with **gold ring `#B88E2F/45` + gold status badge**; free badge in deep-teal tint `#0F3D3E/10`; active-order inset gold-tinted with pressed-gold amount (Poppins semibold, mono retired); "Ready for guests" dashed `#E3E7E0` with `#969696`.
- **Actions**: View QR ghost (`#E3E7E0`→sage hover), Test QR gold-tinted (`#B88E2F/10`→solid gold hover), status select on sage.
- **Add Table modal**: white + `#E3E7E0`, gold focus rings, gold submit; **QR Stand printout: sage stand well, deep-teal cafe name, gold table label, `#F6F5F2` URL box, gold "Test Valid QR Order" CTA, ghost Copy/Print**.
- Tessera/warm fallbacks preserved unchanged (pre-existing remap behavior in those modes).

### Verified
- `tsc --noEmit` → 0 errors; agent-browser E2E — full tender flow (UPI QR → Cash ₹400/change ₹1.00 → Split 2 diners) in ServePoint, Confirm Payment → Order #104 PAID + receipt with ServePoint confetti; Tables screen floor plan + QR stand modal render exact ServePoint; theme cycle servepoint→tessera→dark→servepoint round-trips; zero browser console errors.

## [2.6.8] — 2026-10-01 — CartDrawer Explicit ServePoint (Bills Detail-Pane Language)

### Redesigned — Current Order drawer now follows the ServePoint "Bills" detail pane (frame 219:23130)
- **Header**: signature sage `#D9E2DD` strip with gold shopping-bag icon (`#967221`), near-black Poppins "Current Order", gold-tinted items pill, `#6B6B6B` Clear → `#DC2626` hover; order-type tabs on deeper `#E3E7E0` inset.
- **Items**: white cards with `#E3E7E0` hairlines and gold hover ring; item totals in Poppins semibold `#1A1A1A` (mono retired for ServePoint per Figma), "each" captions `#969696`; **sage `#D9E2DD` qty steppers** with `#6B6B6B`→gold buttons; Remove `#969696`→`#DC2626`.
- **Footer**: white pane (Figma has no cream footer), sage coupon input with gold focus ring, **Apply button in exact deep-teal `#0F3D3E`**; totals labels `#6B6B6B` with semibold near-black values; platform-fee chip gold-tinted; **"To Pay" value in pressed-gold `#967221`**; **Charge CTA = the Figma "Charge customer" button: full-width deep-teal `#0F3D3E` → `#0B3132`, white text, soft teal shadow**.
- **Empty state**: sage icon well + gold bag, non-italic semibold near-black copy.
- **Verified**: `tsc --noEmit` → 0 errors; agent-browser E2E — add item → sage header/steppers render → Charge opens PaymentModal (UPI QR tender, gold active tab) → Back to Cart round-trip; zero console errors; tessera/warm branches untouched.

## [2.6.7] — 2026-10-01 — Figma REST Pipeline & Exact ServePoint Tokens (ADR-0012)

### Unlocked — owner-provided Figma PAT + uploaded design kits
- **FIGMA_TOKEN** (owner-supplied, `file_content:read` scope) saved verbatim in `.env`; Render wired via `sync: false` — GitHub Push Protection (GH013) blocks committing Figma PATs, so the blueprint declares the variable and Render prompts for the value once at apply (token stays out of Git; revocable from Figma → Settings).
- **Full design exploration** of *ServePoint POS Preview* via the REST API: all **6 pages** inventoried (Cover, Research, Wireframes, UI Exploration, **Final UI — 57 frames**, Components); **all 57 Final UI screens rendered to PNG** and archived at `docs/design/servepoint/frames/` + 6 page overviews at `docs/design/servepoint/pages/` — future development no longer needs live Figma access.
- **Owner-uploaded kits triaged** (`upload/`): Dae Alright! POS kit RAR extracted (layout reference); Dashboard `.sketch` unzipped (JSON + preview); two fig-kiwi **v4** `.fig` files are below fig2sketch's minimum (v15) and resist image carving — documented dead end, superseded by the REST pipeline.

### Fixed — ServePoint tokens were estimates; now EXACT (mined from node fills)
- Canvas `#F2EFE5`→**`#F6F5F2`** · depth `#17402E`→**`#0F3D3E` deep teal** · accent `#E9A63C`→**`#B88E2F` gold** (pressed `#967221` — from the Primary Button component variants) · text →**`#1A1A1A` / `#6B6B6B` / `#969696`** · signature **sage surface `#D9E2DD`** added (cards/inputs/user card) · hairline `#E7E2D2`→`#E3E7E0` · danger confirmed `#DC2626` · font **Plus Jakarta Sans → Poppins** (400/16 body, 500/16 buttons, 600/24 headings) · radii 12/16/24/100 confirmed.
- `index.css`: full `[data-theme="servepoint"]` token + remap rewrite; `sp-cta` now the exact Primary Button (gold bg, near-black text, Poppins 500, r12); `sp-sidebar` exact `#0F3D3E`; new `sp-surface` utility; gold scrollbar hover.
- `Header.tsx` / `WebNavbar.tsx`: every ServePoint branch re-tokened hex-for-hex (gold brand block + active tabs + baseline marker, near-black text, sage outlet selector & dropdown hover, `#967221` fee accent).
- `index.html`: Poppins imported; body/selection classes re-tokened.
- **PosScreen menu cards** — new explicit `isServepoint` branch implementing the Figma card: sage card + gold-border hover lift, `#E3E7E0` image well, near-black name/description, non-mono semibold price, **gold Add button** (`#B88E2F`→`#967221`), `#C9D3CC` footer divider, `#DC2626` low-stock badge.
- **Verified**: `tsc --noEmit` → 0 errors; browser E2E — frozen login pixel-identical (Tessera pin intact), ServePoint POS matches the Figma (sage cards, gold CTAs, deep-teal ribbon), cart add→Charge/Pay golden path works, theme cycle servepoint→tessera→dark→servepoint round-trips with every theme intact, zero console errors.

### Documented — ADR-0012
- Full decision record (token table, PAT custody, 57-frame archive, kit triage) at [`docs/decisions/0012-figma-rest-pipeline-and-exact-servepoint-tokens.md`](docs/decisions/0012-figma-rest-pipeline-and-exact-servepoint-tokens.md).

## [2.6.6] — 2026-10-01 — ServePoint UI Adoption (Owner Figma, ADR-0011)

### Added — `servepoint` theme: the owner's own design becomes the default post-login look
- **Source**: owner's Figma file *ServePoint POS Preview* (LOKOMAX STUDIO). Cover thumbnail recovered via the thumbnail-CDN redirect (app pages are CloudFront-403; REST API needs a PAT) and archived at `docs/design/servepoint/cover-thumbnail.webp` — it yielded the full design language: **ivory canvas `#F2EFE5` · white rounded cards with soft forest shadows · deep forest-green primary `#17402E` · amber accent `#E9A63C` · Plus Jakarta Sans bold geometric headings · warm hairline borders `#E7E2D2`**.
- **Theme engine** (`src/types.ts`, `src/lib/store.ts`): new `'servepoint'` ThemeMode is the **default** (fresh sessions; stored `tessera` one-time-migrated — Tessera was agent-imposed, never owner-chosen). Header toggle now cycles `servepoint → tessera → dark → servepoint`; warm/obsidian remain reachable via `setThemeMode`.
- **Auth-scoped theme pinning** (`src/App.tsx`): while unauthenticated (login screen, public storefront/track routes) the document is **force-pinned to Tessera** — the ADR-0010 frozen login renders in its exact approved environment with **zero edits to `AuthScreen.tsx`**; ServePoint applies to the authenticated app only.
- **CSS layer** (`src/index.css`): `[data-theme="servepoint"]` token block + remaps mirroring the Tessera architecture — creams→ivory, `.bg-white` cards keep white but gain ServePoint shadow treatment, stone text→forest green, orange accent→amber, dark-stone strips→forest green, Plus Jakarta Sans bold (non-italic) headings, amber scrollbar; new `sp-cta` (amber CTA with lift/sink ergonomics), `sp-sidebar`, `sp-banner`, `sp-ghost` utilities. `index.html` imports Plus Jakarta Sans.
- **Explicit chrome** (`Header.tsx`, `WebNavbar.tsx`): amber TSOS brand block, ivory header + navbar, amber active tab with baseline marker, `sp-cta` Fast PIN, forest/amber model line, soft-shadow More dropdown, ServePoint badge treatments. POS ribbon converts to forest green via the remap.
- **Verified**: `tsc --noEmit` → 0 errors; browser E2E — authenticated POS/Orders render full ServePoint (white cards, amber tabs, forest text), theme cycle servepoint→tessera→dark→servepoint round-trips with every theme intact, and the logged-out login screen is **pixel-identical frozen Tessera** (explicitly re-verified after localStorage clear). Zero console errors.

### Documented — Figma access paths (ADR-0011)
- To unlock "explore all pages" pixel-exact fidelity: owner sets `FIGMA_TOKEN` in `.env` (REST API pulls every page's tree + renders) or drops exported screenshots into `docs/design/servepoint/`. Until then the cover thumbnail is the token source of truth.

## [2.6.5] — 2026-10-01 — OrdersScreen Tessera + Design Governance (ADR-0010)

### Redesigned — OrdersScreen explicit Tessera (conditional `isTessera`; warm styling preserved)
- **Sub-navigation**: Orders Directory / Print Logs tabs as uppercase tracked pills — active = chartreuse block with `tessera-block` 3D shadow, inactive = forest ghost with tinted count pills; failed-print error badge moved to the Tessera status palette (`#F87171` soft tint/ring).
- **Filter bar**: forest-inset search input with chartreuse focus ring; status filter pills — active = chartreuse `tessera-block`, inactive = raised forest chips with `#2A4A37` borders.
- **Orders table**: card converted to `tessera-block` on `#0F1D17`; forest header row; `#1F3D2E` row dividers with `#142620` hover; order numbers + timestamps in JetBrains Mono; customer names set in **italic serif** (Tessera editorial signature); totals in chartreuse mono; fee-payer chip, loyalty point chips (+pts emerald / −pts accent purple) and payment icons (UPI chartreuse / Cash emerald / Card info blue) all restyled to the status palette; action buttons as forest ghost icons with chartreuse/info-blue hover rings; empty state gets serif-italic editorial copy.
- **Verified**: `tsc --noEmit` → 0 errors; browser E2E — status filter switching, Print Logs tab round-trip, zero console errors.

### Documented — Design Governance (ADR-0010, owner directives)
- **LOGIN SCREEN FROZEN**: `src/components/auth/AuthScreen.tsx` is approved as-is at v2.6.4 (commit `5f38efc`) and must not change until the owner explicitly says so. All future redesign passes skip it.
- **Recorded design direction**: *Free 75 Illustrations — Surface Pack* (Figma Community) is the designated illustration source for login **when unfrozen**; the *shadcn/ui Design System* (Figma Community) is the component reference for all post-login surfaces (dark/light mode, buttons, forms). Sandbox is CloudFront-blocked from figma.com — asset export path documented in the ADR.
- Full ADR: [`docs/decisions/0010-login-screen-design-freeze-and-design-system-directives.md`](docs/decisions/0010-login-screen-design-freeze-and-design-system-directives.md).

## [2.6.4] — 2026-10-01 — Live Credentials Re-Hardcoded (Owner Decision)

### Changed — Supabase credentials embedded as hardcoded defaults
- **`render.yaml`**: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` restored to **hardcoded values in the blueprint** (reverting the v2.6.3 `sync: false` prompt flow) so a Render blueprint apply is zero-touch and every deploy boots connected to the live project. All other v2.6.3 hardening is untouched: service `tsos-pos`, `npm install --include=dev && npm run build`, `NODE_VERSION=22`, immutable asset caching, security headers, `autoDeploy` + PR previews.
- **`src/lib/supabase.ts`**: the live URL and public anon key are now **hardcoded fallback defaults** in the client module (previously the fallback was a fake `demo-tsos-project` key that silently pushed the app into offline-resilient mode whenever env vars were missing). `import.meta.env.VITE_SUPABASE_*` values still take precedence when set, so `.env` overrides keep working. `isSupabaseConfigured()` now evaluates the resolved constants.
- **Rationale (owner directive)**: the anon key is a *public* client key — data is protected by Supabase Row Level Security, not by key secrecy. Embedding it guarantees that Render applies, Vercel builds, and bare `npm run build` with no env config all produce a live-connected bundle, and eliminates the class of "deployed build silently offline" failures. The `service_role` key must STILL never appear in any client-facing file.

### Verified
- `tsc --noEmit` → 0 errors. Browser E2E: app boots authenticated, Header shows **Cloud Synced (24 ms)** — live Supabase session with the hardcoded keys; zero console errors.

## [2.6.3] — 2026-10-01 — Render Blueprint Hardened (`tsos-pos`)

### Changed — `render.yaml` rewritten to production-grade blueprint
- **Service renamed** `tsos-cafe-pos` → **`tsos-pos`** (per operator request).
- **Secret hygiene**: hardcoded Supabase anon key removed from the committed blueprint — `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` now use `sync: false` so Render prompts for values at blueprint-apply time and they never live in Git. Comment block documents that the anon key is RLS-protected by design and the `service_role` key must NEVER appear here.
- **Build command fixed**: `npm run build` → `npm install --include=dev && npm run build` (Vite/TypeScript are devDependencies; explicit install makes the static build environment deterministic regardless of lockfile auto-detection — repo carries `bun.lock` which Render's default npm flow does not consume).
- **Node pinned**: `NODE_VERSION=22` env var (Vite 8 requires Node ≥ 20.19/22.12).
- **Cache + security headers added**: `/assets/*` → `Cache-Control: public, max-age=31536000, immutable` (Vite content-hashed filenames); `/index.html` → `no-cache` so new deploys propagate instantly; global `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic/geolocation denied).
- **Deploy semantics explicit**: `autoDeploy: true` (deploy on push) + `pullRequestPreviewsEnabled: true` (free preview URLs for static sites).
- **Self-documenting**: header comment explains *why* a Render **Static Site** and not a Web Service — TSOS is a pure client-side SPA with all backend concerns (Postgres/Auth/Realtime/RLS) in Supabase; Web Service free instances sleep after 15 min (50s+ cold starts unacceptable for POS/QR-scan flows) while static sites are free and never sleep. Rationale matches ADR-0008.

### Deployment Notes
- To apply: Render Dashboard → **New + → Blueprint** → select `OmKardile/tsos-alt` → fill the two prompted env vars → Create. SPA rewrite `/* → /index.html` (deep links `/coolkafe/pos`, `/:slug/t1?token=…`, `/track/:id`, `/superadmin`) unchanged.

## [2.6.2] — 2026-09-30 — Live Cloud Menu + Payment Tender Tessera Polish

### Added — Live Cloud Menu Hydration (closes the "menu from local fallback" data gap)
- **`loadMenuFromCloud`** (`src/lib/store.ts`): new store action that fetches `categories` + `menu_items` from Supabase for the active tenant and maps them into the local menu model (`is_available`, `tax_rate_pct`, prices coerced from `NUMERIC`). Resolves the tenant correctly when `currentTenant.id` is a local seed id (`biz_coolkafe_99`) by looking up the live tenant UUID by slug in the `tenants` table. Falls back to the local seed menu with a console notice when the cloud menu is empty or the fetch fails — offline-resilient behavior preserved.
- **Bootstrap wiring** (`src/App.tsx`): `loadMenuFromCloud()` runs in a `useEffect` whenever `currentTenant.id` changes. Console confirmation: `[TSOS] Menu loaded from Supabase cloud (4 categories, 7 items).`
- **Live DB seeded** (ops action, no code): `categories` (4 rows) + `menu_items` (7 rows) inserted into the live Supabase project for the CoolKafe tenant via PostgREST, using deterministic UUIDs and the seed menu's names/prices/images/veg flags. Anon-key readable; POS, Menu builder and Storefront now render the cloud menu.

### Fixed — provisionTenant UUID Bug
- `provisionTenant()` (`src/lib/supabase.ts`) previously inserted starter categories/menu items with string ids like `cat_<slug>_coffee` / `item_<slug>_espresso` into `UUID PRIMARY KEY` columns — the inserts failed server-side (invalid uuid syntax) and the errors were silently discarded, so Supabase-provisioned tenants never got a seeded menu. Now maps seed category ids to `crypto.randomUUID()` values (keeping category→item referential integrity) and logs insert warnings explicitly.

### Redesigned — Payment Tender Modals (completes the Tessera POS flow)
- **VariantModal** (`src/components/pos/VariantModal.tsx`): forest shell with `tessera-block` shadow, serif italic item name, chartreuse selected variant ring, chartreuse addon checkboxes, forest-inset notes input, chartreuse total, `tessera-cta` "Add to Order". Darker `bg-black/60` backdrop. Added `aria-label` to the close button.
- **PaymentModal** (`src/components/pos/PaymentModal.tsx`): forest shell with `tessera-block` shadow; "COMPLETE SALE TENDER" uppercase tracked label + chartreuse mono amount; method tiles (UPI = chartreuse, Cash = emerald, Card = info blue, Split = accent purple — all in Tessera status palette with 12% fills / 40% rings); UPI view on forest inset with the QR panel kept white for scan reliability; cash view with forest tender input, ghost denomination chips and emerald/rose change-due; split-bill view in accent soft-tint with per-diner UPI/Cash/Card chips in the status palette; bill summary with chartreuse fee pill; **Confirm Payment as `tessera-cta`**; confetti colors switch to chartreuse/emerald/off-white in Tessera. Darker backdrop, disabled-state guard on the CTA hover lift, `aria-label`s on icon buttons.

### Verified
- E2E in browser: live cloud menu on POS (alphabetical order = cloud fetch) → add Espresso (goes straight to cart — live DB items have no variants; variant picker only exists for locally seeded menus) → Charge/Pay → tessera PaymentModal → **Escape closes it (outstanding v2.5.0 test item now explicitly verified ✓)** → reopen → Simulate UPI → Order #104 created with Tessera confetti → receipt renders. Storefront `/coolkafe/t1` shows the ADR-0005 security auto-lock as designed (no valid session token). Zero page errors across the sweep; `tsc --noEmit` → 0 errors.

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
