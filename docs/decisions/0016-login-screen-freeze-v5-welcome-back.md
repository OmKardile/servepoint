# ADR 0016 — Login Screen Freeze (v5 Welcome_Back Design)

- **Status**: Accepted
- **Date**: 2026-10-01
- **Deciders**: Omkar Kardile (owner), directive issued 2026-10-01 ("pls dont change the login page")
- **Tags**: `design`, `governance`, `auth`, `design-system`
- **Supersedes**: the freeze in [ADR 0010](0010-login-screen-design-freeze-and-design-system-directives.md) (which pinned the retired v4 Tessera AuthScreen at commit `5f38efc`)

## Context

ADR-0010 froze the v4 Tessera login screen. The v5.0.0 production rebuild mandate
(ADR-0014 — "redesign each and every component according to the Figma") superseded
that design, and the rebuild pass missed `AuthScreen.tsx`, leaving it on deleted
`tessera-*` CSS classes — the primary **Sign in button rendered invisible** (no
background, inherited near-black text on the near-black card). The owner reported it
("u deleted the damn log in button on screen").

In response, the screen was rebuilt in Task 27 to the archived ServePoint Figma frame
`docs/design/servepoint/frames/Welcome_Back_219-30095.png` (split layout: white
illustration panel with caption carousel + sage sign-in panel with gold `sp-cta`
button and password eye toggle) and shipped at commit `a6fd120` with browser-verified
sign-in. The owner then directed: **"pls dont change the login page."**

## Decision

1. **DESIGN FREEZE — Login screen (v5)**: `src/components/auth/AuthScreen.tsx` and
   its directly-coupled assets (`src/assets/login-illustration.png`,
   `src/vite-env.d.ts` for the asset import) are **frozen at commit `a6fd120`**.
   No visual, structural, or copy modifications by any agent or contributor without
   an explicit, recorded owner instruction ("unfreeze login" or equivalent).
2. **Automated passes must skip the auth surface**: cron/agent rounds, restyling
   sweeps, and feature work treat the auth surface as read-only. Review should flag
   any diff to these paths.
3. **Carve-out (unchanged from ADR-0010)**: a hotfix that must touch the auth surface
   (e.g., a crash, a breaking dependency) is allowed, but must not alter visuals and
   must be called out explicitly in the worklog.

## Alternatives Rejected

- **Re-freeze the old Tessera design**: it was already retired by the owner's v5.0.0
  mandate; the Tessera screen no longer exists in the tree.
- **Only record the directive in the worklog**: worklog is the handover channel, but
  a freeze that governs all future agents belongs in the decision record with a
  pinned commit, like ADR-0010 before it.
- **Add a "frozen" comment header to AuthScreen.tsx**: rejected — the owner said not
  to change the login page, so the file is left byte-identical; governance lives
  here and in the worklog instead.

## Consequences

- ✅ The login screen the owner just approved is stable and reproducible (pinned to
  commit `a6fd120`), matching the `Welcome_Back_219-30095` frame.
- ✅ Clear governance: every future round reads the worklog/ADRs first and skips the
  auth surface; any diff to the frozen paths is an explicit, reviewable event.
- ⚠️ Login-surface improvements (e.g., "Forgot password?" flow, social login) remain
  blocked until the owner explicitly unfreezes.
- ℹ️ ADR-0010's Surface-Pack illustration pipeline is moot for now — the frozen v5
  screen already carries a palette-matched illustration; if the owner ever wants the
  Surface Pack art instead, unfreeze first, then swap the asset.
