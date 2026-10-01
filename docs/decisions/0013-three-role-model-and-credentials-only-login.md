# ADR 0013: Three-Role Model (superadmin / owner / staff) & Credentials-Only Login

- **Status**: Accepted (supersedes the role matrix defined in ADR-0009)
- **Date**: 2026-10-01
- **Deciders**: Omkar Kardile (Product Owner) & TSOS Engineering
- **Shipped in**: v4.0.0 (commit `4e75408`)

---

## Context

The owner flagged a fundamental flaw in the shipped role model (ADR-0009) and the auth surface:

1. **The SuperAdmin could land in the cafe POS.** Session restore in `App.tsx` only routed
   superadmin to the platform console when the persisted URL happened to be `/superadmin` or `/`;
   any other restored URL (e.g. `/coolkafe/pos`) dropped the platform operator into a tenant
   workspace. *"why superadmin is getting POS screen???"*
2. **owner, manager and cashier all effectively saw the same screen** — the ADR-0009 four-role
   matrix (owner / manager / cashier with tab restrictions) no longer matched how the product is
   actually used: operators run everything. *"why owner and every fucking one is getting same
   screen??"*
3. **Self-serve signup made no sense**: businesses are provisioned by the platform (SuperAdmin
   wizard), so "Register Cafe" + Magic Link on the login screen were dead weight.
4. **Credentials were leaked on the login screen itself** (on-screen demo card + one-click sign-in
   buttons).

Owner directive (2026-10-01): superadmin is *us, the developer*, with an add business/cafe/
restaurant wizard that creates an owner; owner gets business dashboards plus staff-account
creation; **manager and cashier are merged into one role** that gets the whole POS app; remove
magic-link register cafe and one-click sign-in from login; keep credentials in a `.md` file under
`docs/` for manual copy-paste; rework the DB system accordingly.

This directive explicitly **lifts the ADR-0010 login-screen freeze** (recorded as a status update
in ADR-0010) — scope limited to the auth rework.

## Decision

1. **Three roles only — `superadmin` | `owner` | `staff`** (`src/types.ts` `UserRole`,
   `src/lib/rbac.ts`):
   - **`superadmin`** — the TSOS developer/platform operator. Lands on the **SuperAdmin Platform
     console ALWAYS** (including restored sessions); tenant URL routes are ignored for superadmin
     sessions (`handleUrlRoute` early-returns). The explicit "Switch to Cafe View" dev tool remains
     as a deliberate testing escape hatch. The wizard provisions a business and **creates its
     OWNER account** with a generated temporary password.
   - **`owner`** — full cafe app (all 11 tabs) + business dashboards + **Create Staff Login**
     (Settings → Staff Accounts; gated by `canManageStaff`, owner-only).
   - **`staff`** — Manager + Cashier merged into ONE role that operates the **WHOLE cafe POS app**
     (all 11 tabs). Staff/kitchen users see an owner-only notice instead of staff-account
     creation.
   - `normalizeRole()` folds every legacy role (`manager`, `cashier`, `kitchen`, `barista`, `chef`,
     `server`, `waiter`, `cleaner`) → `staff` at the auth boundary, so legacy accounts keep working
     without data migration.
2. **Login = email + password ONLY** (`AuthScreen.tsx`): "Register Cafe" tab, "Magic Link" tab,
   the 4 one-click demo buttons, and the on-screen credentials card are **REMOVED**. The email
   field accepts friendly aliases (`admin` / `owner` / `staff` / `manager` — implemented with
   `type="text" inputMode="email"` so HTML5 validation does not block aliases). Error copy points
   to `docs/CREDENTIALS.md`.
3. **Credentials live in `docs/CREDENTIALS.md`** — every account (superadmin/owner/staff + legacy
   merged accounts + aliases), the provisioning flow, and the Supabase-dashboard fallback for
   cloud auth. No credentials in the UI.
4. **Local credential registry** (`tsos_local_credentials`): accounts created in-app (wizard-
   created owners, owner-created staff) register locally (offline-first) with **best-effort**
   Supabase Auth push; the documented dashboard fallback covers cloud sign-in for
   app-provisioned accounts.
5. **DB rework — `supabase/migrations/003_role_model_staff_merge.sql`**: `tenant_users.role`
   values folded in place to the trio, CHECK constraint replaced, RLS helper functions
   `tsos_is_tenant_member()` / `tsos_is_tenant_owner()` + member/owner policies re-created on the
   new role set. Run by the owner in the Supabase SQL editor (as with migration 001).
6. **`authService` rework**: role narrowing to the trio, alias map, known-account fallback,
   `signUp(email, password, name, role, tenant)` (local registry first; cloud notices
   non-blocking), magic-link API removed; PIN-pad logins resolve to `staff`.

## Alternatives Rejected

- **Keeping five+ granular roles**: the owner explicitly merged manager + cashier; finer
  granularity can return later if asked.
- **Server-side user creation via a service-role API**: the SPA has no backend; the
  wizard/registry + documented Supabase-dashboard fallback is the honest path without one.
- **Hiding the SuperAdmin "Switch to Cafe View" tool**: the developer still needs an explicit
  escape hatch for tenant testing; the default landing surface is always the platform console.
- **Rewriting history for legacy role values in the DB**: in-place fold + CHECK replacement keeps
  tenant data intact (no destructive migration).

## Consequences

- ✅ Role boundaries now match the real org: **developer → owner → staff**; superadmin can never
  leak into a tenant POS by URL accident.
- ✅ Login leaks nothing — credentials are distributed deliberately via `docs/CREDENTIALS.md`.
- ✅ Legacy accounts keep working (auto-merge to `staff`); no destructive data migration.
- ⚠️ **Migration 003 must be run by the owner on the live Supabase project** (same owner-side
  blocker as migration 001).
- ⚠️ Cloud-auth users created in-app require the documented Supabase-dashboard step when the
  local registry does not apply.
- ⚠️ The ADR-0009 manager/cashier tab matrix is historical record only — `rbac.ts` is now the
  three-role source of truth.

## Verification (v4.0.0)

- `tsc --noEmit` + `bun run lint` → 0 errors; fresh-load console clean.
- agent-browser E2E: login shows sign-in only; `admin@tsos.dev` → SuperAdmin Platform (NOT the
  POS), incl. after restart; owner → POS + Settings → **Create Staff Login** created
  `rahul@coolkafe.com / staffpass1` end-to-end → sign-out → sign-in as the new staff → lands in
  POS as "Rahul Verma — Cafe Staff"; legacy `manager` alias → "Cafe Staff"; wrong password →
  "Invalid email or password. Credentials live in docs/CREDENTIALS.md."

## References

- Supersedes (role matrix only): [ADR 0009](0009-role-based-access-control-and-route-guards.md)
- Unfreezes (login scope): [ADR 0010](0010-login-screen-design-freeze-and-design-system-directives.md)
- Credentials file: [`docs/CREDENTIALS.md`](../CREDENTIALS.md)
- Migration: [`supabase/migrations/003_role_model_staff_merge.sql`](../../supabase/migrations/003_role_model_staff_merge.sql)
- Summary index: [`decisions.md`](../../decisions.md) (ADR 0013)
