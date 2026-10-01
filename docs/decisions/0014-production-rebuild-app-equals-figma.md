# ADR 0014: Production Rebuild — App Equals the Figma (ServePoint Production)

- **Status**: Accepted (owner-directed; supersedes the surface inventory of ADR-0011)
- **Date**: 2026-10-01
- **Deciders**: Omkar Kardile (Product Owner) & TSOS Engineering

---

## Context

After v4.0.0 the owner judged the accumulated product unacceptable: *"everythings messed up fucked up"* — and ordered a ground-up production pass: *"delete everything except login page; redesign everything according to the figma design each and every component; keep in mind to make this end production app; remove any demo or development things."*

The codebase at v4.0.0 carried 42 components across an 11-tab IA (pos/kds/orders/shifts/inventory/menu/tables/customers/offers/reports/settings + guest storefront + platform), a 1,865-line hybrid store with demo seed fallbacks (`src/data/seedData.ts`, `saasSeedData.ts` — CoolKafe fake tenant, fake menu/orders), three theme systems (Tessera, dark, ServePoint + a remap layer), dev tools ("Switch to Cafe View"), email-alias auto-login shortcuts, and on-screen demo credential fallbacks. The owner's Figma (57 frames archived at `docs/design/servepoint/frames/`) describes a different, focused product.

## Decision (v5.0.0)

**The product equals the Figma.** One theme (ServePoint), one data source (Supabase), zero demo content.

1. **Kept**: the login screen (v4.0.0 credentials-only form; Figma "Welcome Back" split pattern), Supabase client, three-role model (ADR-0013).
2. **Deleted**: KDS, Inventory, Menu management, Shifts, Customers, Offers, Reports, Tables, Storefront + QR OrderTracking, native/, printer/session/sound services, BOTH seed-data modules, the hybrid store, Tessera + dark themes and the remap layer, "Switch to Cafe View" dev tool, email-alias auto-login, hardcoded demo account fallbacks. (All recoverable from git history.)
3. **Built to the frames**:
   - **Shell**: ServePoint sidebar (logo; Dashboard, Food & Drinks, Messages, Bills, Settings; OTHERS: Notifications, Support; user card + Open Profile; © footer) + header (back arrow, breadcrumbs, bell with gold dot, history clock, search).
   - **Dashboard** (`Dashboard_219-29880`): Daily Sales line chart, Total Revenue donut, Total Order + New Customers stat cards, Best Employees, Trending Dishes, "Today" range selectors.
   - **Food & Drinks** (8 frames + `Frame_30`): Categories grid → category item grid (gold selected state) → item detail modal (photo, weight, gold price, add-on qty steppers, gold "Add to Order") + running order → charge.
   - **Bills** (`Bills_219-29423`): two-pane — filterable order list with status dots + search; detail pane (status pill, Details/Order Info/Items/Total, gold "Charge customer" CTA).
   - **Messages** (`Messages_219-29372`): Teams/Personal conversation list + chat thread with gold send.
   - **Notifications** (`Notifications_219-29744`): notification cards.
   - **Settings** (`Checkout_Settings_219-29597` + siblings): sage section nav — Profile, Notification, Appearance, Checkout settings, Security, Language & Region — **plus Staff Accounts (owner-only, ADR-0013 mandate)**.
   - **SuperAdmin Platform** (no Figma frames; ServePoint-styled): Businesses, Provisioning Wizard (creates the OWNER), Subscriptions, Platform Dashboard.
4. **Production data layer**: new `src/lib/api.ts` — typed Supabase access (tenants, categories, menu_items, orders, order_items, tenant_users, subscriptions, notifications, messages). Loading skeletons per `Food_&_Drinks_219-26844`, error states, Figma empty states. **No seed data. No mock fallbacks.**
5. **Auth**: Supabase Auth primary + local credential registry for wizard/owner-created accounts (ADR-0013). Alias shortcuts and hardcoded demo accounts removed; `docs/CREDENTIALS.md` rewritten to the production account model (platform operator account only; owners/staff are provisioned in-app).
6. **DB**: migration `004_notifications_messages.sql` adds notifications/conversations/messages tables + RLS (run by owner alongside 001+003).

## Alternatives Rejected

- **Polishing the 11-tab app in place**: the IA itself is the mess the owner rejected; the Figma defines a focused 5-section app.
- **Keeping legacy themes behind a toggle**: three theme systems + a remap layer is un-shipable complexity; ServePoint-only is the design mandate.
- **Keeping demo seed data "for first-run experience"**: explicitly banned; empty states + provisioning are the production path.

## Consequences

- ✅ Every rendered component traces to an archived Figma frame; single theme, single data source.
- ✅ Demo/dev surface area is zero; the app is presentable to real cafe operators.
- ⚠️ Functionality outside the Figma (KDS, inventory, shifts, reports, QR storefront) is removed and would need owner-approved design frames to return.
- ⚠️ Owner must run migrations 001 + 003 + 004 on the live Supabase project.
- ⚠️ Messages/Notifications depend on migration 004; until run, those screens show error/empty states (graceful).

## References

- Supersedes surface inventory: [ADR 0011](0011-servepoint-ui-adoption.md)
- Role model: [ADR 0013](0013-three-role-model-and-credentials-only-login.md)
- Design tokens: [ADR 0012](0012-figma-rest-pipeline-and-exact-servepoint-tokens.md) — canvas `#F6F5F2`, deep teal `#0F3D3E`, gold `#B88E2F`/`#967221`, sage `#D9E2DD`, text `#1A1A1A`/`#6B6B6B`/`#969696`, Poppins, radii 12/16/24/100
- Frames: `docs/design/servepoint/frames/` (57 PNGs)
