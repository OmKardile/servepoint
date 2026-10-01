# ADR 0006: Real-Time WebSockets & Selective Architectural Migration

- **Status**: Accepted
- **Date**: 2026-09-25
- **Deciders**: Principal Full-Stack Software Engineer & Architecture Auditor

---

## Context
Following a comparative audit against the reference repository (`tsos-alternate`), TSOS lacked dynamic zero-reload KDS bumps and live table updates across multi-device floor operations. Kitchen staff had to periodically refresh the board, and cashier shift handovers on touchscreen tablets were slow due to manual multi-field forms.

## Decision
1. **Real-Time Supabase WebSocket Layer**:
   - Implemented `realtimeService.subscribeToTenantRealtime` using Supabase Realtime Channels.
   - Bound incoming `INSERT` and `UPDATE` events on `orders` and `dining_tables` directly to Zustand state handlers (`handleInboundOrder`, `handleInboundOrderStatus`, `handleInboundTableStatus`).
   - Trigger zero-dependency Web Audio synthesised chimes (`playChime('new_order')`) on kitchen and cashier terminals.
2. **Offline-First Synchronization Engine**:
   - Integrated `tsos_pending_offline_orders` queue in localStorage.
   - Added automatic synchronization on browser `'online'` event listeners, guaranteeing zero lost orders during transient internet outages.
3. **Hardware Downloads Hub**:
   - Created `HardwareDownloadsModal` accessible from Header and Settings, exposing direct download links for the Windows Desktop POS (.exe), Android Tablet APK, and ESC/POS thermal printer guidelines.
4. **Fast Touchscreen PIN Clock-In Modal**:
   - Integrated `StaffPinPadModal` with a 4-digit keypad for rapid shift clock-ins during peak service hours.
5. **Preserved Local Strengths**:
   - Kept local codebase's full-system Obsidian Dark Terminal Mode (`#0C0A09`), multi-tenant schema with 24 tables, and custom split billing calculations.

## Consequences
- **Positive**: KDS and POS terminals now operate in live synchronized lockstep with zero reloads; cashiers can switch shifts in seconds; offline resiliency prevents lost revenue during network disruptions.
- **Negative**: Requires maintaining active WebSocket subscriptions per tenant session; handled gracefully with automatic cleanup on component unmount and fallback to optimistic local state.
