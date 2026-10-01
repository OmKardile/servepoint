# ADR 0009: Role-Based Access Control (RBAC), Tab Filtering, and Route Guards

- **Status**: Accepted
- **Date**: 2026-09-25
- **Deciders**: Principal Full-Stack Security Architect & Product Owner

---

## Context
Prior to this release, staff roles (`superadmin`, `owner`, `manager`, `cashier`) only altered visual profile text in the header. Navigation tabs and sensitive operations (Reports & Analytics, Store Settings, Menu Pricing, and Recipe Wholesale Costs) were exposed to all staff members without restriction.

A cashier could navigate to confidential sales telemetry, alter fee engine settings, or adjust ingredient inventory.

## Decision

1. **Role Permissions Matrix (`src/lib/rbac.ts`)**:
   - **`superadmin`**: Lands on `/superadmin` (Platform SaaS Control Plane). Can toggle between SaaS Console and Cafe Operations via Header button. Full access to all tabs when inspecting tenant workspaces.
   - **`owner`**: Full unrestricted access to all 11 tabs (`pos`, `kds`, `orders`, `shifts`, `inventory`, `menu`, `tables`, `customers`, `offers`, `reports`, `settings`).
   - **`manager`**: Access to operational tabs (`pos`, `kds`, `orders`, `shifts`, `inventory`, `menu`, `tables`, `customers`, `offers`, `reports`). Blocked from `settings` (core business legal/fee engine settings reserved for Owner).
   - **`cashier`**: Restricted strictly to counter operations (`pos`, `orders`, `tables`, `kds`). Blocked from `reports` (P&L revenue/margins), `settings`, `inventory` (wholesale ingredient costs), `menu` (price editing), and `shifts` (staff payroll/drawer audits).

2. **Dynamic Navigation Tab Filtering (`WebNavbar.tsx`)**:
   - `allPrimaryTabs` and `allMoreTabs` are dynamically filtered via `canAccessTab(currentProfile.role, tab.id)`.
   - The "More" dropdown is automatically hidden when a user's role has no accessible sub-tabs.
   - Low-stock inventory warnings are hidden from cashiers and displayed only to roles with inventory permissions.

3. **URL Route & Action Guards (`App.tsx` & `AccessDeniedNotice.tsx`)**:
   - If a restricted user enters an unauthorized URL directly (e.g. `/coolkafe/reports`, `/coolkafe/settings`, `/coolkafe/inventory`), the rendering engine intercepts the request and renders `<AccessDeniedNotice>`.
   - Displays clear explanation of required permissions.
   - Provides 1-click **Return to POS** and **Manager Override PIN** actions.

## Consequences
- **Positive**: Strict data confidentiality; protects store revenue numbers, wholesale costs, and merchant settings from unauthorized employee tampering.
- **Positive**: Zero clutter for cashiers—clean, focused 4-tab POS interface.
- **Positive**: Manager PIN override enables immediate cashier exception handling without logging out.
