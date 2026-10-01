# ADR 0005: 10-Minute Ephemeral Table QR Session Security

- **Status**: Accepted
- **Date**: 2026-09-25
- **Deciders**: Lead Full-Stack Security Architect

---

## Context
Diners scan QR codes on physical tables to order food on their smartphones. In static QR systems, the scanned URL stays in mobile history, tabs, or bookmarks. If a diner returns home or to their office and reopens their browser, accidental taps can place orders at the physical restaurant table, confusing kitchen staff and causing food waste.

## Decision
Implement a Dual-Token Ephemeral Session Architecture:
1. **Permanent Physical Secret (`permanentQrToken`)**: Printed on the physical sticker at the table.
2. **Ephemeral Session (`table_sessions`)**: When the physical token is scanned, the server issues a cryptographically signed HMAC-SHA256 session token with `expires_at = now() + INTERVAL '10 minutes'`.
3. **Order Guard (`POST /api/orders`)**: All customer self-orders must submit `X-Table-Session-Token`. Orders are rejected with 401/403 if expired, spoofed, or if the table is already settled.
4. **Client Auto-Lock**: Storefront displays a live countdown timer (`mm:ss`), warns at $\le$ 2 minutes, and locks the screen at 00:00, requiring a physical QR re-scan handshake to renew.
5. **Periodic Cleanup**: Implemented `purge_expired_table_sessions()` to delete sessions older than 24 hours.

## Consequences
- **Positive**: Eliminates remote accidental orders completely; prevents cross-table order injection; provides diners with clear real-time feedback on session validity.
- **Negative**: If a diner spends more than 10 minutes deciding on items without placing an order, their session expires and they must renew via physical re-scan before checking out.
