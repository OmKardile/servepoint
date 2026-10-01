# ADR 0015 — Fresh Supabase Re-provisioning & Platform Hardening

- **Status:** Accepted (2026-10-01)
- **Supersedes:** the "owner runs migrations in the SQL editor" operating note (ADR-0013 Consequences) — scripted provisioning is now the primary path
- **Related:** ADR-0013 (three-role model), ADR-0014 (production rebuild), `docs/CREDENTIALS.md`, `scripts/db-setup.mjs`, `supabase/migrations/005_production_baseline_hardening.sql`

## Context

The owner deleted the original Supabase project (`vbufsuzzmehsidshopku`) and provisioned a
clean replacement (`gehjsxopcowmotgrrcgc`, ap-northeast-2) with a new `sb_publishable_…`
key. The running app immediately surfaced the failure modes of a partially-migrated
backend: `platform_audit_logs?order=created_at.desc` → HTTP 400 (the table's canonical
column is `timestamp`, migration 001), `tenants` → HTTP 403 (RLS enabled, no policy the
caller satisfies), and password-grant 400s (no cloud user existed).

Two standing constraints shaped the decision: the owner should not have to hand-run SQL,
and no secret (DB password) may enter the repository.

## Decision

1. **Scripted provisioning is the primary path.** `scripts/db-setup.mjs` applies
   migrations 001→005 through the Supavisor **session pooler**
   (`aws-0-ap-northeast-2.pooler.supabase.com` — the IPv4 path; direct
   `db.<ref>.supabase.co:5432` is IPv6-only on current projects), skipping any migration
   whose sentinel (table or widened role constraint) is already present. The DB password
   is supplied via the `SUPABASE_DB_PASSWORD` environment variable and never committed.
2. **Migration 005 hardens the baseline** (idempotent, SQL-editor safe):
   - `platform_audit_logs.created_at` becomes a STORED generated alias of `timestamp`,
     so PostgREST `order=created_at.desc` resolves while `timestamp` stays canonical.
   - Guarded policy re-ensures (migration 001's exact policy names) for
     tenants / subscriptions / platform_audit_logs — partially-migrated environments
     self-repair on apply.
   - Seeds the bootstrap Platform Operator (`admin@tsos.dev`) as a real Supabase Auth
     user: bcrypt password, confirmed, `role:"superadmin"` in `raw_user_meta_data`,
     an `auth.identities` row, and an active tenant-free `tenant_users` superadmin row —
     so `is_superadmin()` authorizes Platform tables from both the JWT and the
     membership-table checks. This is the only seeded account and it is documented in
     `docs/CREDENTIALS.md`.
3. **The app never orders audit logs by a column that may not exist.** The data layer
   orders by `timestamp`; the generated `created_at` alias exists for API parity.
4. **Auth self-heals metadata drift.** After a successful cloud password sign-in, the
   bootstrap operator's `user_metadata.role` is pinned to `superadmin`
   (updateUser + refreshSession, best-effort) in addition to the server-side seed.
5. **Config is centralized**: hardcoded public URL + publishable key in
   `src/lib/supabase.ts` (overridable via `VITE_*`), mirrored in `render.yaml` and
   `help.md`.

## Alternatives Rejected

- **Keep ordering by `created_at` and add the column via 001 edit** — rewriting an
  already-applied migration invites drift; a generated alias in a new migration is
  forward-compatible and idempotent.
- **Service-role client for Platform reads** — a server secret in a static SPA is a
  non-starter; RLS + real user JWTs is the security model.
- **Manual SQL-editor runbook only** — the whole point of this round is removing
  owner-side toil and non-determinism.
- **Insert the auth user without `auth.identities`** — GoTrue treats identities as the
  sign-in source of truth; omitting the row breaks password grants.

## Consequences

- The fresh project is production-ready: 16 tables, RLS policies, bootstrap operator,
  **zero demo rows**.
- Re-provisioning any environment (including the owner's next project) is one command.
- The pooler hostname is region-pinned; if the owner migrates regions, update
  `scripts/db-setup.mjs` and `docs/CREDENTIALS.md`.
- `auth.identities.email` is GENERATED on current GoTrue — inserts must not set it.

## Verification

- `scripts/db-setup.mjs` verification block: 16 public tables; policies (tenants 4,
  subscriptions 2, platform_audit_logs 3); audit columns include both `timestamp` and
  generated `created_at`; operator row present; `tenant_users` superadmin row active.
- REST E2E: password grant → 200 JWT; audit-log query (the exact failing URL) → 200 [];
  tenants → 200 [].
- Browser E2E: operator sign-in → Platform console, all four tabs clean; sign-out;
  390px layout; console/dev.log error-free; `tsc --noEmit` clean.
