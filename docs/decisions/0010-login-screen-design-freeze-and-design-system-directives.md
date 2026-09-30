# ADR 0010 — Login Screen Design Freeze & Design System Directives

- **Status**: Accepted
- **Date**: 2026-10-01
- **Deciders**: Omkar Kardile (owner), directive issued 2026-10-01
- **Tags**: `design`, `governance`, `auth`, `design-system`

## Context

The owner reviewed the current TSOS design state and issued three standing directives, referencing two Figma Community files:

1. **Login artwork source**: [*Free 75 Illustrations — Surface Pack (Community)*](https://www.figma.com/design/lj1DSq3rrR1PfgZkt91bIu/Free-75--illustrations---Surface-Pack--Community-) is the designated illustration source for the **login surface**.
2. **Post-login component reference**: [*shadcn/ui Design System (Community)*](https://www.figma.com/design/T66KEeqb6RWQTyT02pJOLL/-shadcn-ui---Design-System--Community-) is the reference for **everything after login** — dark/light mode, buttons, forms, etc. TSOS already implements the shadcn CSS-variable token architecture; Tessera rides on it as the default dark skin, so this directive formalizes an existing alignment.
3. **Login freeze**: *"I liked login screen UI — keep it like that; freeze it until I explicitly say so to change it."* The Tessera AuthScreen (shipped v2.6.0, polished through v2.6.4 at commit `5f38efc`) is approved as-is and must not change.

There is a deliberate tension between (1) and (3): the illustrations are the **future** plan for login, but the freeze takes precedence — no change (including wiring in illustrations) happens until the owner explicitly unfreezes.

## Decision

1. **DESIGN FREEZE — Login screen**: `src/components/auth/AuthScreen.tsx` and its directly-coupled auth-surface assets are **frozen at the v2.6.4 state (commit `5f38efc`)**. No visual, structural, or copy modifications by any agent or contributor without an explicit, recorded owner instruction ("unfreeze login" or equivalent).
2. **Designated future login direction**: when the freeze is lifted, the login surface incorporates illustrations from the Surface Pack (see *Asset Pipeline* below), keeping the approved Tessera layout/style language intact.
3. **Post-login surfaces** continue the Tessera redesign loop with component anatomy aligned to shadcn/ui conventions (tokens via CSS variables, `Button`/`Card`/`Input`/`Dialog` patterns, dark-light theming). Completed so far: Header, WebNavbar, POS menu + cart, KDS, Payment/Variant modals, OrdersScreen. Remaining: SuperAdmin, Storefront/OrderTracking, Customers, Inventory, Menu, Tables, Offers, Shifts, Settings, PrintLogsSection.

## Asset Pipeline (for when the freeze is lifted)

- The sandbox is **CloudFront-blocked from figma.com** (HTTP 403; verified 2026-10-01) — assets cannot be pulled programmatically today.
- Path A (preferred): owner exports the chosen illustrations from the Figma Community file as **SVG** (crisp at any size, recolorable) or 2x **PNG**, and drops them into `src/assets/illustrations/` (or hands them to an agent session).
- Path B: owner shares a non-Figma mirror URL (unpkg/GitHub/Drive) reachable from the sandbox.
- Wiring plan: AuthScreen's left brand panel receives the illustration as a Tessera-tinted decorative layer (existing split layout untouched).

## Alternatives Rejected

- **Wire the illustrations in now**: violates the explicit freeze; the owner liked the login screen as-is.
- **Redesign login with the shadcn reference too**: the owner scoped the shadcn reference to *post-login* surfaces only.
- **Invent equivalent illustrations via image generation**: not the pack the owner specified; licensing and style mismatch.

## Consequences

- ✅ Owner's approved login UI is stable and reproducible (pinned to commit `5f38efc` in this ADR).
- ✅ Clear governance: automated redesign passes must skip `AuthScreen.tsx`; CI/review can flag any diff to it.
- ✅ shadcn alignment for post-login surfaces keeps the component library portable and the theme engine (ADR-0004) untouched.
- ⚠️ Login stays illustration-free until the owner unfreezes and assets are provided (sandbox cannot fetch Figma).
- ⚠️ Any hotfix that must touch `AuthScreen.tsx` (e.g., a crash) is allowed, but must not alter visuals and must be called out in the worklog.
