# Research: Multi-Tenant B2B SaaS Architecture & Scaling Model

- **Author**: Lead Full-Stack Security Architect
- **Target Platform**: TSOS Cloud POS & Tableside Self-Ordering Storefront
- **Date**: 2026-09-25

---

## 1. Multi-Tenancy Architecture Pattern Evaluation

When designing a cloud POS operating system for hospitality, three tenancy models exist:

| Model | Description | Pros | Cons | Decision |
|---|---|---|---|---|
| **Database-per-Tenant** | Each cafe receives a standalone PostgreSQL instance. | Ultimate data isolation; custom migrations. | Costly; complex cross-tenant analytics; slow provisioning. | Rejected |
| **Schema-per-Tenant** | Single database with separate PostgreSQL schemas (`tenant_coolkafe`, etc.). | Logical separation; easier backups. | Migration overhead across hundreds of schemas; table bloat. | Rejected |
| **Shared Database, Shared Schema with RLS** | All tenants share the same tables, segregated strictly by `tenant_id` and PostgreSQL RLS. | Cost-effective; instant tenant onboarding; unified cross-tenant BI; simple index maintenance. | Requires strict discipline and automated testing to prevent query leaks. | **Accepted** |

---

## 2. Row-Level Security (RLS) Query Execution

PostgreSQL evaluates RLS at the query planner level. For every incoming query on `orders`:
```sql
SELECT * FROM orders WHERE status = 'preparing';
```
PostgreSQL automatically rewrites the execution tree to:
```sql
SELECT * FROM orders WHERE status = 'preparing' AND (tenant_id = current_tenant_id());
```
To guarantee that this rewrite executes in $O(\log N)$ or $O(1)$ time, composite B-tree indexes are enforced:
```sql
CREATE INDEX idx_orders_tenant_status ON orders(tenant_id, status);
CREATE INDEX idx_orders_tenant_created ON orders(tenant_id, created_at DESC);
```

---

## 3. High-Concurrency Dining Hours Strategy

During peak breakfast and lunch rush hours (12:00 PM – 2:30 PM), restaurants experience intense read/write spikes. TSOS employs the following resilience patterns:

1. **Read Replica / CDN Caching**: Static menu catalog (`menu_items`, `menu_variants`, `addons`) is cached on edge CDN with stale-while-revalidate invalidation upon staff catalog edits.
2. **PostgreSQL Connection Pooling**: Transaction-mode Supabase Pooler (`port 6543` / `port 5432` on AWS AP-South-1) sustains hundreds of concurrent diners with minimal database worker exhaustion.
3. **Optimistic Local UI Updates**: When a diner adds an item to cart or a cashier taps a quick item on the POS screen, Zustand reflects the state change immediately (0ms input latency).
4. **Idempotent Order Creation**: `create_atomic_order` takes a unique client-generated UUID for the order, preventing double-billing on spotty cafe Wi-Fi connections.
