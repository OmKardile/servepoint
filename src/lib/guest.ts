import { supabase } from './supabase';

/**
 * Guest QR data layer (v5.3.0) — the no-login side of the main flow.
 *
 * Capabilities, not accounts:
 *   - the table's PERMANENT qr_token (printed on the sticker) opens the door;
 *   - the ephemeral 10-min session token (002) keeps an order window alive;
 *   - the order UUID doubles as the tracking pager link.
 * Every call goes through a SECURITY DEFINER RPC (migration 012) — the anon
 * key can read zero rows directly. Guests never pay online: tickets land as
 * `new` and the counter records the money (the counter is the gate).
 */

/* ── payload types (mirrors of the RPC jsonb shapes) ─────────────────────── */

export interface GuestTenantInfo {
  id: string;
  name: string;
  slug: string;
  /** Owner-set café logo (migration 024) — NULL/absent renders the text-only hero. */
  logo_url?: string | null;
}

export interface GuestVariant {
  id: string;
  name: string;
  price_delta: number;
}

export interface GuestAddon {
  id: string;
  name: string;
  price: number;
}

export interface GuestMenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_veg: boolean;
  variants: GuestVariant[];
  addons: GuestAddon[];
}

export interface GuestCategory {
  id: string;
  name: string;
  sort_order: number;
  items: GuestMenuItem[];
}

export interface PublicMenu {
  is_valid: boolean;
  error?: string;
  message?: string;
  tenant?: GuestTenantInfo;
  categories?: GuestCategory[];
}

/** Active offers for the guest menu banner (migration 016, read-only RPC). */
export interface PublicOffer {
  id: string;
  title: string;
  description: string | null;
  discount_type: 'percent' | 'flat';
  discount_value: number;
  min_order_amount: number;
}

export interface PublicOffers {
  is_valid: boolean;
  offers: PublicOffer[];
}

export interface ResolvedTable {
  is_valid: boolean;
  error?: string;
  message?: string;
  tenant?: GuestTenantInfo;
  table?: {
    id: string;
    table_number: string;
    capacity: number;
    section: string;
  };
}

export interface TableSession {
  session_token: string;
  expires_at: string;
  expires_in_seconds: number;
}

export interface GuestOrderPayload {
  menu_item_id: string;
  variant_id?: string | null;
  qty: number;
  notes?: string | null;
  addon_ids?: string[];
}

export interface GuestOrderSummary {
  id: string;
  order_number: number;
  order_type: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  subtotal: number;
  discount_amount: number;
  offer_title: string | null;
  tax_amount: number;
  total: number;
  customer_name: string | null;
  notes: string | null;
  table_number: string | null;
  created_at: string;
  updated_at: string;
  /** 1–5 once the guest has rated this order (019), null before — server truth. */
  feedback_rating: number | null;
  items: {
    name: string;
    variant_name: string | null;
    qty: number;
    unit_price: number;
    item_total: number;
    notes: string | null;
    addons: { name: string; price: number }[];
  }[];
}

/* ── sessionStorage keys (identity only — never prices) ──────────────────── */

const RESOLVE_KEY = (token: string) => `sp.guest.resolve.${token}`;
const SESSION_KEY = (token: string) => `sp.guest.session.${token}`;

function cacheJson(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / quota — cache is a convenience, never correctness */
  }
}

function readJson<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/* ── RPC wrappers ────────────────────────────────────────────────────────── */

/** QR gate: turn the printed token into tenant + table identity (cached). */
export async function resolveTableQr(qrToken: string): Promise<ResolvedTable> {
  const cached = readJson<ResolvedTable>(RESOLVE_KEY(qrToken));
  if (cached?.is_valid) return cached;
  const { data, error } = await supabase.rpc('sp_resolve_table_qr', {
    p_qr_token: qrToken,
  });
  if (error) {
    return { is_valid: false, error: 'NETWORK', message: 'Could not reach the cafe. Check your connection and try again.' };
  }
  const resolved = data as ResolvedTable;
  if (resolved?.is_valid) cacheJson(RESOLVE_KEY(qrToken), resolved);
  return resolved;
}

