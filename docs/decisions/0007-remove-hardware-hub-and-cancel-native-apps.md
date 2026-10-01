# ADR 0007: Removal of Hardware Hub, Freezing Windows Native App for Electron, and Frictionless Camera QR Ordering

- **Status**: Accepted
- **Date**: 2026-09-25
- **Deciders**: Lead Product Architect & Platform Engineer

---

## Context
Initial iterations explored separate native binaries (C# / WPF for Windows desktop POS and a Kotlin / Jetpack Compose APK for customer mobile ordering) along with an in-app "Hardware Hub & Downloads Modal".

However, this created operational friction:
1. **Diner Friction**: Expecting customers to install an Android APK at a cafe table is a barrier to conversion. Diners want to sit down, point their smartphone camera at the physical QR sticker, and immediately place their order without app stores or sign-ups.
2. **Desktop Fragmentation**: Maintaining a separate C# / WPF codebase divides engineering resources. The web POS terminal already provides responsive UI, Obsidian dark theme, and offline caching; packaging it into an **Electron.js** shell provides unified cross-platform desktop capabilities (direct USB/COM thermal printing, ESC/POS drawer kick, and full screen lock) with zero code duplication.

## Decision
1. **Total Removal of Hardware Hub & Downloads**:
   - Completely deleted `HardwareDownloadsModal.tsx` and removed all download triggers from `Header.tsx`, `SettingsScreen.tsx`, and `App.tsx`.
2. **Freeze Native Windows WPF Client in Favor of Electron**:
   - The standalone C# / WPF client is declared **FROZEN**.
   - All future desktop POS standalone application development will utilize **Electron.js**, wrapping the unified Web POS codebase to access native OS hardware APIs (WebUSB, WebSerial, ESC/POS thermal printers, and cash drawers).
3. **Cancellation of Native Customer App (Frictionless Web QR)**:
   - Cancelled customer native apps entirely.
   - Customer ordering strategy is 100% focused on zero-install camera QR scanning: phone camera opens `/:slug/t:tableNumber?token=:token` directly in the mobile browser with the 10-minute ephemeral session security guard.

## Consequences
- **Positive**: Eliminates friction for diners; reduces maintenance overhead; guarantees 100% of feature development is shared between web and desktop via Electron; simplifies UI by purging download chrome.
- **Negative**: Windows desktop deployments will rely on Electron runtime instead of native WPF binaries (standard modern POS approach used by Toast, Square, and Shopify POS).
