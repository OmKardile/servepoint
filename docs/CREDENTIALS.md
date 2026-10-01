# 🔐 TSOS Sign-In Credentials

> **Distribution notice (v4.0.0):** Accounts are **provisioned, not self-registered**.
> The login screen accepts email + password only — no magic link, no self-serve
> "Register Cafe", no one-click demo buttons.
>
> - **SuperAdmin (TSOS developer)** provisions each business + its OWNER account via
>   the SuperAdmin Platform → Provisioning Wizard (the wizard generates and displays
>   the owner password; copy it from there).
> - **Cafe Owners** create their STAFF logins in their cafe app → Settings →
>   Staff Accounts → "Create Staff Login".
> - Accounts created in the app are stored in the local credential registry and (when
>   cloud auth is active) in Supabase Auth. If a cloud sign-in fails for an
>   app-provisioned account, create the user in the Supabase dashboard
>   (Authentication → Users → Add user) with the same email/password shown at
>   provision time.

## Platform Accounts

| Role | Email | Password | Lands on |
|---|---|---|---|
| **SuperAdmin (TSOS Developer)** | `admin@tsos.dev` | `admin123456` | SuperAdmin Platform console (businesses, provisioning wizard, subscriptions, audit) |

## Cafe Workspace Accounts (tenant: CoolKafe Indiranagar — `coolkafe`)

| Role | Email | Password | Lands on |
|---|---|---|---|
| **Owner** | `owner@coolkafe.com` | `demo123456` | Full cafe app: POS, KDS, Orders, Menu, Inventory, Tables, Customers, Offers, Shifts, Reports, Settings + **Staff Accounts (create staff logins)** |
| **Staff** (merged Manager+Cashier) | `staff@coolkafe.com` | `demo123456` | Whole cafe POS app — operates everything (no staff-account creation) |

### Legacy accounts (still valid — auto-merged to Staff)

| Old Role | Email | Password | Now resolves to |
|---|---|---|---|
| Manager | `manager@coolkafe.com` | `demo123456` | **Staff** |
| Cashier | `cashier@coolkafe.com` | `demo123456` | **Staff** |

### Quick aliases (type these as the email)

`admin` / `superadmin` / `developer` → SuperAdmin · `owner` → Owner · `staff` / `manager` / `cashier` → Staff
(Passwords: `admin123456` for SuperAdmin, `demo123456` for cafe accounts when omitted.)

## Role Model (v4.0.0)

```
superadmin (TSOS developer)
   └── provisions business + owner account (wizard) ──► owner (cafe owner)
                                                            └── creates staff logins ──► staff (merged manager+cashier)
```

- **superadmin** — platform console ONLY (never the cafe POS by default; an explicit
  "Switch to Cafe View" dev tool exists inside the console).
- **owner** — business dashboards + every cafe screen + staff-account creation.
- **staff** — the WHOLE cafe POS app, operating everything (no account creation).
