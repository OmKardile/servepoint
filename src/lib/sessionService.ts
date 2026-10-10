/**
 * TSOS Ephemeral Table QR Session Security Service
 * 
 * Implements 10-Minute Ephemeral Session Tokens to prevent diners from placing
 * unauthorized or accidental orders from mobile history, bookmarks, or outside the cafe.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { DineTable } from '../types';

export interface EphemeralSessionPayload {
  sessionId: string;
  tableId: string;
  tableNumber: string;
  tenantSlug: string;
  tenantId?: string;
  issuedAt: number; // Unix ms
  expiresAt: number; // Unix ms (issuedAt + 10 mins)
}

export interface EphemeralSessionResult {
  isValid: boolean;
  sessionToken?: string;
  sessionId?: string;
  expiresAt?: string;
  remainingSeconds?: number;
  table?: {
    id: string;
    table_number: string;
    location_id?: string;
    capacity?: number;
    status?: string;
  };
  tenant?: {
    id: string;
    name: string;
    slug: string;
    upi_id?: string;
  };
  error?: string;
  message?: string;
}

const SESSION_SALT = 'tsos_ephemeral_qr_salt_2026';
const EPHEMERAL_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Encodes string to base64url safely in browser & node
 */
function base64UrlEncode(str: string): string {
  if (typeof btoa !== 'undefined') {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  return Buffer.from(str).toString('base64url');
}

/**
 * Decodes base64url string
 */
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  if (typeof atob !== 'undefined') {
    return atob(base64);
  }
  return Buffer.from(base64, 'base64').toString();
}

/**
 * Computes HMAC-SHA256 signature using Web Crypto API
 */
async function computeHmacSha256(keyString: string, message: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(keyString);
    const msgData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback lightweight hash for non-crypto environments
  let hash = 0;
  const combined = keyString + ':' + message;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash << 5) - hash + combined.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

