# ADR 0002: Row-Level Security (RLS) Tenant Isolation Model

- **Status**: Accepted
- **Date**: 2026-09-25
- **Deciders**: Lead Full-Stack Security Architect

---

## Context
In a multi-tenant B2B SaaS platform, sensitive financial data, sales receipts, customer phone numbers, and inventory costs must never leak across tenants. We needed an unbypassable security boundary at the database level.

## Decision
Implement PostgreSQL Row-Level Security (RLS) across all tables in the public schema:
1. Created helper function `current_tenant_id()` which extracts the `tenant_id` from the authenticated user's JWT metadata (`request.jwt.claims->>'tenant_id'`).
2. Applied `FOR ALL` policies to operational tables:
   ```sql
   CREATE POLICY "Tenant Staff Full Access" ON orders
   FOR ALL TO authenticated
   USING (tenant_id = current_tenant_id())
   WITH CHECK (tenant_id = current_tenant_id());
   ```
3. Implemented scoped public read policies for customer QR ordering, allowing anonymous diners to view only active menu items and tables matching the cafe's slug.

## Consequences
- **Positive**: Even if a malicious client alters API parameters, PostgreSQL denies unauthorized reads and writes automatically.
- **Negative**: Database indexes must be placed on `(tenant_id, ...)` composites to avoid query performance degradation during RLS filtering.