/**
 * Open (or reuse) the table's ephemeral session via 002's RPC. The RPC also
 * flips the table to occupied — a seated guest is a busy table even before
 * the first order.
 *
 * v5.26.0 — ONE SCAN, ONE WINDOW: the gate's effect can legally fire twice
 * (StrictMode remount, language-context identity churn) and both invocations
 * used to hit `issue_ephemeral_table_session`, leaving two live windows from
 * a single scan (seen live: two rows created 12ms apart on one visit). An
 * in-flight promise per token makes the second call ride the first; it is
 * removed the moment the RPC settles, so a later RE-scan still opens a
 * genuinely fresh window.
 */
const inflightOpens = new Map<string, Promise<{ ok: boolean; session?: TableSession; message?: string }>>();

export function openTableSession(input: {
  slug: string;
  tableNumber: string;
  qrToken: string;
}): Promise<{ ok: boolean; session?: TableSession; message?: string }> {
  const cached = readJson<{ session: TableSession; resolvedAt: number }>(SESSION_KEY(input.qrToken));
  if (cached && Date.now() - cached.resolvedAt < 8 * 60 * 1000) {
    // reuse within 8 minutes — the RPC itself refuses dead sessions server-side
    const stillValid = new Date(cached.session.expires_at).getTime() - Date.now() > 30 * 1000;
    if (stillValid) return Promise.resolve({ ok: true, session: cached.session });
    sessionStorage.removeItem(SESSION_KEY(input.qrToken));
  }

  const existing = inflightOpens.get(input.qrToken);
  if (existing) return existing;

  const open = (async (): Promise<{ ok: boolean; session?: TableSession; message?: string }> => {
    const { data, error } = await supabase.rpc('issue_ephemeral_table_session', {
      p_tenant_slug: input.slug,
      p_table_number: input.tableNumber,
      p_permanent_token: input.qrToken,
    });
    if (error) {
      return { ok: false, message: 'Could not open this table. Scan the QR sticker again.' };
    }
    const res = data as { is_valid: boolean; session_token?: string; expires_at?: string; message?: string; expires_in_seconds?: number };
    if (!res?.is_valid || !res.session_token || !res.expires_at) {
      return { ok: false, message: res?.message || 'This table could not be opened. Ask our staff for help.' };
    }
    const session: TableSession = {
      session_token: res.session_token,
      expires_at: res.expires_at,
      expires_in_seconds: res.expires_in_seconds ?? 600,
    };
    cacheJson(SESSION_KEY(input.qrToken), { session, resolvedAt: Date.now() });
    return { ok: true, session };
  })();

  inflightOpens.set(input.qrToken, open);
  void open.finally(() => inflightOpens.delete(input.qrToken));
  return open;
}

/**
 * Ribbon re-verify (v5.24.0, migration 023): the guest's phone polls its own
 * session every 30s. The server — not the client clock — decides whether the
 * window is still open, so a STAFF CUT locks the menu within one tick. A
 * natural expiry converges the stored status the same way.
 */
export async function verifyTableSession(sessionToken: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    const { data, error } = await supabase.rpc('sp_verify_table_session', { p_session_token: sessionToken });
    if (error) return { ok: true, reason: 'network' }; // fail-soft: retry on the next tick
    const res = data as { is_valid: boolean; reason?: string };
    return res?.is_valid ? { ok: true } : { ok: false, reason: res.reason || 'unknown' };
  } catch {
    return { ok: true, reason: 'network' }; // a network hiccup never locks a paying guest
  }
}

/** Drop the cached ephemeral session (staff cut / SESSION_CLOSED paths) so a
 *  rescan re-issues a fresh window instead of reusing a dead token. */
export function clearCachedSession(qrToken: string): void {
  try {
    sessionStorage.removeItem(SESSION_KEY(qrToken));
  } catch {
    /* private mode — nothing to clear */
  }
}

/** Live menu bundle (available items only, server-side). */
export async function fetchPublicMenu(slug: string): Promise<PublicMenu> {
  const { data, error } = await supabase.rpc('sp_get_public_menu', { p_slug: slug });
  if (error) {
    return { is_valid: false, error: 'NETWORK', message: 'Could not load the menu. Check your connection and try again.' };
  }
  return data as PublicMenu;
}

