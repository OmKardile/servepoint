# TSOS Compact 2 — Supabase Multi-Tenant Database & RLS Migration

- **Date**: 2026-09-25
- **Phase**: Database Architecture, PostgreSQL Migrations, RLS Security
- **Workspace**: `d:\work\megatech\mega-tsos`
- **Migration**: `supabase/migrations/001_multi_tenant_saas.sql`
- **Database Ref**: `vbufsuzzmehsidshopku.supabase.co`

---

## 1. Executive Summary

Executed Phase 2 of the TSOS modernization: created the comprehensive multi-tenant database schema, deployed Row-Level Security (RLS) policies, established PostgreSQL stored procedures (RPCs) for atomic transactions, and seeded foundational tenant data for `CoolKafe`.

---

## 2. Implemented Schema Architecture

Created 24 core tables with strict `tenant_id` foreign keys and cascading deletes:
- **Tenant & Subscription Layer**:
  - `tenants`: Primary tenant registry with slug, business type, GST number, UPI ID.
  - `subscriptions`: Billing cycle, plan tiers (Starter, Pro, Enterprise), discount percentage, deal notes.
  - `tenant_users`: Multi-tenant user mapping, role definitions, and hashed PIN credentials.
- **Store & Physical Layout Layer**:
  - `locations`: Physical cafe outlets with address and primary outlet flag.
  - `dining_tables`: Physical table numbers, section tags, seating capacity, status (`free`, `occupied`, `billed`, `settled`), and permanent `qr_token` secrets.
- **Menu & Catalog Engine**:
  - `menu_categories`: Hierarchical categorization with display ordering.
  - `menu_items`: Base prices, dietary indicators (`is_veg`), preparation station tags, availability.
  - `menu_variants`: Portion sizing and milk options with differential pricing.
  - `addons` & `menu_item_addons`: Customizable toppings, syrups, and add-ons.
- **Inventory & Recipe Layer**:
  - `ingredients`: Raw material tracking with unit of measurement (kg, l, pcs), reorder threshold levels.
  - `recipes`: Item-to-ingredient consumption ratios for automated recipe depletion upon KDS completion.
  - `inventory_logs`: Immutable audit log of stock movements (waste, restock, sale).
- **Orders & Operations Engine**:
  - `orders`: Master order tickets with order number, order type (`dine_in`, `takeaway`, `delivery`), status pipeline, customer details.
  - `order_items`: Order line items with variant and add-on selections.
  - `payments`: Transaction records (UPI, cash, card, split), tender amount, change due.
  - `shifts`: Cash drawer opening/closing floats, reconciliation variance, staff assignment.
- **Loyalty & Customer CRM**:
  - `customers`: Guest profiles, total spend, visit frequency, loyalty tier.
  - `loyalty_ledgers`: Double-entry point accrual and redemption audit trail.

---

## 3. Row-Level Security (RLS) & Helper Functions

- Implemented `current_tenant_id()` helper to extract tenant context from PostgreSQL JWT claims.
- Applied `FOR ALL` policies requiring `tenant_id = current_tenant_id()` for authenticated staff.
- Implemented public view policies for guest storefront access scoped to active tenant slugs.

---

## 4. PostgreSQL Stored Procedures (RPCs)

Deployed stored procedures for critical operations:
- `create_atomic_order`: Atomic cart intake, line item persistence, and recipe stock adjustment in a single ACID transaction.
- `settle_dining_table`: Cashier table checkout, order status flip, and table status reset to `free`.
- `record_shift_reconciliation`: Cash drawer variance calculation and shift sign-off.
