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

## First-run flow

1. Sign in as the Platform Operator (above).
2. Platform console → **+ Add Business** → fill business details + owner account →
   **Provision business** → copy the shown owner credentials.
3. Sign in as the owner → Settings → **Staff accounts** → create staff logins →
   hand each staff member their credentials.

## Database migrations (owner-run, Supabase SQL editor)

- `supabase/migrations/001_multi_tenant_saas.sql`
- `supabase/migrations/003_role_model_staff_merge.sql`
- `supabase/migrations/004_notifications_messages.sql`

Until 001/003 are applied, cloud data (menu, orders, businesses) will surface honest
error/empty states; until 004 is applied, Messages/Notifications show the migration note.
