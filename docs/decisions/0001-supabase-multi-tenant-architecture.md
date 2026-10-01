# ADR 0001: Supabase Multi-Tenant Architecture

- **Status**: Accepted
- **Date**: 2026-09-25
- **Deciders**: Lead Full-Stack Security Architect

---

## Context
The TSOS platform was originally prototyped with in-memory mock stores and client-side simulation. To support multi-outlet cafe chains and independent businesses under a scalable SaaS model, a centralized cloud database architecture was needed.

## Decision
Adopt Supabase (PostgreSQL 15+) as the unified cloud database, authentication layer, and realtime sync provider.
- All entities reference a primary `tenant_id` UUID foreign key.
- Shared database, shared schema approach with row-level segregation for maximum cost efficiency and effortless global reporting.
- Server-side business logic executed in PostgreSQL functions (`plpgsql` RPCs) with `SECURITY DEFINER` to guarantee ACID transactions.

## Consequences
- **Positive**: Eliminates bespoke backend API maintenance; unlocks built-in Supabase Realtime WebSocket subscriptions for KDS and POS; enforces constraints at the relational layer.
- **Negative**: Requires strict discipline around client queries and RLS policies to prevent data leakage between tenants.
