# TSOS Compact 5 — 10-Minute Ephemeral Table QR Session Security

- **Date**: 2026-09-25
- **Phase**: Security Hardening, Ephemeral Session Tokens, Anti-Tamper Table Ordering
- **Workspace**: `d:\work\megatech\mega-tsos`
- **Migration**: `supabase/migrations/002_ephemeral_table_sessions.sql` / `schema.sql`

---

## 1. Executive Summary

Architected and implemented a cryptographic 10-Minute Ephemeral Table QR Session Token architecture to eliminate unauthorized, remote, or accidental orders placed by diners outside the cafe via mobile browser history or bookmarked URLs.

---

## 2. Threat Analysis & Security Rationale

- **The Problem**: A diner visits `CoolKafe`, scans Table 4's physical QR sticker, orders coffee, pays, and leaves. Two days later, while browsing on their mobile phone, Chrome auto-suggests or reopens the tab. If the diner clicks around or taps "Order Again", an accidental order is routed to Table 4 in the cafe, confusing the kitchen and charging the table.
- **The Solution**: Dual-token isolation. The physical QR code sticker contains a permanent secret. Scanning this secret negotiates a short-lived (10-minute) session token stored in PostgreSQL. All order requests must present this header (`X-Table-Session-Token`). After 10 minutes or upon cashier settlement, the session expires and the client UI locks automatically.

---

## 3. Implementation Components

1. **Database Schema & RPCs (`schema.sql`)**:
   - `table_sessions` table with foreign keys to `dining_tables` and `tenants`.
   - `issue_ephemeral_table_session(p_tenant_slug, p_table_number, p_permanent_token)`: Verifies permanent QR secret, revokes stale sessions, issues 600-second token.
   - `verify_and_consume_table_session(p_session_token, p_table_id)`: Enforces token validity, checks table mismatch, verifies table is not settled.
   - `renew_ephemeral_table_session(p_tenant_slug, p_table_number, p_permanent_token, p_current_token)`: Re-scans physical token for renewal.
   - `purge_expired_table_sessions()`: Cron/maintenance routine purging sessions older than 24 hours.
2. **Security Service (`src/lib/sessionService.ts`)**:
   - Client and server cryptographic verification with Web Crypto API fallback.
   - Generates and signs HMAC-SHA256 tokens.
   - Extracts and formats `X-Table-Session-Token` headers.
3. **React Countdown & Session Hook (`src/hooks/useTableSession.ts`)**:
   - 1-second interval tick calculating remaining seconds.
   - Formats `mm:ss` display.
   - Computes flags: `isExpiringSoon` ($\le$ 120s), `isCritical` ($\le$ 30s), `isExpired` ($\le$ 0s).
   - Manages renewal handshake.
4. **Storefront Screen (`src/components/storefront/StorefrontScreen.tsx`)**:
   - Real-time countdown badge in header.
   - 2-minute warning banner with instant renewal button.
   - Auto-lock overlay when timer reaches zero, blocking item selection and checkout.
   - Pre-order validation interceptor passing session token to order creation.

---

## 4. Test Verification

Executed end-to-end live testing against Supabase:
- Session issuance returns 600s TTL.
- Valid tokens accept order submission.
- Cross-table spoofing is rejected with `TABLE_MISMATCH`.
- Expired tokens return `SESSION_EXPIRED`.
- Renewal handshake re-validates physical token and grants fresh 10-minute lease.
