# TSOS Compact 1 — SaaS Architecture & Multi-Tenant Briefing

- **Date**: 2026-09-25
- **Phase**: Architecture Foundation & Multi-Tenant B2B SaaS Modeling
- **Workspace**: `d:\work\megatech\mega-tsos`
- **Context Source**: Conversation Inception / Directive Briefing

---

## 1. Executive Summary

TSOS (The Cafe Operating System) was chartered as a production-grade **Multi-Tenant B2B SaaS Platform** targeted at independent cafes, specialty coffee roasters, bakeries, and quick-service restaurants (QSRs). The initial codebase contained rich UI mockups and prototypes, but required a complete architectural overhaul to transition into a hardened, cloud-backed multi-tenant operating system.

---

## 2. Core Business Entities & Roles

1. **Platform SuperAdmin / DeveloperAdmin**:
   - Manages platform tenants, SaaS subscriptions, discount overrides, deal notes, telemetry, and provisioning.
2. **Tenants (Subscribing Businesses)**:
   - Independent businesses (e.g., `CoolKafe`), each with their own locations, staff, menu catalog, tables, and settings.
3. **Staff Roles**:
   - `owner`: Full business configuration, payouts, staff credentials, tax settings.
   - `manager`: Shift approvals, inventory audits, loyalty point adjustments.
   - `cashier`: POS counter billing, receipt printing, payment collection.
   - `barista` / `kitchen`: Kitchen Display System (KDS) order intake and ticket preparation.
   - `waiter`: Floor table ordering and status updates.
4. **Guests / Diners**:
   - Dine-in customers scanning table QR codes for self-ordering, loyalty lookup, and digital bill settlement.

---

## 3. Key Directives Established

- **Multi-Tenant Isolation**: Every database table must possess a `tenant_id` foreign key referencing `tenants(id)`.
- **Row-Level Security (RLS)**: Enforced at the PostgreSQL layer using session-based `current_tenant_id()` extraction.
- **Trusted Pricing & Calculations**: Cart totals, tax computations (GST 5%), and platform fees must be validated or calculated via trusted PostgreSQL RPC functions.
- **Unified Surface Routing**: Scoped URLs (`/:slug/pos`, `/:slug/kds`, `/:slug/orders`, `/:slug/t:tableNumber`) must dynamically load tenant context.

---

## 4. Initial Workspace Review

- Identified existing React + TypeScript + Vite project structure.
- Identified UI surfaces: POS screen, KDS screen, Inventory screen, Orders directory, Shifts screen, Settings screen, SuperAdmin console, and Storefront QR screen.
- Noted need to replace simulated state and mock timers with genuine Supabase PostgreSQL connectivity.
