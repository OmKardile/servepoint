# ADR 0003: Production Chrome Purge and Dynamic Scoped Routing

- **Status**: Accepted
- **Date**: 2026-09-25
- **Deciders**: Lead Full-Stack Security Architect

---

## Context
Early prototypes of TSOS contained demo artifacts: a top "SURFACES" switcher bar, simulated latency toggles, fake offline buttons, and tutorial guidance tooltips. These cluttered the screen and made the app unsuitable for cashier and kitchen deployment.

## Decision
1. **Purge Demo Controls**: Remove all prototype headers, guidance dots, and demo reset buttons.
2. **Implement Path-Based Scoped URLs**:
   - `/:slug/pos`: POS terminal for the tenant.
   - `/:slug/kds`: Kitchen Display System.
   - `/:slug/orders`: Live orders directory.
   - `/:slug/inventory`: Stock and recipe tracking.
   - `/:slug/reports`: Financial and shift telemetry.
   - `/:slug/settings`: Outlets, printers, and taxes.
   - `/:slug/t:tableNumber`: Guest QR ordering.
   - `/superadmin`: SaaS management portal.
3. **SuperAdmin Impersonation**: Built a one-click "Enter Tenant Workspace" session override allowing platform operators to troubleshoot customer issues instantly.

## Consequences
- **Positive**: Clean, distraction-free POS workstation; natural browser bookmarking for specific cafe stations (e.g. tablet mounted in kitchen bookmarked to `/coolkafe/kds`).
- **Negative**: Requires handling fallback routes when an invalid slug is supplied in the URL.
