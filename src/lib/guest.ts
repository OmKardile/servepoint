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
  /** Legal identity (migration 037) — the licence line in the guest footer.
   *  All optional: an owner who never filled Business profile sends NULLs
   *  and the footer simply doesn't render a licence line (honest absence). */
  legal_name?: string | null;
  gst_number?: string | null;
  fssai_number?: string | null;
}

/** The café brand a guest sees on their ticket page (migration 025): name on
 *  every order, logo tile only when the owner set one. Name is nullable in
 *  the payload for NULL-safety (an order always has a tenant row, but the
 *  LEFT JOIN keeps the projection never-failing). */
export interface GuestTenantBrand {
  name: string | null;
  logo_url: string | null;
  /** Migration 037 — same legal trio as the menu payload. */
  legal_name?: string | null;
  gst_number?: string | null;
  fssai_number?: string | null;
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

/* ── the ticket remembers the order (v5.269.0) ─────────────────────────────
 * A completed ticket's plates were display words only — no item ids in the
 * payload (sp_get_public_order predates any reorder idea) — so the reorder
 * cannot write cart lines directly. It doesn't have to: the cart's own law
 * (289's kept cart, identity only, the server re-prices everything) already
 * says the menu page is where prices live. So the ticket leaves a NAME
 * MANIFEST for the next menu page with the same session token, and the menu
 * — the only holder of live items — does the mapping: every plate matched
 * against TODAY's menu, priced at TODAY's numbers, or honestly dropped and
 * counted. The manifest carries names, counts and the guest's own words —
 * never prices (the section's law above), so a stale manifest can lie about
 * nothing. Read-once by construction: takeReorderPayload clears the key the
 * moment it reads it, so a reload can never double-add the plates. */
export interface ReorderLine {
  name: string;
  variantName: string | null;
  addonNames: string[];
  qty: number;
  notes: string | null;
}

export interface ReorderPayload {
  orderNumber: number;
  placedAt: string;
  lines: ReorderLine[];
}

const REORDER_KEY = (token: string) => `sp.guest.reorder.${token}`;

export function writeReorderPayload(token: string, order: GuestOrderSummary): void {
  const payload: ReorderPayload = {
    orderNumber: order.order_number,
    placedAt: order.created_at,
    lines: order.items.map((it) => ({
      name: it.name,
      variantName: it.variant_name,
      addonNames: it.addons.map((a) => a.name),
      qty: it.qty,
      notes: it.notes,
    })),
  };
  cacheJson(REORDER_KEY(token), payload);
}

/** Read-once: the manifest is consumed the moment the menu sees it. */
export function takeReorderPayload(token: string): ReorderPayload | null {
  try {
    const raw = sessionStorage.getItem(REORDER_KEY(token));
    if (!raw) return null;
    sessionStorage.removeItem(REORDER_KEY(token));
    const parsed = JSON.parse(raw) as ReorderPayload;
    return parsed && Array.isArray(parsed.lines) && parsed.lines.length > 0 ? parsed : null;
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
      /* v5.268.0 — the wire-fail word stops blaming the sticker: a supabase
       * error here is the WIRE (network blip or a momentary 5xx), not a bad
       * QR — rescanning was never the move, retrying is. The session card
       * this message lands in already wears the retry door (5.249's busy
       * voice), so the word and the door finally agree. */
      return { ok: false, message: 'Could not open this table right now — try again in a moment.' };
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
 *
 * 5.216.0 — the tick also carries the window's OWN number home: 023's RPC has
 * always answered live sessions with `remaining_seconds` (the SERVER's
 * arithmetic, read from the same clock that decides the lock), and every
 * release before this one discarded it — the ribbon counted on the phone's
 * clock alone, so a drifting phone could promise a window the server
 * disagrees with. The field threads through here as `remainingSeconds`;
 * the fail-soft branches return WITHOUT it so the caller knows to keep
 * interpolating from its last anchor instead of mistaking silence for zero.
 */
export async function verifyTableSession(
  sessionToken: string,
): Promise<{ ok: boolean; reason?: string; remainingSeconds?: number }> {
  try {
    const { data, error } = await supabase.rpc('sp_verify_table_session', { p_session_token: sessionToken });
    if (error) return { ok: true, reason: 'network' }; // fail-soft: retry on the next tick
    const res = data as { is_valid: boolean; reason?: string; remaining_seconds?: number };
    if (!res?.is_valid) return { ok: false, reason: res.reason || 'unknown' };
    // Number(undefined) is NaN — the finite gate below covers the absent field too
    const remaining = Number(res.remaining_seconds);
    return Number.isFinite(remaining)
      ? { ok: true, remainingSeconds: Math.max(0, Math.floor(remaining)) }
      : { ok: true };
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

/* ── v5.301.0 — the table's live tickets ───────────────────────────────────
 * A table QR seat is SHARED — family-style dining means the table's tickets
 * belong to more than one phone. Until now the menu only remembered the
 * guest's OWN last ticket (5.253.0, per-tab), so a tablemate ordering a
 * second round never saw the round already flying in the kitchen. The
 * panel reads the TABLE's open tickets (orders carry table_id since 001)
 * — the respectful slice only: ticket number, kitchen state, item count,
 * total. Never a name, never a note — the sibling's words stay theirs.
 * The liveness law: open kitchen statuses only, the last 12 hours (a
 * zombie 'new' from a dead shift never lingers), newest first, six at
 * most — a panel, not a ledger. Fail-soft at the offers banner's own
 * law: a failed fetch is simply no panel — the menu never blocks on a
 * nicety. */
export interface TableLiveTicket {
  id: string;
  order_number: number;
  status: string;
  total: number;
  items_count: number;
  created_at: string;
}

export async function fetchTableLiveTickets(tableId: string): Promise<TableLiveTicket[]> {
  try {
    const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('orders')
      .select('id, order_number, status, total, created_at, order_items(qty)')
      .eq('table_id', tableId)
      .in('status', ['new', 'pending', 'preparing', 'ready'])
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(6);
    if (error || !data) return [];
    return data.map((row) => ({
      id: row.id,
      order_number: row.order_number,
      status: row.status,
      total: Number(row.total),
      /* the PIECES ride the embedded rows — one read, no N+1. A line's qty
       * is what the guest calls "items": 2 sandwiches is 2 items, never 1
       * line wearing the word. */
      items_count: Array.isArray(row.order_items)
        ? row.order_items.reduce((s, li) => s + (Number(li?.qty) || 0), 0)
        : 0,
      created_at: row.created_at,
    }));
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

/** Tracking pager projection — safe to poll every 10s from a no-login phone.
 *  v5.28.0: the payload also carries the café's brand ({name, logo_url},
 *  migration 025) so the ticket page can say whose ticket it is. */
export async function fetchPublicOrder(orderId: string): Promise<{
  is_valid: boolean;
  error?: string;
  message?: string;
  order?: GuestOrderSummary;
  tenant?: GuestTenantBrand;
}> {
  const { data, error } = await supabase.rpc('sp_get_public_order', { p_order_id: orderId });
  if (error) {
    return { is_valid: false, error: 'NETWORK', message: 'Could not reach the cafe. Retrying…' };
  }
  return data as {
    is_valid: boolean;
    error?: string;
    message?: string;
    order?: GuestOrderSummary;
    tenant?: GuestTenantBrand;
  };
}

/* ── the ticket's clock (5.248.0) ────────────────────────────────────────────
 * The guest's one question is "how long has this been going?" — the RPC has
 * handed the answer since 025 (created_at rides the payload; the summary
 * type carried it), but the pager never spoke it. Two pure words, derived at
 * the render boundary (the drawer-card law 5.179, the audit pair 5.246 — now
 * in the guest's hand): every 10-second tick re-renders the pill, so the age
 * is re-derived from the clock given, never stored.
 *
 *   · THE STAMP — the café's own wall clock, spoken in the reporting zone
 *     the caller names (the drawer doctrine: a guest abroad reads the café's
 *     clock, not their phone's). Today bare "14:17" (today needs no
 *     introduction — the day grammar's first law), any older day the
 *     calendar "5 Oct · 14:17" (en-IN short month, the ledger's voice; the
 *     guest pager is a days-later artifact more often than a strip row, so
 *     the calendar speaks even for yesterday — no borrowed English word
 *     inside a Hindi/Kannada sentence), an unreadable stamp "—" — never a
 *     fake time.
 *
 *   · THE AGE — "just now" under a minute, whole minutes to the hour, then
 *     hours and minutes, and past a full day the day-granularity word (the
 *     honest ceiling: a re-opened link is not "54 h ago"). A NEGATIVE age
 *     (a future-dated corrupt row) is UNSPEAKABLE: null, the caller omits
 *     the age word and the stamp alone speaks the stored fact — the census
 *     does not forgive corruption (5.243's law), and the pager does not
 *     invent a clock either.
 */

export function ticketPlacedStamp(placedIso: string, tz: string, nowMs: number = Date.now()): string {
  const d = new Date(placedIso);
  if (Number.isNaN(d.getTime())) return '—';
  const dayKey = (ms: number): string =>
    new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: tz }).format(ms);
  const clock = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(d);
  if (dayKey(d.getTime()) === dayKey(nowMs)) return clock;
  const cal = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: tz }).format(d);
  return `${cal} · ${clock}`;
}

export type TicketAge =
  | { kind: 'now' }
  | { kind: 'min'; n: number }
  | { kind: 'hours'; h: number; m: number }
  | { kind: 'days'; d: number }
  | null; // null — an unreadable or future-dated stamp: no age is speakable

export function ticketAge(placedIso: string, nowMs: number = Date.now()): TicketAge {
  const d = new Date(placedIso);
  if (Number.isNaN(d.getTime())) return null;
  const s = Math.floor((nowMs - d.getTime()) / 1000);
  if (s < 0) return null;
  if (s < 60) return { kind: 'now' };
  const m = Math.floor(s / 60);
  if (m < 60) return { kind: 'min', n: m };
  const h = Math.floor(m / 60);
  if (h < 24) return { kind: 'hours', h, m: m % 60 };
  return { kind: 'days', d: Math.floor(h / 24) }; // day granularity is the honest ceiling — a re-opened link is not "54 h ago"
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
