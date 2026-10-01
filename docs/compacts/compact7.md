# TSOS Compact 7 — Hardware Hub Purge, Native App Freeze for Electron & Pure Browser QR Architecture

- **Date**: 2026-09-25
- **Phase**: Architecture Streamlining & Strategic Hardware Pivot
- **Workspace**: `d:\work\megatech\mega-tsos`
- **Status**: Completed & Verified Clean (`npx tsc --noEmit` & `npm run build` passing 0 errors)

---

## 1. Executive Summary

Executed the strategic directive to eliminate native download friction:
1. **Purged TSOS Hardware Hub & Native Client Downloads**: Completely removed `HardwareDownloadsModal.tsx`, Settings card, Header profile menu button, and `/hardware` route.
2. **Frozen Native Windows App in Favor of Electron**: The standalone C# / WPF desktop client is officially frozen. Desktop strategy is now consolidated around **Electron.js** wrapping the unified Web POS codebase.
3. **Cancelled Native Customer Mobile App**: Deleted standalone mobile APK showcase. Customers order with zero-install frictionless flow: scan physical QR sticker with smartphone camera $\rightarrow$ browser immediately opens `/:slug/t:tableNumber?token=:token` $\rightarrow$ cryptographically signed 10-minute time-bound session.

---

## 2. Codebase Refactoring Ledger

| File | Changes Made |
|---|---|
| `src/components/common/HardwareDownloadsModal.tsx` | **Deleted completely**. |
| `src/components/native/AndroidAppClient.tsx` | **Deleted completely**. |
| `src/components/native/WindowsAppClient.tsx` | Added top architecture deprecation banner marking WPF client **[FROZEN]** in favor of Electron. |
| `src/App.tsx` | Removed `HardwareDownloadsModal` import, state, `/hardware` route, and modal JSX mounts. |
| `src/components/common/Header.tsx` | Removed `onOpenHardwareDownloads` prop and profile dropdown menu button. |
| `src/components/settings/SettingsScreen.tsx` | Removed Hardware Hub card, header download button, and modal JSX mount. |
| `docs/decisions/0007-remove-hardware-hub-and-cancel-native-apps.md` | Recorded ADR 0007. |

---

## 3. Verification & Build Health

- **TypeScript Compilation**: `npx tsc --noEmit` $\rightarrow$ 0 errors.
- **Vite Production Build**: `npm run build` $\rightarrow$ Completed in 10.85s (dist bundle 627 kB).
- **Git Commit**: Staged and committed clean changes.
