# 🔐 ServePoint — Sign-In Credentials

> **Production account model (v5.0.0).** Accounts are **provisioned, not self-registered**.
> The login screen accepts **email + password only** — no magic link, no self-serve
> "Register Cafe", no one-click sign-ins, no aliases. Copy credentials from here when
> signing in.

## How accounts exist

| Role | Created by | Lands on |
|---|---|---|
| **Platform Operator** (`superadmin`) | Bootstrap account below | ServePoint **Platform console** — businesses, provisioning, subscriptions, audit |
| **Owner** (`owner`) | Platform Operator → Platform console → **+ Add Business** wizard (generates the owner's temporary password) | Their whole business app: Dashboard, Food & Drinks, Bills, Messages, Notifications, Settings (+ Staff accounts) |
| **Cafe Staff** (`staff`) | Owner → **Settings → Staff accounts → Create staff login** (generates a temporary password) | The whole business app (operates everything; cannot manage accounts) |

Accounts created in-app are registered in the local credential registry and pushed to
**Supabase Auth** best-effort. If a cloud sign-in fails for an in-app-provisioned account,
create the user in the Supabase dashboard (**Authentication → Users → Add user**) with the
exact same email/password shown at provision time.

## Platform Operator (bootstrap)

| Email | Password |
|---|---|
| `admin@tsos.dev` | `admin123456` |

This is the only standing account. It exists so the platform can be entered before any
business is provisioned. Keep it private.

**This account is a REAL Supabase Auth user** — seeded into the live project by
`supabase/migrations/005_production_baseline_hardening.sql` (bcrypt password,
`role: "superadmin"` in user metadata, confirmed email, active tenant-free
`tenant_users` row) so RLS `is_superadmin()` authorizes the Platform console.

## Live Supabase project

| Setting | Value |
|---|---|
| Project ref | `gehjsxopcowmotgrrcgc` |
| URL | `https://gehjsxopcowmotgrrcgc.supabase.co` |
| Publishable (anon) key | `sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32` — public by design, RLS-protected |
| Region / pooler | ap-northeast-2 · `aws-0-ap-northeast-2.pooler.supabase.com` |
| DB password | Owner-private — **never committed**; kept in the owner's password store and passed as `SUPABASE_DB_PASSWORD` |

The previous project (`vbufsuzzmehsidshopku`) was deleted by the owner and is retired.

## First-run flow

1. Sign in as the Platform Operator (above).
2. Platform console → **+ Add Business** → fill business details + owner account →
   **Provision business** → copy the shown owner credentials.
3. Sign in as the owner → Settings → **Staff accounts** → create staff logins →
   hand each staff member their credentials.

## Database provisioning (applied)

The fresh project is **fully provisioned** (migrations 001→005, all tables + RLS +
bootstrap operator, zero demo rows). To re-provision any environment idempotently:

```bash
SUPABASE_DB_PASSWORD='<db-password>' bun scripts/db-setup.mjs
```

The script applies any missing migration (001→005) via the session pooler and prints a
verification summary. Migration files remain in `supabase/migrations/` for the SQL-editor
route as well.

Until a table's migration is applied, its surface shows an honest error/empty state —
never a crash.