export const sessionService = {
  /**
   * Generates local storage cache key for table session
   */
  getStorageKey(tenantSlug: string, tableNumber: string): string {
    const cleanNum = tableNumber.replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
    return `tsos_session_${tenantSlug.toLowerCase()}_${cleanNum}`;
  },

  /**
   * Issue a short-lived 10-minute session token upon scanning physical table QR
   */
  async issueEphemeralSession(
    tenantSlug: string,
    tableNumber: string,
    permanentQrToken: string,
    fallbackTable?: DineTable
  ): Promise<EphemeralSessionResult> {
    const cleanSlug = tenantSlug.toLowerCase().trim();
    const cleanToken = permanentQrToken.trim();
    // v2.8.1 — remembered RPC rejection so the offline fallback can still run
    let rpcRejection: { error: string; message: string } | null = null;

    // 1. Live Supabase Backend RPC Verification
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.rpc('issue_ephemeral_table_session', {
          p_tenant_slug: cleanSlug,
          p_table_number: tableNumber,
          p_permanent_token: cleanToken,
          p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        });

        if (!error && data?.is_valid) {
          const result: EphemeralSessionResult = {
            isValid: true,
            sessionToken: data.session_token,
            sessionId: data.session_id,
            expiresAt: data.expires_at,
            remainingSeconds: data.expires_in_seconds || 600,
            tenant: data.tenant,
            table: data.table,
          };

          this.saveLocalSession(cleanSlug, tableNumber, result);
          return result;
        }

        // v2.8.1 fix: an explicit RPC rejection (unknown tenant, INVALID_PERMANENT_QR,
        // table not found, …) must NOT short-circuit the offline path. We remember
        // the reason and fall through to the local cryptographic fallback below —
        // which itself only mints a session when fallbackTable.qr_token matches the
        // presented token, so a tampered token can never pass. This restores the
        // in-app "Test QR" demo flow (local seed tables: qr-demo-tN) while keeping
        // real sticker deep-links on the live RPC path.
        if (data?.error) {
          rpcRejection = {
            error: data.error,
            message: data.message || 'Table verification failed.',
          };
        }
      } catch (err) {
        console.warn('Supabase issue_ephemeral_table_session failed, falling back to local cryptographic signing:', err);
      }
    }

    // 2. Offline / Edge Cryptographic HMAC-SHA256 Signing
    if (fallbackTable) {
      if (fallbackTable.qr_token !== cleanToken) {
        // Prefer the live RPC's rejection reason when one was recorded; the local
        // mismatch note is the last-resort message.
        if (rpcRejection) {
          return { isValid: false, error: rpcRejection.error, message: rpcRejection.message };
        }
        return {
          isValid: false,
          error: 'INVALID_PERMANENT_QR',
          message: 'Cryptographic token mismatch. Please scan the physical QR sticker at your table.',
        };
      }

      const now = Date.now();
      const expiresAtMs = now + EPHEMERAL_TTL_MS;
      const sessionId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sess_${now}`;

      const payload: EphemeralSessionPayload = {
        sessionId,
        tableId: fallbackTable.id,
        tableNumber: fallbackTable.label,
        tenantSlug: cleanSlug,
        issuedAt: now,
        expiresAt: expiresAtMs,
      };

      const payloadJson = JSON.stringify(payload);
      const payloadB64 = base64UrlEncode(payloadJson);
      const signature = await computeHmacSha256(cleanToken + SESSION_SALT, payloadB64);
      const sessionToken = `v1.${payloadB64}.${signature}`;

      const result: EphemeralSessionResult = {
        isValid: true,
        sessionToken,
        sessionId,
        expiresAt: new Date(expiresAtMs).toISOString(),
        remainingSeconds: 600,
        table: {
          id: fallbackTable.id,
          table_number: fallbackTable.label,
          status: 'occupied',
          capacity: fallbackTable.seats,
        },
        tenant: {
          id: `biz_${cleanSlug}`,
          name: cleanSlug.toUpperCase(),
          slug: cleanSlug,
        },
      };

      this.saveLocalSession(cleanSlug, tableNumber, result);
      return result;
    }

    // v2.8.1 — no local table to fall back on: surface the live rejection when present
    if (rpcRejection) {
      return { isValid: false, error: rpcRejection.error, message: rpcRejection.message };
    }

    return {
      isValid: false,
      error: 'TABLE_NOT_FOUND',
      message: 'Could not find dining table to establish secure ordering session.',
    };
  },

  /**
   * Guard for Order Placement: Validates session token & table status
   */
  async verifyOrderSubmissionSession(
    sessionToken: string | null | undefined,
    tableId: string,
    fallbackTable?: DineTable
  ): Promise<{ isValid: boolean; error?: string; message?: string }> {
    if (!sessionToken || sessionToken.trim() === '') {
      return {
        isValid: false,
        error: 'MISSING_SESSION_TOKEN',
        message: 'Order submission rejected: Missing X-Table-Session-Token header. Please re-scan table QR.',
      };
    }

    // 1. Check Live Database RPC
    // v2.8.1 fix: a LIVE-RPC-issued session token is opaque (not `v1.…` locally
    // signed) and belongs to the LIVE table uuid, so verifying it against the
    // local demo table id always failed with TABLE_MISMATCH and blocked every
    // deep-linked diner order. Opaque tokens are verified by token alone
    // (p_table_id null); locally-signed `v1.` tokens keep the table-bound path
    // and fall through to the local HMAC check on rejection.
    const isLocallySignedToken = sessionToken.startsWith('v1.');
    // v2.8.1 — remembered cloud rejection; the local HMAC verdict is authoritative
    // for `v1.` tokens, and for opaque tokens the cloud verdict is the only one.
    let rpcVerifyRejection: { error: string; message: string } | null = null;
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.rpc('verify_and_consume_table_session', {
          p_session_token: sessionToken,
          p_table_id: isLocallySignedToken ? tableId : null,
        });

        if (!error && data?.is_valid) {
          return { isValid: true };
        }

        // v2.8.1 fix: fall through to the local HMAC verdict instead of
        // short-circuiting — locally-signed `v1.` tokens are unknown to the
        // cloud, so the RPC always rejects them; the offline cryptographic
        // check below is the authoritative verdict for those.
        if (data?.error) {
          rpcVerifyRejection = {
            error: data.error,
            message: data.message || 'Session verification failed.',
          };
        }
      } catch (err) {
        console.warn('Supabase verify_and_consume_table_session failed, running local HMAC check:', err);
      }
    }

    // 2. Offline / Local HMAC Verification
    try {
      const parts = sessionToken.split('.');
      if (parts.length !== 3 || parts[0] !== 'v1') {
        // Opaque live-RPC token that the cloud just rejected — surface the cloud verdict.
        if (rpcVerifyRejection) {
          return { isValid: false, ...rpcVerifyRejection };
        }
        return {
          isValid: false,
          error: 'MALFORMED_TOKEN',
          message: 'Invalid session token signature structure.',
        };
      }

      const [, payloadB64, signature] = parts;
      const payload: EphemeralSessionPayload = JSON.parse(base64UrlDecode(payloadB64));

      // Table ID match check
      if (payload.tableId !== tableId) {
        return {
          isValid: false,
          error: 'TABLE_MISMATCH',
          message: 'Session token table does not match the target dining table.',
        };
      }

      // Expiry check (< 10 minutes)
      const now = Date.now();
      if (now > payload.expiresAt) {
        return {
          isValid: false,
          error: 'SESSION_EXPIRED',
          message: 'Table session expired after 10 minutes. Please re-scan table QR.',
        };
      }

      // HMAC signature validation if table is present
      if (fallbackTable?.qr_token) {
        const expectedSig = await computeHmacSha256(fallbackTable.qr_token + SESSION_SALT, payloadB64);
        if (signature !== expectedSig) {
          return {
            isValid: false,
            error: 'INVALID_SIGNATURE',
            message: 'Session token signature failed cryptographic tamper check.',
          };
        }
      }

      return { isValid: true };
    } catch (err: any) {
      return {
        isValid: false,
        error: 'DECODE_ERROR',
        message: 'Could not verify session integrity: ' + (err.message || 'unknown error'),
      };
    }
  },

  /**
   * Renew an expiring or expired table session with a fresh QR token handshake
   */
  async renewSession(
    tenantSlug: string,
    tableNumber: string,
    permanentQrToken: string,
    currentSessionToken?: string,
    fallbackTable?: DineTable
  ): Promise<EphemeralSessionResult> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.rpc('renew_ephemeral_table_session', {
          p_tenant_slug: tenantSlug.toLowerCase().trim(),
          p_table_number: tableNumber,
          p_permanent_token: permanentQrToken.trim(),
          p_current_session_token: currentSessionToken || null,
        });

        if (!error && data?.is_valid) {
          const result: EphemeralSessionResult = {
            isValid: true,
            sessionToken: data.session_token,
            sessionId: data.session_id,
            expiresAt: data.expires_at,
            remainingSeconds: data.expires_in_seconds || 600,
            tenant: data.tenant,
            table: data.table,
          };
          this.saveLocalSession(tenantSlug, tableNumber, result);
          return result;
        }
      } catch (err) {
        console.warn('renew_ephemeral_table_session RPC failed:', err);
      }
    }

    // Fallback renewal
    return this.issueEphemeralSession(tenantSlug, tableNumber, permanentQrToken, fallbackTable);
  },

  /**
   * Local Cache Helpers
   */
  saveLocalSession(tenantSlug: string, tableNumber: string, session: EphemeralSessionResult) {
    if (typeof window === 'undefined') return;
    try {
      const key = this.getStorageKey(tenantSlug, tableNumber);
      localStorage.setItem(key, JSON.stringify(session));
    } catch {}
  },

  getLocalSession(tenantSlug: string, tableNumber: string): EphemeralSessionResult | null {
    if (typeof window === 'undefined') return null;
    try {
      const key = this.getStorageKey(tenantSlug, tableNumber);
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);

      // Verify expiration
      if (parsed.expiresAt) {
        const expiresAtMs = new Date(parsed.expiresAt).getTime();
        if (Date.now() >= expiresAtMs) {
          return {
            ...parsed,
            isValid: false,
            remainingSeconds: 0,
            error: 'SESSION_EXPIRED',
          };
        }
        parsed.remainingSeconds = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
      }
      return parsed;
    } catch {
      return null;
    }
  },

  clearLocalSession(tenantSlug: string, tableNumber: string) {
    if (typeof window === 'undefined') return;
    try {
      const key = this.getStorageKey(tenantSlug, tableNumber);
      localStorage.removeItem(key);
    } catch {}
  },

  /**
   * Helper to construct X-Table-Session-Token HTTP headers
   */
  getSessionHeaders(sessionToken?: string): Record<string, string> {
    if (!sessionToken) return {};
    return {
      'X-Table-Session-Token': sessionToken,
    };
  },
};