/** Active offers for the banner — a failed fetch just hides the banner, never blocks the menu. */
export async function fetchPublicOffers(slug: string): Promise<PublicOffer[]> {
  try {
    const { data, error } = await supabase.rpc('sp_public_offers', { p_slug: slug });
    if (error || !data?.is_valid) return [];
    return (data.offers || []) as PublicOffer[];
  } catch {
    return [];
  }
}

/**
 * Place the order. Prices are computed server-side; the payload carries
 * identity only. `clientOperationId` makes retries safe — same intent,
 * same ticket, never a double order.
 */
export async function createPublicOrder(input: {
  qrToken: string;
  tableNumber?: string;
  items: GuestOrderPayload[];
  customerName?: string | null;
  notes?: string | null;
  clientOperationId: string;
  offerId?: string | null;
  /** v5.24.0 (migration 023): when presented, the ephemeral session must be
   *  alive — a staff-cut token comes back SESSION_CLOSED, never silently
   *  ignored. Omitted/NULL keeps the printed-QR-only path for other callers. */
  sessionToken?: string | null;
}): Promise<{
  is_valid: boolean;
  duplicate?: boolean;
  error?: string;
  reason?: string;
  message?: string;
  order?: { id: string; order_number: number; total: number; discount_amount?: number; offer_title?: string | null; status: string; payment_status: string; table_number?: string };
}> {
  const { data, error } = await supabase.rpc('sp_create_public_order', {
    p_qr_token: input.qrToken,
    p_table_number: input.tableNumber ?? null,
    p_items: input.items,
    p_order_type: 'dine_in',
    p_customer_name: input.customerName ?? null,
    p_notes: input.notes ?? null,
    p_client_operation_id: input.clientOperationId,
    p_offer_id: input.offerId ?? null,
    p_session_token: input.sessionToken ?? null,
  });
  if (error) {
    return { is_valid: false, error: 'NETWORK', message: 'The order did not go through. Check your connection and try again.' };
  }
  return data as {
    is_valid: boolean;
    duplicate?: boolean;
    error?: string;
    reason?: string;
    message?: string;
    order?: { id: string; order_number: number; total: number; status: string; payment_status: string; table_number?: string };
  };
}

/** Tracking pager projection — safe to poll every 10s from a no-login phone. */
export async function fetchPublicOrder(orderId: string): Promise<{
  is_valid: boolean;
  error?: string;
  message?: string;
  order?: GuestOrderSummary;
}> {
  const { data, error } = await supabase.rpc('sp_get_public_order', { p_order_id: orderId });
  if (error) {
    return { is_valid: false, error: 'NETWORK', message: 'Could not reach the cafe. Retrying…' };
  }
  return data as { is_valid: boolean; error?: string; message?: string; order?: GuestOrderSummary };
}

/* ── feedback (migration 019) ──────────────────────────────────────────────── */

/**
 * Rate a served order. The order UUID doubles as the capability (same trust
 * model as the track page itself): exactly one rating per order, ever — the
 * server answers ALREADY on replays and the UNIQUE(order_id) constraint is
 * the hard guard. A failed network call surfaces as NOT_VALID; the guest can
 * retry and the server's replay guard keeps it honest.
 */
export async function submitPublicFeedback(
  orderId: string,
  rating: number,
  comment?: string | null,
): Promise<{ is_valid: boolean; error?: string; message?: string; rating?: number }> {
  try {
    const { data, error } = await supabase.rpc('sp_submit_public_feedback', {
      p_order_id: orderId,
      p_rating: rating,
      p_comment: comment ?? null,
    });
    if (error) {
      return { is_valid: false, error: 'NETWORK', message: 'Could not send your rating. Try again.' };
    }
    return data as { is_valid: boolean; error?: string; message?: string; rating?: number };
  } catch {
    return { is_valid: false, error: 'NETWORK', message: 'Could not send your rating. Try again.' };
  }
}
