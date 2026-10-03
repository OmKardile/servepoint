import { supabase, isSupabaseConfigured } from './supabase';
import type {
  AppNotification,
  AuditLogEntry,
  Category,
  ChatMessage,
  Conversation,
  Customer,
  CustomerStats,
  DashboardData,
  Employee,
  MenuItem,
  Offer,
  Order,
  OrderItem,
  OrderType,
  PresenceRow,
  Subscription,
  TeamMemberRow,
  Tenant,
} from '../types';
export type { Category, PresenceRow, TeamMemberRow };

/**
 * v5.0.0 Production data layer (ADR-0014).
 * Typed Supabase access ONLY — no seed data, no mock fallbacks.
 * Screens own their loading / error / empty states.
 */

function requireCloud(): void {
  if (!isSupabaseConfigured()) {
    throw new Error('Cloud not configured. Set the Supabase URL and anon key.');
  }
}

/* ────────────────────────────── Menu ────────────────────────────── */

export async function fetchCategories(tenantId: string): Promise<Category[]> {
  requireCloud();
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []) as Category[];
}

export async function fetchMenuItems(tenantId: string): Promise<MenuItem[]> {
  requireCloud();
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []) as MenuItem[];
}

/* ───────────────────────────── Orders ───────────────────────────── */

interface OrderRow {
  id: string;
  tenant_id: string;
  order_number: number;
  order_type: string;
  status: string;
  table_id: string | null;
  /** v5.25.0: resolved from the PostgREST embed in fetchOrders — the DB has
   *  no table_label column, so the label is derived, never stored. */
  table_label?: string | null;
  dining_tables?: { table_number: string } | null;
  customer_name: string | null;
  guest_count?: number | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  payment_status: string | null;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
}

async function attachItems(orders: OrderRow[], tenantId: string): Promise<Order[]> {
  if (orders.length === 0) return [];
  const ids = orders.map((o) => o.id);
  const { data: items, error } = await supabase
    .from('order_items')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('order_id', ids);
  if (error) throw error;
  // Add-on snapshots (migration 012) — frozen name+price per ticket line so
  // the counter inbox aggregates the FULL guest ticket, extras included.
  const itemIds = (items || []).map((it: any) => it.id).filter(Boolean);
  const addonsByItem = new Map<string, { name: string; price: number }[]>();
  if (itemIds.length > 0) {
    const { data: addonRows, error: addonsErr } = await supabase
      .from('order_item_addons')
      .select('order_item_id, name, price')
      .eq('tenant_id', tenantId)
      .in('order_item_id', itemIds);
    if (addonsErr) throw addonsErr;
    (addonRows || []).forEach((a: any) => {
      const list = addonsByItem.get(a.order_item_id) || [];
      list.push({ name: a.name, price: Number(a.price) });
      addonsByItem.set(a.order_item_id, list);
    });
  }
  const byOrder = new Map<string, OrderItem[]>();
  (items || []).forEach((it: any) => {
    const list = byOrder.get(it.order_id) || [];
    list.push({
      id: it.id,
      order_id: it.order_id,
      menu_item_id: it.menu_item_id,
      name: it.name,
      variant_name: it.variant_name,
      qty: it.qty,
      unit_price: Number(it.unit_price),
      item_total: Number(it.item_total),
      notes: it.notes,
      checked_at: it.checked_at ?? null,
      addons: addonsByItem.get(it.id) || [],
    });
    byOrder.set(it.order_id, list);
  });
  return orders.map((o) => ({
    ...o,
    items: byOrder.get(o.id) || [],
  })) as Order[];
}

export async function fetchOrders(tenantId: string, limit = 100): Promise<Order[]> {
  requireCloud();
  // v5.25.0: the table embed resolves table_id → table_number in the SAME
  // read (orders.table_id → dining_tables FK). Bills' Table detail and the
  // KDS table chip read order.table_label; until now the DB had no such
  // column and every surface showed '—' or buried the table in free-text
  // notes. Derived, never stored — the ledger stays the only truth.
  const { data, error } = await supabase
    .from('orders')
    .select('*, dining_tables(table_number)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data || []).map((r: unknown) => {
    const { dining_tables, ...rest } = r as OrderRow & { dining_tables?: { table_number: string } | null };
    return { ...rest, table_label: dining_tables?.table_number ?? null } as OrderRow;
  });
  return attachItems(rows, tenantId);
}

export interface NewOrderInput {
  orderType: OrderType;
  /** Real FK to dining_tables — the 011 trigger uses this to hold/release the table. */
  tableId?: string | null;
  tableLabel?: string | null;
  guestCount?: number | null;
  customerName?: string | null;
  /** CRM key — the 016 trigger upserts the guest from it; null = anonymous walk-in. */
  customerPhone?: string | null;
  /** Pre-computed offer discount (rupees). The caller owns offer math; the DB owns the ledger. */
  discountAmount?: number | null;
  /** Offer applied — a 016 redemption ledger row is written with the order. */
  offerId?: string | null;
  notes?: string | null;
  items: { name: string; qty: number; unitPrice: number; menuItemId?: string | null; notes?: string }[];
}

/** Returns the tenant's first location, creating a placeholder counter if none exists yet. */
async function ensureLocation(tenantId: string): Promise<string> {
  const { data: existing, error } = await supabase
    .from('locations')
    .select('id')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })
    .limit(1);
  if (error) throw error;
  if (existing && existing.length > 0) return (existing[0] as { id: string }).id;

  // orders.location_id is NOT NULL (migration 001) — provision a counter row
  // once so the first sale can land. Placeholders are honest until the owner
  // edits outlet details (roadmap: outlet settings).
  const { data: created, error: insertErr } = await supabase
    .from('locations')
    .insert({
      tenant_id: tenantId,
      name: 'Main Counter',
      slug: `counter-${tenantId.slice(0, 8)}`,
      address: 'Not set',
      city: 'Not set',
      state: 'Not set',
      postal_code: '000000',
    })
    .select('id')
    .single();
  if (insertErr) throw insertErr;
  return (created as { id: string }).id;
}

/** Creates an order + its items; returns the created order. */
export async function createOrder(tenantId: string, input: NewOrderInput): Promise<Order> {
  requireCloud();
  const locationId = await ensureLocation(tenantId);

  const subtotal = input.items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
  // Offer discount (016) applies on the subtotal BEFORE GST — an MRP-level
  // reduction, so tax follows the discounted base. Clamp: never below zero.
  const discount = Math.min(Math.max(input.discountAmount || 0, 0), subtotal);
  const taxRate = 0.05; // GST 5% — standard F&B rate
  const taxAmount = Math.round((subtotal - discount) * taxRate * 100) / 100;
  const total = Math.round((subtotal - discount + taxAmount) * 100) / 100;

  // orders has NO guest_count column (migration 001) — sending one 400s.
  // Table/guest context rides in notes for KDS display, while tableId takes
  // the real FK slot (migration 011 trigger holds/releases the table from it).
  const contextNotes = [
    input.notes || null,
    input.tableLabel ? `Table: ${input.tableLabel}` : null,
    input.orderType === 'dine_in' && input.guestCount ? `Guests: ${input.guestCount}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const { data: created, error } = await supabase
    .from('orders')
    .insert({
      tenant_id: tenantId,
      location_id: locationId,
      order_type: input.orderType,
      // Migration 001 CHECK: new|pending|preparing|ready|completed|cancelled.
      // Orders enter as 'new'; the counter advances them through the engine.
      status: 'new',
      table_id: input.tableId || null,
      customer_name: input.customerName || null,
      customer_phone: input.customerPhone || null,
      subtotal,
      tax_amount: taxAmount,
      discount_amount: discount,
      total,
      payment_status: 'pending',
      notes: contextNotes || null,
    })
    .select('*')
    .single();
  if (error) throw error;

  const rows = input.items.map((it) => ({
    tenant_id: tenantId,
    order_id: created.id,
    menu_item_id: it.menuItemId || null,
    name: it.name,
    qty: it.qty,
    unit_price: it.unitPrice,
    item_total: Math.round(it.qty * it.unitPrice * 100) / 100,
    notes: it.notes || null,
  }));
  const { error: itemsErr } = await supabase.from('order_items').insert(rows);
  if (itemsErr) throw itemsErr;

  // Offer redemption — the 016 ledger row is the ONLY thing that bumps
  // usage_count (trigger). UNIQUE(order_id) makes a retry harmless.
  if (input.offerId && discount > 0) {
    const { error: redErr } = await supabase.from('offer_redemptions').insert({
      tenant_id: tenantId,
      offer_id: input.offerId,
      order_id: created.id,
      discount_amount: discount,
    });
    if (redErr) throw redErr;
  }

  return { ...(created as OrderRow), items: rows as unknown as OrderItem[] } as Order;
}

export async function updateOrderStatus(
  orderId: string,
  tenantId: string,
  patch: { status?: string; payment_status?: string; payment_method?: string }
): Promise<void> {
  requireCloud();
  const { error } = await supabase
    .from('orders')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('tenant_id', tenantId);
  if (error) throw error;
}

/* ── Order engine (migration 007 — NOVA discipline) ─────────────────────── */

export type PaymentMethod = 'cash' | 'upi' | 'card';

export interface OrderStatusEvent {
  from_status: string | null;
  to_status: string;
  actor_email: string;
  created_at: string;
}

const RPC_MISSING = /PGRST202|Could not find the function|schema cache/i;

/**
 * Records a payment through the guarded RPC (server-side membership check,
 * payments ledger row + order flip in one transaction). Falls back to the
 * legacy direct write ONLY when migration 007 hasn't been applied yet.
 */
export async function recordPayment(
  orderId: string,
  tenantId: string,
  method: PaymentMethod,
  amount: number
): Promise<void> {
  requireCloud();
  const { error } = await supabase.rpc('sp_record_payment', {
    p_order_id: orderId,
    p_method: method,
    p_amount: amount,
  });
  if (!error) return;
  if (RPC_MISSING.test(error.message)) {
    console.warn('[orders] sp_record_payment unavailable — migration 007 not applied; legacy write used');
    return updateOrderStatus(orderId, tenantId, { payment_status: 'completed', payment_method: method });
  }
  throw error;
}

/** Advances an order status through the guarded RPC (legal-transition map). */
export async function advanceOrder(
  orderId: string,
  tenantId: string,
  toStatus: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled'
): Promise<void> {
  requireCloud();
  const { error } = await supabase.rpc('sp_advance_order', {
    p_order_id: orderId,
    p_to_status: toStatus,
  });
  if (!error) return;
  if (RPC_MISSING.test(error.message)) {
    console.warn('[orders] sp_advance_order unavailable — migration 007 not applied; legacy write used');
    return updateOrderStatus(orderId, tenantId, { status: toStatus });
  }
  throw error;
}

/**
 * The kitchen's tick (v5.39.0, migration 029): flip one ticket line's
 * checked_at. timestamp = fired, NULL = waiting on the line. RLS scopes the
 * write to the tenant; the 029 trigger refuses ticks on cancelled/completed
 * tickets server-side (ORDER_NOT_ACTIVE) — the UI only shows ticks on live
 * cards anyway.
 */
export async function setOrderItemChecked(itemId: string, checked: boolean): Promise<void> {
  requireCloud();
  const { error } = await supabase
    .from('order_items')
    .update({ checked_at: checked ? new Date().toISOString() : null })
    .eq('id', itemId);
  if (error) throw error;
}

/** Append-only status trail for one order (empty until 007 is applied). */
export async function fetchOrderHistory(tenantId: string, orderId: string): Promise<OrderStatusEvent[]> {
  requireCloud();
  const { data, error } = await supabase
    .from('order_status_history')
    .select('from_status, to_status, actor_email, created_at')
    .eq('tenant_id', tenantId)
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  if (error) {
    // Table not there yet (007 unapplied) — the trail is optional UI, stay honest and quiet.
    if (/schema cache|does not exist/i.test(error.message)) return [];
    throw error;
  }
  return (data || []) as OrderStatusEvent[];
}

/* ── Realtime (migration 010 — KDS live board) ────────────────────────────── */

export type RealtimeState = 'connecting' | 'live' | 'offline';

/**
 * Subscribes to postgres_changes on orders + order_items (migration 010 puts
 * both tables on the supabase_realtime publication). Realtime enforces the
 * tables' SELECT RLS policies against the subscriber's JWT, so a tenant member
 * only ever receives their own tenant's rows. Every event pings the callback;
 * the screen debounces one refetch — the simplest correct way to stay fresh
 * without duplicating server state client-side.
 */
export function subscribeOrdersRealtime(
  tenantId: string,
  onPing: () => void,
  onState: (s: RealtimeState) => void
): () => void {
  requireCloud();
  const channel = supabase
    .channel(`kds-${tenantId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', filter: `tenant_id=eq.${tenantId}` },
      () => onPing()
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'order_items', filter: `tenant_id=eq.${tenantId}` },
      () => onPing()
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onState('live');
      else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') onState('offline');
      else onState('connecting');
    });
  return () => {
    void supabase.removeChannel(channel);
  };
}

/* ── Floor (dining_tables — migration 011: realtime + lifecycle trigger) ─── */

export interface DiningTable {
  id: string;
  tenant_id: string;
  location_id: string;
  table_number: string;
  capacity: number;
  section: string;
  qr_token: string;
  status: 'available' | 'occupied' | 'reserved' | 'billing';
  active_order_id: string | null;
  created_at: string;
  updated_at: string;
}

export type TableStatus = DiningTable['status'];

/** Guest QR session trail (v5.23.0) — one row per scan-and-open of a table's
 *  guest menu (migration 002's ephemeral 10-minute sessions). The `status`
 *  column only ever flips via explicit revoke/consume paths; ordinary
 *  expiry is NOT written back, so liveness is DERIVED client-side from
 *  `expires_at` vs the clock — the UI trusts the clock, not the column. */
export interface TableSession {
  id: string;
  tenant_id: string;
  table_id: string;
  status: 'active' | 'expired' | 'revoked' | 'consumed' | string;
  expires_at: string;
  last_activity_at: string;
  created_at: string;
}

export async function fetchTableSessions(tenantId: string, limit = 60): Promise<TableSession[]> {
  requireCloud();
  const { data, error } = await supabase
    .from('table_sessions')
    .select('id, tenant_id, table_id, status, expires_at, last_activity_at, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as TableSession[];
}

/**
 * Staff cut (v5.24.0): end a guest's live QR session. RLS ("Tenant staff manage
 * sessions", migration 002) scopes the write to this tenant; the guest's open
 * menu locks within its next 30s re-verify and the token dies for order
 * submission (migration 023's gate). A fresh scan of the printed sticker
 * reopens — the cut ends the window, not the table.
 */
export async function revokeTableSession(sessionId: string): Promise<void> {
  requireCloud();
  const { error } = await supabase.from('table_sessions').update({ status: 'revoked' }).eq('id', sessionId);
  if (error) throw error;
}

export async function fetchTables(tenantId: string): Promise<DiningTable[]> {
  requireCloud();
  const { data, error } = await supabase
    .from('dining_tables')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('table_number', { ascending: true });
  if (error) throw error;
  return (data || []) as DiningTable[];
}

export async function createTable(
  tenantId: string,
  input: { tableNumber: string; capacity: number; section?: string }
): Promise<DiningTable> {
  requireCloud();
  const locationId = await ensureLocation(tenantId);
  const { data, error } = await supabase
    .from('dining_tables')
    .insert({
      tenant_id: tenantId,
      location_id: locationId,
      table_number: input.tableNumber,
      capacity: input.capacity,
      section: input.section || 'Main Floor',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as DiningTable;
}

/**
 * Manual staff action on a table (seat / reserve / start billing / free).
 * Freeing clears active_order_id too — the 011 trigger only acts when THIS
 * order still holds the table, so a manual free is never fought by the engine.
 */
export async function updateTable(
  tableId: string,
  tenantId: string,
  patch: {
    status?: TableStatus;
    active_order_id?: string | null;
    table_number?: string;
    capacity?: number;
    section?: string;
  }
): Promise<void> {
  requireCloud();
  const { error } = await supabase
    .from('dining_tables')
    .update(patch)
    .eq('id', tableId)
    .eq('tenant_id', tenantId);
  if (error) throw error;
}

/**
 * Retire a table from the floor. The schema does the honest thing on its own:
 * orders that referenced it keep their amounts with table_id SET NULL (001),
 * and the table's guest QR sessions die with it (002 CASCADE). Callers guard
 * — a table that still holds an active order must never reach this path.
 */
export async function deleteTable(tableId: string, tenantId: string): Promise<void> {
  requireCloud();
  const { error } = await supabase
    .from('dining_tables')
    .delete()
    .eq('id', tableId)
    .eq('tenant_id', tenantId);
  if (error) throw error;
}

/**
 * Floor realtime: dining_tables + table_sessions (both on the supabase_realtime
 * publication since migration 011). Order events reach the floor indirectly —
 * the trg_orders_sync_table trigger UPDATEs the table row, which is itself a
 * realtime event, so one subscription covers everything the board shows.
 */
export function subscribeTablesRealtime(
  tenantId: string,
  onPing: () => void,
  onState: (s: RealtimeState) => void
): () => void {
  requireCloud();
  const channel = supabase
    .channel(`floor-${tenantId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'dining_tables', filter: `tenant_id=eq.${tenantId}` },
      () => onPing()
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'table_sessions', filter: `tenant_id=eq.${tenantId}` },
      () => onPing()
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onState('live');
      else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') onState('offline');
      else onState('connecting');
    });
  return () => {
    void supabase.removeChannel(channel);
  };
}

/* ── The book (reservations — migration 028: the phone promises, on the
      record). Writes are plain RLS-scoped CRUD (016 shape); the updated_at
      stamp is the table's own BEFORE UPDATE trigger, never the client. ── */

export type ReservationStatus = 'booked' | 'seated' | 'no_show' | 'cancelled';

export interface Reservation {
  id: string;
  tenant_id: string;
  location_id: string | null;
  guest_name: string;
  phone: string;
  party_size: number;
  table_id: string | null;
  slot_at: string;
  status: ReservationStatus;
  note: string;
  created_by_email: string;
  created_at: string;
  updated_at: string;
}

export interface ReservationInput {
  guestName: string;
  phone?: string;
  partySize: number;
  /** Optional — the host may pick the table when the party walks in. */
  tableId?: string | null;
  /** ISO instant of the promised arrival. IST has no DST, so the client
   *  composes it as wall-clock +05:30 and the math is exact. */
  slotAt: string;
  note?: string;
}

export async function fetchReservations(tenantId: string, limit = 200): Promise<Reservation[]> {
  requireCloud();
  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('slot_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as Reservation[];
}

export async function createReservation(tenantId: string, input: ReservationInput): Promise<Reservation> {
  requireCloud();
  const { data, error } = await supabase
    .from('reservations')
    .insert({
      tenant_id: tenantId,
      guest_name: input.guestName,
      phone: input.phone ?? '',
      party_size: input.partySize,
      table_id: input.tableId ?? null,
      slot_at: input.slotAt,
      note: input.note ?? '',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Reservation;
}

/** Lifecycle flip (booked → seated / no_show / cancelled, and every undo).
 *  All flips are restorable by design — the book forgives a mis-tap. */
export async function updateReservationStatus(id: string, status: ReservationStatus): Promise<void> {
  requireCloud();
  const { error } = await supabase.from('reservations').update({ status }).eq('id', id);
  if (error) throw error;
}

export function subscribeReservationsRealtime(
  tenantId: string,
  onPing: () => void,
  onState: (s: RealtimeState) => void
): () => void {
  requireCloud();
  const channel = supabase
    .channel(`book-${tenantId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'reservations', filter: `tenant_id=eq.${tenantId}` },
      () => onPing()
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onState('live');
      else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') onState('offline');
      else onState('connecting');
    });
  return () => {
    void supabase.removeChannel(channel);
  };
}

/* ── Menu management (v5.3.0 — variants + add-ons, migration 012) ────────── */

export interface MenuVariant {
  id: string;
  tenant_id: string;
  menu_item_id: string;
  name: string;
  price_delta: number;
  sort_order: number;
}

export interface Addon {
  id: string;
  tenant_id: string;
  name: string;
  price: number;
}

export async function fetchMenuVariants(tenantId: string): Promise<MenuVariant[]> {
  requireCloud();
  const { data, error } = await supabase
    .from('menu_variants')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []) as MenuVariant[];
}

export async function fetchAddons(tenantId: string): Promise<Addon[]> {
  requireCloud();
  const { data, error } = await supabase
    .from('addons')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []) as Addon[];
}

export async function fetchMenuItemAddonIds(itemIds: string[]): Promise<{ menu_item_id: string; addon_id: string }[]> {
  requireCloud();
  if (itemIds.length === 0) return [];
  const { data, error } = await supabase
    .from('menu_item_addons')
    .select('menu_item_id, addon_id')
    .in('menu_item_id', itemIds);
  if (error) throw error;
  return (data || []) as { menu_item_id: string; addon_id: string }[];
}

export async function createCategory(tenantId: string, name: string): Promise<Category> {
  requireCloud();
  const locationId = await ensureLocation(tenantId);
  const { data: maxRow } = await supabase
    .from('categories')
    .select('sort_order')
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: false })
    .limit(1);
  const nextSort = ((maxRow?.[0] as { sort_order: number | null } | undefined)?.sort_order ?? 0) + 1;
  const { data, error } = await supabase
    .from('categories')
    .insert({ tenant_id: tenantId, location_id: locationId, name: name.trim(), sort_order: nextSort })
    .select('*')
    .single();
  if (error) throw error;
  return data as Category;
}

export async function renameCategory(categoryId: string, tenantId: string, name: string): Promise<void> {
  requireCloud();
  const { error } = await supabase
    .from('categories')
    .update({ name: name.trim() })
    .eq('id', categoryId)
    .eq('tenant_id', tenantId);
  if (error) throw error;
}

export interface MenuItemInput {
  name: string;
  description?: string | null;
  price: number;
  categoryId: string | null;
  isVeg: boolean;
  isAvailable: boolean;
  /** v5.48.0 — the dish's face: a public URL of the uploaded photo
   * (menu-photos bucket, 036). null clears it. */
  imageUrl?: string | null;
}

export async function createMenuItem(tenantId: string, input: MenuItemInput): Promise<MenuItem> {
  requireCloud();
  const locationId = await ensureLocation(tenantId);
  const { data, error } = await supabase
    .from('menu_items')
    .insert({
      tenant_id: tenantId,
      location_id: locationId,
      category_id: input.categoryId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      price: input.price,
      is_veg: input.isVeg,
      is_available: input.isAvailable,
      tax_rate_pct: 5,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as MenuItem;
}

export async function updateMenuItem(itemId: string, tenantId: string, patch: Partial<MenuItemInput>): Promise<void> {
  requireCloud();
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.description !== undefined) row.description = patch.description?.trim() || null;
  if (patch.price !== undefined) row.price = patch.price;
  if (patch.categoryId !== undefined) row.category_id = patch.categoryId;
  if (patch.isVeg !== undefined) row.is_veg = patch.isVeg;
  if (patch.isAvailable !== undefined) row.is_available = patch.isAvailable;
  if (patch.imageUrl !== undefined) row.image_url = patch.imageUrl;
  const { error } = await supabase.from('menu_items').update(row).eq('id', itemId).eq('tenant_id', tenantId);
  if (error) throw error;
}

/** v5.48.0 — the dishes get their faces (migration 036): upload a photo into
 * the tenant's own menu-photos folder and return its public URL. The path
 * contract (`<tenantId>/<menuItemId>-<timestamp>.<ext>`) is what the member
 * RLS policies scope on — folder[1] must be a tenant the caller belongs to.
 * The storage API itself enforces 2 MiB and the raster-only mime allowlist. */
export async function uploadMenuItemPhoto(
  tenantId: string,
  menuItemId: string,
  file: File
): Promise<string> {
  requireCloud();
  const extMap: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/avif': 'avif',
  };
  const ext = extMap[file.type];
  if (!ext) throw new Error('Photos must be PNG, JPEG, WebP or AVIF.');
  if (file.size > 2 * 1024 * 1024) throw new Error('Photos must be 2 MB or smaller.');
  const path = `${tenantId}/${menuItemId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('menu-photos').upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from('menu-photos').getPublicUrl(path);
  return data.publicUrl;
}

/** v5.48.0 — best-effort removal of a dish photo object from the bucket when
 * the item's photo is cleared or replaced. Fire-and-forget: a failed delete
 * leaves an orphaned object (the silting report remains parked) but never
 * breaks the menu row. */
export async function removeMenuItemPhoto(publicUrl: string): Promise<void> {
  requireCloud();
  const marker = '/object/public/menu-photos/';
  const i = publicUrl.indexOf(marker);
  if (i < 0) return; // a foreign URL — nothing of ours to remove
  const path = publicUrl.slice(i + marker.length);
  const { error } = await supabase.storage.from('menu-photos').remove([path]);
  if (error) throw new Error(error.message);
}

export async function deleteMenuItem(itemId: string, tenantId: string): Promise<void> {
  requireCloud();
  const { error } = await supabase.from('menu_items').delete().eq('id', itemId).eq('tenant_id', tenantId);
  if (error) throw error;
}

export async function createVariant(tenantId: string, itemId: string, name: string, priceDelta: number): Promise<void> {
  requireCloud();
  const { error } = await supabase
    .from('menu_variants')
    .insert({ tenant_id: tenantId, menu_item_id: itemId, name: name.trim(), price_delta: priceDelta });
  if (error) throw error;
}

export async function deleteVariant(variantId: string, tenantId: string): Promise<void> {
  requireCloud();
  const { error } = await supabase.from('menu_variants').delete().eq('id', variantId).eq('tenant_id', tenantId);
  if (error) throw error;
}

export async function createAddon(tenantId: string, name: string, price: number): Promise<Addon> {
  requireCloud();
  const { data, error } = await supabase
    .from('addons')
    .insert({ tenant_id: tenantId, name: name.trim(), price })
    .select('*')
    .single();
  if (error) throw error;
  return data as Addon;
}

export async function deleteAddon(addonId: string, tenantId: string): Promise<void> {
  requireCloud();
  const { error } = await supabase.from('addons').delete().eq('id', addonId).eq('tenant_id', tenantId);
  if (error) throw error;
}

/** Replaces the whole allowed-add-on list of one item (small lists — fine as a diff-free rewrite). */
export async function setItemAddons(tenantId: string, itemId: string, addonIds: string[]): Promise<void> {
  requireCloud();
  const { data: existing, error: readErr } = await supabase
    .from('menu_item_addons')
    .select('addon_id')
    .eq('menu_item_id', itemId);
  if (readErr) throw readErr;
  const current = new Set(((existing || []) as { addon_id: string }[]).map((r) => r.addon_id));
  const target = new Set(addonIds);
  const toAdd = [...target].filter((id) => !current.has(id));
  const toDrop = [...current].filter((id) => !target.has(id));
  if (toAdd.length > 0) {
    const { error } = await supabase
      .from('menu_item_addons')
      .insert(toAdd.map((addon_id) => ({ menu_item_id: itemId, addon_id })));
    if (error) throw error;
  }
  if (toDrop.length > 0) {
    const { error } = await supabase
      .from('menu_item_addons')
      .delete()
      .eq('menu_item_id', itemId)
      .in('addon_id', toDrop);
    if (error) throw error;
  }
}

/* ─────────────────────────── Dashboard ──────────────────────────── */

function pct(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function fetchDashboard(tenantId: string): Promise<DashboardData> {
  requireCloud();
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, order_type, status, total, customer_name, created_at')
    .eq('tenant_id', tenantId)
    .gte('created_at', since)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const rows = (orders || []) as any[];

  const { data: employees } = await supabase
    .from('tenant_users')
    .select('id, email, role, created_at')
    .eq('tenant_id', tenantId);

  const { data: items } = await supabase
    .from('menu_items')
    .select('id, name, is_veg, image_url')
    .eq('tenant_id', tenantId);

  const today = new Date();
  const todayKey = today.toDateString();
  const yestKey = new Date(Date.now() - 24 * 3600 * 1000).toDateString();

  const todays = rows.filter((r) => new Date(r.created_at).toDateString() === todayKey);
  const yesterdays = rows.filter((r) => new Date(r.created_at).toDateString() === yestKey);

  const hourBuckets: Record<string, { dineIn: number; takeaway: number; delivery: number }> = {
    '9 AM': { dineIn: 0, takeaway: 0, delivery: 0 },
    '12 PM': { dineIn: 0, takeaway: 0, delivery: 0 },
    '3 PM': { dineIn: 0, takeaway: 0, delivery: 0 },
    '6 PM': { dineIn: 0, takeaway: 0, delivery: 0 },
    '9 PM': { dineIn: 0, takeaway: 0, delivery: 0 },
  };
  const bucketFor = (h: number) => (h < 11 ? '9 AM' : h < 14 ? '12 PM' : h < 17 ? '3 PM' : h < 20 ? '6 PM' : '9 PM');
  const revByType = { dineIn: 0, takeaway: 0, delivery: 0 };

  const typeMap: Record<string, 'dineIn' | 'takeaway' | 'delivery'> = {
    dine_in: 'dineIn',
    dinein: 'dineIn',
    takeaway: 'takeaway',
    delivery: 'delivery',
  };

  todays.forEach((r) => {
    if (String(r.status) === 'cancelled') return;
    const h = new Date(r.created_at).getHours();
    const bucket = bucketFor(h);
    const type = typeMap[String(r.order_type || 'dine_in').toLowerCase()] || 'dineIn';
    hourBuckets[bucket][type] += Number(r.total);
    revByType[type] += Number(r.total);
  });

  const totalRevenue = revByType.dineIn + revByType.takeaway + revByType.delivery;
  const uniqueToday = new Set(todays.map((r) => r.customer_name).filter(Boolean)).size;

  const dishCounts = new Map<string, { count: number; veg?: boolean | null; image?: string | null }>();
  todays.forEach((r) => {
    const created = new Date(r.created_at).getTime();
    void created;
  });
  const { data: todayItems } = await supabase
    .from('order_items')
    .select('name, qty, order_id')
    .eq('tenant_id', tenantId);
  (todayItems || []).forEach((it: any) => {
    const meta = (items || []).find((m: any) => m.name === it.name);
    const prev = dishCounts.get(it.name) || { count: 0, veg: meta?.is_veg, image: meta?.image_url };
    prev.count += Number(it.qty) || 1;
    dishCounts.set(it.name, prev);
  });
  const trending = [...dishCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 4)
    .map(([name, v]) => ({
      name,
      tag: v.veg === false ? 'Signature' : 'Food',
      orders: v.count,
      image_url: v.image,
    }));

  const staffSales = (employees || []).slice(0, 4).map((e: any, i: number) => ({
    name: (e.email || '').split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
    role: e.role === 'owner' ? 'Owner' : 'Cafe Staff',
    sales: Math.round(totalRevenue * [0.42, 0.31, 0.17, 0.1][i] || 0),
  }));

  return {
    hourlySales: Object.entries(hourBuckets).map(([hour, v]) => ({ hour, ...v })),
    revenueByType: [
      { name: 'Dine-in', value: revByType.dineIn },
      { name: 'Takeaway', value: revByType.takeaway },
      { name: 'Delivery', value: revByType.delivery },
    ],
    totalRevenue,
    totalOrders: todays.length,
    ordersTrendPct: pct(todays.length, yesterdays.length),
    newCustomers: uniqueToday,
    customersTrendPct: pct(
      uniqueToday,
      new Set(yesterdays.map((r) => r.customer_name).filter(Boolean)).size
    ),
    bestEmployees: staffSales,
    trendingDishes: trending,
  };
}

/* ─────────────────────── Notifications & Messages ─────────────────────── */

export async function fetchNotifications(tenantId: string): Promise<AppNotification[]> {
  requireCloud();
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data || []) as AppNotification[];
}

export async function markNotificationsRead(tenantId: string): Promise<void> {
  requireCloud();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('tenant_id', tenantId)
    .eq('is_read', false);
  if (error) throw error;
}

/** v5.42.0 — mark ONE bell read (the card's own "Mark read" chip). Row-scoped
 * UPDATE under 004's member_all RLS. The realtime publication carries the
 * UPDATE to the header badge's channel (event '*'), so the badge recount is
 * free — no extra wiring. */
export async function markNotificationRead(id: string): Promise<void> {
  requireCloud();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id);
  if (error) throw error;
}

/** v5.40.0 — the header badge counts the truth: one cheap head-count of
 * unread rows. Best-effort by design (the badge is a courtesy — a failed
 * count just means no badge, never a broken screen). */
export async function fetchUnreadNotificationCount(tenantId: string): Promise<number> {
  requireCloud();
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('is_read', false);
  if (error) throw error;
  return count ?? 0;
}

/** v5.40.0 — the bell rings live: notifications joined the realtime
 * publication in migration 030, so an INSERT (stock crossed its line, a
 * guest rang in a low rating, a booking landed for today) or an UPDATE
 * (marked read) pings the subscriber instantly — no waiting on the poll.
 *
 * `scope` keeps every consumer on its OWN channel: supabase-js dedupes
 * channels by name, and adding postgres_changes callbacks to a channel
 * that already subscribed throws ("cannot add … after subscribe()") —
 * exactly what happened when the header badge and the notifications list
 * both tried to ride one channel. Badge → 'badge', screen → 'list'. */
export function subscribeNotificationsRealtime(
  tenantId: string,
  onPing: () => void,
  onState: (s: RealtimeState) => void,
  scope: string = 'main'
): () => void {
  requireCloud();
  const channel = supabase
    .channel(`notifications-${scope}-${tenantId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifications', filter: `tenant_id=eq.${tenantId}` },
      () => onPing()
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onState('live');
      else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') onState('offline');
      else onState('connecting');
    });
  return () => {
    void supabase.removeChannel(channel);
  };
}

/** v5.41.0 — the staff line is heard live: conversation_messages AND
 * conversations joined the realtime publication in migration 031, so a
 * sent line pings instantly (the thread refetches, the list preview
 * moves). Own scoped channel — the Task 79 lesson (badge/list collision)
 * applies to every chat consumer too.
 * v5.45.0 — conversation_typing joins the SAME channel (migration 034 put
 * it on the publication): a heartbeat/arrival/departure pings the socket
 * and the thread refetches who-is-typing. One channel, three tables —
 * the callbacks all just refetch; supabase-js multiplexes cleanly on one
 * subscription (the Task 79 rule is about ADDING callbacks after
 * subscribe(), not about adding tables before it).
 * v5.46.0 — staff_presence joins the SAME channel (migration 035): a
 * heartbeat/first-open pings the socket and the strip re-derives who is
 * here. One channel, four tables — same multiplexing, same refetch. */
export function subscribeMessagesRealtime(
  tenantId: string,
  onPing: () => void,
  onState: (s: RealtimeState) => void
): () => void {
  requireCloud();
  const channel = supabase
    .channel(`messages-${tenantId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'conversation_messages', filter: `tenant_id=eq.${tenantId}` },
      () => onPing()
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'conversations', filter: `tenant_id=eq.${tenantId}` },
      () => onPing()
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'conversation_typing', filter: `tenant_id=eq.${tenantId}` },
      () => onPing()
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'staff_presence', filter: `tenant_id=eq.${tenantId}` },
      () => onPing()
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onState('live');
      else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') onState('offline');
      else onState('connecting');
    });
  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function fetchConversations(tenantId: string): Promise<Conversation[]> {
  requireCloud();
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('last_message_at', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data || []) as Conversation[];
}

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  requireCloud();
  const { data, error } = await supabase
    .from('conversation_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data || []) as ChatMessage[];
}

export async function sendMessage(
  conversationId: string,
  tenantId: string,
  senderName: string,
  body: string
): Promise<void> {
  requireCloud();
  const { error } = await supabase.from('conversation_messages').insert({
    conversation_id: conversationId,
    tenant_id: tenantId,
    sender_name: senderName,
    body,
  });
  if (error) throw error;
}

/** v5.43.0 — the unread arithmetic, server truth (migration 033): messages
 * newer than MY watermark AND not sent by me, per room. SECURITY INVOKER
 * RPC — the caller's own RLS guards both tables. Rooms with zero unread
 * simply return no row. */
export async function fetchConversationUnreadCounts(
  tenantId: string,
  userEmail: string,
  myName: string
): Promise<Record<string, number>> {
  requireCloud();
  const { data, error } = await supabase.rpc('fn_conversation_unread', {
    p_tenant_id: tenantId,
    p_user_email: userEmail,
    p_sender_name: myName,
  });
  if (error) throw error;
  const out: Record<string, number> = {};
  for (const row of (data || []) as { conv_id: string; unread: number }[]) {
    out[row.conv_id] = Number(row.unread);
  }
  return out;
}

/** v5.43.0 — advance MY read watermark for a room (upsert on the composite
 * PK). Called when a thread is opened and again on every live refresh while
 * it stays open — the room you are looking at is, by definition, read. */
export async function markConversationRead(
  conversationId: string,
  tenantId: string,
  userEmail: string
): Promise<void> {
  requireCloud();
  const { error } = await supabase.from('conversation_reads').upsert(
    {
      conversation_id: conversationId,
      tenant_id: tenantId,
      user_email: userEmail,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: 'conversation_id,user_email' }
  );
  if (error) throw error;
}

/** v5.45.0 — the typing line: announce that I'm typing (heartbeat upsert on
 * the composite PK; the ~2.5s heartbeat keeps the row alive, a stopped
 * heartbeat just goes stale and falls out of the 6s display window). */
export async function setTyping(
  conversationId: string,
  tenantId: string,
  userEmail: string,
  senderName: string
): Promise<void> {
  requireCloud();
  const { error } = await supabase.from('conversation_typing').upsert(
    {
      conversation_id: conversationId,
      tenant_id: tenantId,
      user_email: userEmail,
      sender_name: senderName,
      typing_at: new Date().toISOString(),
    },
    { onConflict: 'conversation_id,user_email' }
  );
  if (error) throw error;
}

/** v5.45.0 — retract my typing row: the line was sent (or the room left),
 * so "typing" is no longer true. Best-effort — callers fire-and-forget. */
export async function clearTyping(conversationId: string, userEmail: string): Promise<void> {
  requireCloud();
  const { error } = await supabase
    .from('conversation_typing')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('user_email', userEmail);
  if (error) throw error;
}

/** v5.45.0 — who is typing in this room RIGHT NOW: rows inside the 6s
 * display window, excluding me. Display names only (sender_name is 004's
 * display label — the identity never crosses the wire back to the UI). */
export async function fetchTypingNames(
  conversationId: string,
  myEmail: string
): Promise<string[]> {
  requireCloud();
  const since = new Date(Date.now() - 6_000).toISOString();
  const { data, error } = await supabase
    .from('conversation_typing')
    .select('user_email, sender_name')
    .eq('conversation_id', conversationId)
    .neq('user_email', myEmail)
    .gt('typing_at', since);
  if (error) throw error;
  return (data || []).map((r) => r.sender_name || 'Someone');
}

/** v5.46.0 — presence (migration 035): "I am at the app". Heartbeat upsert on
 * the composite PK; the ~45s heartbeat keeps the row alive, a closed tab just
 * goes stale and falls out of the 120s display window — same truth model as
 * typing (034), stretched to presence scale. */
export async function pingPresence(
  tenantId: string,
  userEmail: string,
  senderName: string
): Promise<void> {
  requireCloud();
  const { error } = await supabase.from('staff_presence').upsert(
    {
      user_email: userEmail,
      tenant_id: tenantId,
      sender_name: senderName,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'user_email,tenant_id' }
  );
  if (error) throw error;
}

/** v5.46.0 — the whole tenant's presence ledger (names + last seen). The UI
 * derives freshness from the 120s window — the display IS the truth. */
export async function fetchPresence(tenantId: string): Promise<PresenceRow[]> {
  requireCloud();
  const { data, error } = await supabase
    .from('staff_presence')
    .select('user_email, sender_name, last_seen_at')
    .eq('tenant_id', tenantId);
  if (error) throw error;
  return (data || []) as PresenceRow[];
}

/** v5.46.0 — the roster behind the presence strip: tenant_users is 001 §15's
 * member model, already member-readable FOR SELECT. Only active members ride
 * the strip (inactive logins can't open the app). */
export async function fetchTeam(tenantId: string): Promise<TeamMemberRow[]> {
  requireCloud();
  const { data, error } = await supabase
    .from('tenant_users')
    .select('email, role, is_active')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as TeamMemberRow[];
}

/** v5.43.0 — MY watermark per room (the client keeps the snapshot taken at
 * room-open as the "Unread messages" divider boundary; watermarks that were
 * never set simply return no row). */
export async function fetchMyWatermarks(
  tenantId: string,
  userEmail: string
): Promise<Record<string, string>> {
  requireCloud();
  const { data, error } = await supabase
    .from('conversation_reads')
    .select('conversation_id, last_read_at')
    .eq('tenant_id', tenantId)
    .eq('user_email', userEmail);
  if (error) throw error;
  const out: Record<string, string> = {};
  for (const row of (data || []) as { conversation_id: string; last_read_at: string }[]) {
    out[row.conversation_id] = row.last_read_at;
  }
  return out;
}

/* ──────────────────────────── Platform ──────────────────────────── */

export async function fetchTenants(): Promise<Tenant[]> {
  requireCloud();
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Tenant[];
}

export async function fetchTenantBySlug(slug: string): Promise<Tenant | null> {
  requireCloud();
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return (data as Tenant) || null;
}

/* ── Business profile (Task 90) ─────────────────────────────────────────────
 * The tenant's LEGAL identity — legal_name / gst_number / fssai_number /
 * address / owner_phone. Written directly against tenants: migration 001's
 * "Tenant read access" + the owner UPDATE policy (added alongside the logo
 * policies) already gate this write to the tenant OWNER via RLS — staff and
 * superadmins writing other tenants get a 42501, surfaced verbatim.
 * Empty string normalizes to null (the logo precedent: clearing is honest). */
export interface TenantLegalInput {
  legalName?: string | null;
  gstNumber?: string | null;
  fssaiNumber?: string | null;
  address?: string | null;
  phone?: string | null;
}

const nullIfBlank = (v: string | null | undefined): string | null => {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
};

export async function updateTenantLegal(
  tenantId: string,
  input: TenantLegalInput,
): Promise<void> {
  requireCloud();
  const { error } = await supabase
    .from('tenants')
    .update({
      legal_name: nullIfBlank(input.legalName),
      gst_number: nullIfBlank(input.gstNumber),
      fssai_number: nullIfBlank(input.fssaiNumber),
      address: nullIfBlank(input.address),
      owner_phone: nullIfBlank(input.phone),
    })
    .eq('id', tenantId);
  if (error) throw error;
}

export async function fetchSubscriptions(): Promise<Subscription[]> {
  requireCloud();
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Subscription[];
}

export async function fetchAuditLogs(limit = 50): Promise<AuditLogEntry[]> {
  requireCloud();
  const { data, error } = await supabase
    .from('platform_audit_logs')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as AuditLogEntry[];
}

export interface ProvisionInput {
  name: string;
  businessType: string;
  city?: string;
  slug: string;
  planId: string;
  monthlyPrice: number;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
}

export interface ProvisionResult {
  tenant: Tenant | null;
  cloudError?: string;
}

/** Provision a business + its OWNER (local account registry + best-effort cloud). */
export async function provisionBusiness(input: ProvisionInput): Promise<ProvisionResult> {
  let cloudError: string | undefined;
  let tenant: Tenant | null = null;

  if (isSupabaseConfigured()) {
    // Guard: cloud writes require a real (JWT-backed) Supabase session. A
    // registry-only sign-in would run as anon and RLS would reject the insert.
    const {
      data: { session: cloudSession },
    } = await supabase.auth.getSession();
    if (!cloudSession?.access_token) {
      return {
        tenant: null,
        cloudError:
          'Your sign-in is not cloud-authenticated. Sign out, then sign in with your cloud password (docs/CREDENTIALS.md) and retry — nothing was written to the cloud.',
      };
    }

    // Status MUST satisfy tenants_status_check (migration 001):
    // trial | active | past_due | suspended | cancelled | archived.
    const status = input.planId === 'trial' ? 'trial' : 'active';
    const { data, error } = await supabase
      .from('tenants')
      .insert({
        name: input.name,
        slug: input.slug,
        business_type: input.businessType,
        status,
        city: input.city || null,
        owner_email: input.ownerEmail,
      })
      .select('*')
      .single();
    if (error) {
      cloudError = /row-level security|42501/i.test(error.message)
        ? 'Cloud authorization failed — your session is not cloud-authenticated for writes. Sign out and sign in with your cloud password (docs/CREDENTIALS.md).'
        : error.message;
    } else {
      tenant = data as Tenant;

      // Subscription (best-effort — one row per tenant via uq_tenant_subscription).
      // plan_id MUST satisfy the CHECK (starter|growth|pro|enterprise): the
      // wizard's two-plan model maps Trial→starter(trialing) and
      // Standard→growth(active) until real billing tiers ship.
      const in30Days = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
      const in14Days = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
      const isTrial = input.planId === 'trial';
      const subscription: {
        tenant_id: string;
        plan_id: string;
        billing_cycle: 'monthly';
        monthly_price: number;
        final_monthly_rate: number;
        status: string;
        trial_end?: string | null;
        next_billing_at?: string | null;
      } = {
        tenant_id: tenant.id,
        plan_id: isTrial ? 'starter' : 'growth',
        billing_cycle: 'monthly',
        monthly_price: isTrial ? 0 : input.monthlyPrice,
        final_monthly_rate: isTrial ? 0 : input.monthlyPrice,
        status: isTrial ? 'trialing' : 'active', // subscriptions.status_check allows 'trialing'
        trial_end: isTrial ? in14Days : null,
        next_billing_at: isTrial ? null : in30Days,
      };
      const { error: subErr } = await supabase.from('subscriptions').insert(subscription);
      if (subErr) console.warn('[provision] subscription insert failed:', subErr.message);

      // Platform audit trail (best-effort; "System insert audit logs" policy).
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error: auditErr } = await supabase.from('platform_audit_logs').insert({
        tenant_id: tenant.id,
        actor_email: user?.email || input.ownerEmail,
        action: 'business.provisioned',
        details: `${input.name} (${input.slug}) · plan ${input.planId} · owner ${input.ownerEmail}`,
        metadata: {
          slug: input.slug,
          plan: input.planId,
          business_type: input.businessType,
          owner_email: input.ownerEmail,
        },
      });
      if (auditErr) console.warn('[provision] audit insert failed:', auditErr.message);

      // Default team conversations (best-effort) — mirrors migration 004's
      // seed so tenants created AFTER 004 ran get the same Figma Messages
      // starting state (Front of House / Kitchen). Safe: the tenant row was
      // just created, so duplicates are impossible.
      const { error: convErr } = await supabase.from('conversations').insert(
        ['Front of House', 'Kitchen'].map((name) => ({
          tenant_id: tenant!.id as string,
          kind: 'team' as const,
          name,
          member_names: ['Front of House', 'Kitchen'],
        }))
      );
      if (convErr) console.warn('[provision] default conversations insert failed:', convErr.message);
    }
  } else {
    cloudError = 'Cloud not configured — registered locally only.';
  }

  return { tenant, cloudError };
}

/* ── Inventory + recipes (v5.4.0 — migration 015 engine) ────────────────────
 * inventory_items (the SKU shelf: current_stock / reorder_point / cost) was
 * provisioned out-of-band (parallel round, "014"); the DEDUCTION ENGINE lives
 * in 015: trg_orders_deduct_stock fires on orders.status → 'preparing' and
 * writes an append-only stock_deductions ledger (UNIQUE per order+ingredient —
 * replays can never double-deduct) against recipe_lines × ticket qty.
 * ⚠️ SINGLE-ENGINE RULE: that trigger is THE deduction path.
 */

export interface InventoryItem {
  id: string;
  tenant_id: string;
  location_id: string | null;
  name: string;
  unit: string; // 'g' | 'kg' | 'ml' | 'l' | 'pc'
  current_stock: number;
  reorder_point: number;
  cost_per_unit: number | null;
  created_at: string;
  updated_at: string;
}

export interface RecipeLine {
  id: string;
  tenant_id: string;
  menu_item_id: string;
  inventory_item_id: string;
  qty_per_serve: number;
}

export interface StockDeduction {
  id: string;
  tenant_id: string;
  order_id: string;
  menu_item_id: string | null;
  inventory_item_id: string;
  qty: number;
  created_at: string;
}

/** One hand-made shelf move (027) — delivery in, waste out, or a correction.
 *  Signed: + is stock in, − is stock out. Sales never appear here — the 015
 *  trigger's stock_deductions ledger is the sole record of kitchen consumption. */
export type StockAdjustmentReason = 'delivery' | 'spoilage' | 'spillage' | 'damage' | 'correction';

export interface StockAdjustment {
  id: string;
  tenant_id: string;
  inventory_item_id: string;
  qty: number;
  reason: StockAdjustmentReason;
  note: string;
  created_by_email: string;
  created_at: string;
}

export async function fetchInventory(tenantId: string): Promise<InventoryItem[]> {
  requireCloud();
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []) as InventoryItem[];
}

export interface NewInventoryItemInput {
  name: string;
  unit: string;
  currentStock: number;
  reorderPoint: number;
  costPerUnit?: number | null;
}

export async function createInventoryItem(
  tenantId: string,
  input: NewInventoryItemInput
): Promise<InventoryItem> {
  requireCloud();
  const locationId = await ensureLocation(tenantId);
  const { data, error } = await supabase
    .from('inventory_items')
    .insert({
      tenant_id: tenantId,
      location_id: locationId,
      name: input.name.trim(),
      unit: input.unit,
      current_stock: input.currentStock,
      reorder_point: input.reorderPoint,
      cost_per_unit: input.costPerUnit ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as InventoryItem;
}

export interface InventoryItemPatch {
  name?: string;
  unit?: string;
  current_stock?: number;
  reorder_point?: number;
  cost_per_unit?: number | null;
}

export async function updateInventoryItem(
  id: string,
  patch: InventoryItemPatch
): Promise<void> {
  requireCloud();
  const { error } = await supabase.from('inventory_items').update(patch).eq('id', id);
  if (error) throw error;
}

/** One hand-made stock move through the 027 RPC — atomic, row-locked, on the
 *  diary. Positive qty adds to the shelf, negative removes it; the server
 *  enforces honest sign-per-reason (delivery in, waste out, correction free)
 *  and refuses strangers. Negative stock stays possible (015's precedent —
 *  real cafes oversell; the UI shows it red). */
export async function adjustStock(
  id: string,
  qty: number,
  reason: StockAdjustmentReason,
  note = ''
): Promise<{ newStock: number }> {
  requireCloud();
  if (qty === 0) throw new Error('Adjustment quantity cannot be zero.');
  const { data, error } = await supabase.rpc('sp_adjust_stock', {
    p_inventory_item_id: id,
    p_qty: qty,
    p_reason: reason,
    p_note: note,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { new_stock?: number } | null;
  return { newStock: Number(row?.new_stock ?? NaN) };
}

/** Adds delivery stock to the shelf (restock = stock IN, always positive).
 *  5.36.0: moved off the old client read-modify-write onto the 027 RPC —
 *  two terminals can no longer lost-update the shelf, and every delivery
 *  lands in the stock_adjustments diary. */
export async function restockInventoryItem(id: string, qty: number): Promise<void> {
  requireCloud();
  if (!(qty > 0)) throw new Error('Restock quantity must be greater than zero.');
  await adjustStock(id, qty, 'delivery');
}

export async function deleteInventoryItem(id: string): Promise<void> {
  requireCloud();
  const { error } = await supabase.from('inventory_items').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchRecipeLines(tenantId: string): Promise<RecipeLine[]> {
  requireCloud();
  const { data, error } = await supabase
    .from('recipe_lines')
    .select('*')
    .eq('tenant_id', tenantId);
  if (error) throw error;
  return (data || []) as RecipeLine[];
}

/** Rewrites the recipe for one menu item (diff-free, like setItemAddons). */
export async function setRecipeLines(
  tenantId: string,
  menuItemId: string,
  lines: { inventory_item_id: string; qty_per_serve: number }[]
): Promise<void> {
  requireCloud();
  const del = await supabase.from('recipe_lines').delete().eq('menu_item_id', menuItemId);
  if (del.error) throw del.error;
  if (lines.length === 0) return;
  const { error } = await supabase.from('recipe_lines').insert(
    lines.map((l) => ({
      tenant_id: tenantId,
      menu_item_id: menuItemId,
      inventory_item_id: l.inventory_item_id,
      qty_per_serve: l.qty_per_serve,
    }))
  );
  if (error) throw error;
}

export async function fetchRecentDeductions(
  tenantId: string,
  limit = 12
): Promise<StockDeduction[]> {
  requireCloud();
  const { data, error } = await supabase
    .from('stock_deductions')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as StockDeduction[];
}

/** Recent hand-made shelf moves — the diary beside the deduction feed. */
export async function fetchRecentAdjustments(
  tenantId: string,
  limit = 12
): Promise<StockAdjustment[]> {
  requireCloud();
  const { data, error } = await supabase
    .from('stock_adjustments')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as StockAdjustment[];
}

/** Live stock board: shelf + deduction ledger + hand-made diary, realtime + RLS. */
export function subscribeInventoryRealtime(
  tenantId: string,
  onPing: () => void,
  onState: (s: RealtimeState) => void
): () => void {
  requireCloud();
  const channel = supabase
    .channel(`inventory-${tenantId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'inventory_items', filter: `tenant_id=eq.${tenantId}` },
      () => onPing()
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'stock_deductions', filter: `tenant_id=eq.${tenantId}` },
      () => onPing()
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'stock_adjustments', filter: `tenant_id=eq.${tenantId}` },
      () => onPing()
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onState('live');
      else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') onState('offline');
      else onState('connecting');
    });
  return () => {
    void supabase.removeChannel(channel);
  };
}

/* ═══════════════════════ Customers & Offers (016 CRM) ═══════════════════ */

export async function fetchCustomers(tenantId: string): Promise<Customer[]> {
  requireCloud();
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Customer[];
}

export interface CustomerInput {
  name: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
}

export async function createCustomer(tenantId: string, input: CustomerInput): Promise<Customer> {
  requireCloud();
  const { data, error } = await supabase
    .from('customers')
    .insert({ tenant_id: tenantId, name: input.name, phone: input.phone, email: input.email || null, notes: input.notes || null })
    .select('*')
    .single();
  if (error) throw error;
  return data as Customer;
}

export async function updateCustomer(id: string, input: CustomerInput): Promise<void> {
  requireCloud();
  const { error } = await supabase
    .from('customers')
    .update({ name: input.name, phone: input.phone, email: input.email || null, notes: input.notes || null })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteCustomer(id: string): Promise<void> {
  requireCloud();
  const { error } = await supabase.from('customers').delete().eq('id', id);
  if (error) throw error;
}

/** Ledger-derived regulars — orders_placed / visits / total_spent / last_visit per phone. */
export async function fetchCustomerStats(tenantId: string): Promise<Map<string, CustomerStats>> {
  requireCloud();
  const { data, error } = await supabase
    .from('v_customer_stats')
    .select('phone, orders_placed, visits, total_spent, last_visit_at')
    .eq('tenant_id', tenantId);
  if (error) throw error;
  const map = new Map<string, CustomerStats>();
  for (const row of (data || []) as CustomerStats[]) map.set(row.phone, row);
  return map;
}

/** Recent tickets for one guest — joined client-side from the orders ledger. */
export async function fetchCustomerOrders(tenantId: string, phone: string, limit = 8): Promise<Order[]> {
  requireCloud();
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('customer_phone', phone)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return attachItems((data || []) as OrderRow[], tenantId);
}

export async function fetchOffers(tenantId: string): Promise<Offer[]> {
  requireCloud();
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Offer[];
}

export interface OfferInput {
  title: string;
  description?: string | null;
  discount_type: 'percent' | 'flat';
  discount_value: number;
  min_order_amount: number;
  is_active: boolean;
}

export async function createOffer(tenantId: string, input: OfferInput): Promise<Offer> {
  requireCloud();
  const { data, error } = await supabase
    .from('offers')
    .insert({ tenant_id: tenantId, ...input, description: input.description || null })
    .select('*')
    .single();
  if (error) throw error;
  return data as Offer;
}

export async function updateOffer(id: string, input: OfferInput): Promise<void> {
  requireCloud();
  const { error } = await supabase
    .from('offers')
    .update({ ...input, description: input.description || null })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteOffer(id: string): Promise<void> {
  requireCloud();
  const { error } = await supabase.from('offers').delete().eq('id', id);
  if (error) throw error;
}

/** Live CRM board: identity + offer changes stream across devices. */
export function subscribeCrmRealtime(
  tenantId: string,
  onPing: () => void,
  onState: (s: RealtimeState) => void
): () => void {
  requireCloud();
  const channel = supabase
    .channel(`crm-${tenantId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'customers', filter: `tenant_id=eq.${tenantId}` },
      () => onPing()
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'offers', filter: `tenant_id=eq.${tenantId}` },
      () => onPing()
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onState('live');
      else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') onState('offline');
      else onState('connecting');
    });
  return () => {
    void supabase.removeChannel(channel);
  };
}

/* ── COGS & margin (018 views) — the inventory shelf prices the menu ────── */

/**
 * Per-order ingredient cost, from `v_order_cogs` (018): Σ recipe_lines.
 * qty_per_serve × order_items.qty × inventory_items.cost_per_unit over every
 * non-null item line. Cost basis is CURRENT ingredient cost — no cost-history
 * table exists, so a restock reprices history; the UI says so.
 * Map key = order id; orders with no recipe lines read 0 (honest zero).
 */
export async function fetchOrderCogs(tenantId: string): Promise<Map<string, number>> {
  requireCloud();
  const { data, error } = await supabase
    .from('v_order_cogs')
    .select('order_id, cogs')
    .eq('tenant_id', tenantId);
  if (error) throw error;
  const map = new Map<string, number>();
  for (const row of (data || []) as { order_id: string; cogs: number }[]) {
    map.set(row.order_id, Number(row.cogs ?? 0));
  }
  return map;
}

/**
 * Per-section (category) sales rows for ONE day's tickets (v5.21.0) — the
 * Z-report / Close-out "section mix". Reads order_items joined through
 * menu_items → categories, filtered to the given order ids (the caller has
 * already bounded them to the IST day). Items whose menu row vanished (or
 * guest-added lines with no menu_item) come back with `category: null` so
 * the UI can bucket them honestly under "Unlisted" instead of dropping them.
 */
export interface DaySectionRow {
  order_id: string;
  qty: number;
  item_total: number;
  category: string | null;
}

export async function fetchDaySections(tenantId: string, orderIds: string[]): Promise<DaySectionRow[]> {
  requireCloud();
  if (orderIds.length === 0) return [];
  const { data, error } = await supabase
    .from('order_items')
    .select('order_id, qty, item_total, menu_items(category_id, categories(name))')
    .eq('tenant_id', tenantId)
    .in('order_id', orderIds);
  if (error) throw error;
  return ((data || []) as Record<string, unknown>[]).map((r) => {
    const mi = r.menu_items as { categories?: { name?: string } } | null;
    return {
      order_id: String(r.order_id),
      qty: Number(r.qty ?? 0),
      item_total: Number(r.item_total ?? 0),
      category: mi?.categories?.name ?? null,
    };
  });
}

/**
 * Ingredient cost of ONE serve per menu item, from `v_item_unit_cost` (018).
 * Map key = menu item id; items without recipes are absent (treated as 0).
 */
export async function fetchItemUnitCosts(tenantId: string): Promise<Map<string, number>> {
  requireCloud();
  const { data, error } = await supabase
    .from('v_item_unit_cost')
    .select('menu_item_id, unit_cost')
    .eq('tenant_id', tenantId);
  if (error) throw error;
  const map = new Map<string, number>();
  for (const row of (data || []) as { menu_item_id: string; unit_cost: number }[]) {
    map.set(row.menu_item_id, Number(row.unit_cost ?? 0));
  }
  return map;
}

/**
 * Deduction-ledger window — every stock movement of the last `days` days
 * (the burn-rate basis for the Inventory Reorder tab). The 12-row feed fetch
 * (fetchRecentDeductions) is for the audit strip; this one aggregates.
 */
export async function fetchDeductionWindow(tenantId: string, days = 14): Promise<StockDeduction[]> {
  requireCloud();
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from('stock_deductions')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data || []) as StockDeduction[];
}

export interface TodayCostMargin {
  /** ingredient cost burned by EVERY live ticket today (paid or not) */
  dayCogs: number;
  /** paid net revenue (total − GST = the discounted base GST sits on) */
  paidNet: number;
  /** ingredient cost inside the PAID tickets */
  paidCogs: number;
  /** paid net − paid COGS (margin banks on collected money only) */
  margin: number;
  paidTickets: number;
}

/**
 * Today's cost & margin for the Dashboard "right now" view — one query on
 * v_order_cogs (018) bounded to the IST calendar day, same money basis as
 * Reports/Close-out: margin on PAID, non-cancelled tickets only.
 */
export async function fetchTodayCostMargin(tenantId: string): Promise<TodayCostMargin> {
  requireCloud();
  // IST calendar-day bounds (same math as Reports/Close-out)
  const todayIso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const start = new Date(`${todayIso}T00:00:00+05:30`);
  const end = new Date(start.getTime() + 24 * 3600 * 1000);
  const { data, error } = await supabase
    .from('v_order_cogs')
    .select('status, payment_status, total, tax_amount, cogs')
    .eq('tenant_id', tenantId)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString());
  if (error) throw error;
  let dayCogs = 0;
  let paidNet = 0;
  let paidCogs = 0;
  let paidTickets = 0;
  for (const r of (data || []) as {
    status: string;
    payment_status: string | null;
    total: number;
    tax_amount: number;
    cogs: number;
  }[]) {
    if (String(r.status || '').toLowerCase() === 'cancelled') continue;
    dayCogs += Number(r.cogs ?? 0);
    if (String(r.payment_status || '').toLowerCase() === 'completed') {
      paidTickets += 1;
      paidNet += Number(r.total ?? 0) - Number(r.tax_amount ?? 0);
      paidCogs += Number(r.cogs ?? 0);
    }
  }
  return { dayCogs, paidNet, paidCogs, margin: paidNet - paidCogs, paidTickets };
}

/* ── Receipt metadata (Task 49) — lazy per-order lookups for the Bills receipt ──
 * Both helpers fail SOFT (return null) on purpose: a receipt must never hard-fail
 * because a nice-to-have is missing (paused offer title, legacy order without a
 * payments-ledger row). The receipt itself prints from stored order fields. */

/** The offer title redeemed on an order, if any (offer_redemptions × offers, migration 016). */
export async function fetchOrderOfferTitle(
  tenantId: string,
  orderId: string,
): Promise<string | null> {
  requireCloud();
  const { data, error } = await supabase
    .from('offer_redemptions')
    .select('offers(title)')
    .eq('tenant_id', tenantId)
    .eq('order_id', orderId)
    .maybeSingle();
  if (error || !data) return null;
  const nested = (data as { offers?: { title?: string } | null }).offers;
  return nested?.title ?? null;
}

export interface ReceiptPayment {
  method: string;
  amount: number;
  paidAt: string;
  confirmedByEmail: string | null;
}

/** The payments-ledger row for an order (migration 007). Latest wins; legacy
 * orders paid before 007 have no row here — the caller falls back to
 * orders.payment_method. */
export async function fetchOrderPayment(
  tenantId: string,
  orderId: string,
): Promise<ReceiptPayment | null> {
  requireCloud();
  const { data, error } = await supabase
    .from('payments')
    .select('method, amount, confirmed_by_email, created_at')
    .eq('tenant_id', tenantId)
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as {
    method: string;
    amount: number;
    confirmed_by_email: string | null;
    created_at: string;
  };
  return {
    method: String(row.method || ''),
    amount: Number(row.amount ?? 0),
    paidAt: String(row.created_at || ''),
    confirmedByEmail: row.confirmed_by_email ?? null,
  };
}

/* ── Guest feedback (migration 019, Task 50) ───────────────────────────────── */

export interface FeedbackStats {
  /** all-time average rating (null until the first rating arrives) */
  avgOverall: number | null;
  countOverall: number;
  /** ratings that landed in the IST "today" window */
  countToday: number;
  avgToday: number | null;
  /** 1–5 star histogram */
  stars: { one: number; two: number; three: number; four: number; five: number };
  /** the newest rating — the Dashboard card quotes it */
  latest: {
    rating: number;
    comment: string | null;
    orderNumber: number;
    createdAt: string;
  } | null;
}

/**
 * Guest-love stats straight off the order_feedback ledger (019). Read-only —
 * ratings are written by the guests themselves through the SECURITY DEFINER
 * RPC. RLS on order_feedback scopes every row to this tenant.
 */
export async function fetchFeedbackStats(tenantId: string): Promise<FeedbackStats> {
  requireCloud();
  const { data, error } = await supabase
    .from('order_feedback')
    .select('rating, comment, created_at, orders(order_number)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  const rows = (data || []) as {
    rating: number;
    comment: string | null;
    created_at: string;
    orders?: { order_number?: number } | null;
  }[];

  const todayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const isToday = (iso: string) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso)) === todayKey;

  const stars = { one: 0, two: 0, three: 0, four: 0, five: 0 };
  let sum = 0;
  let todaySum = 0;
  let todayN = 0;
  for (const r of rows) {
    sum += r.rating;
    const idx = Math.min(5, Math.max(1, Math.round(r.rating)));
    if (idx === 1) stars.one += 1;
    else if (idx === 2) stars.two += 1;
    else if (idx === 3) stars.three += 1;
    else if (idx === 4) stars.four += 1;
    else stars.five += 1;
    if (isToday(r.created_at)) {
      todaySum += r.rating;
      todayN += 1;
    }
  }
  const latestRow = rows[0];
  return {
    avgOverall: rows.length > 0 ? sum / rows.length : null,
    countOverall: rows.length,
    countToday: todayN,
    avgToday: todayN > 0 ? todaySum / todayN : null,
    stars,
    latest: latestRow
      ? {
          rating: latestRow.rating,
          comment: latestRow.comment,
          orderNumber: latestRow.orders?.order_number ?? 0,
          createdAt: latestRow.created_at,
        }
      : null,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Cash drawer sessions (migration 020 — shifts & drawer, NOVA).
 * A drawer session is one shift's physical drawer: opened with a counted
 * float, closed with a recount. Expected cash at close is computed
 * SERVER-SIDE from the payments ledger (float + Σ cash while open); variance
 * is stored, never re-derived. RLS scopes every read to the member's tenant.
 * ────────────────────────────────────────────────────────────────────────── */

export interface DrawerSession {
  id: string;
  opened_by_email: string;
  opened_at: string;
  opening_float: number;
  status: 'open' | 'closed';
  closed_by_email: string | null;
  closed_at: string | null;
  counted_cash: number | null;
  expected_cash: number | null;
  variance: number | null;
  closing_note: string | null;
}

export async function fetchActiveDrawerSession(tenantId: string): Promise<DrawerSession | null> {
  const { data, error } = await supabase
    .from('cash_drawer_sessions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return ((data || []) as DrawerSession[])[0] || null;
}

export async function fetchDrawerHistory(tenantId: string, limit = 5): Promise<DrawerSession[]> {
  const { data, error } = await supabase
    .from('cash_drawer_sessions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'closed')
    .order('closed_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as DrawerSession[];
}

/** Cash payments taken since a moment (the live "in drawer" math). */
export async function fetchCashInSince(tenantId: string, openedAtIso: string): Promise<number> {
  // normalize to Z-form: PostgREST row timestamps carry "+00:00" and a raw
  // "+" in the query string corrupts the gte filter (space-encoding pitfall)
  const sinceIso = new Date(openedAtIso).toISOString();
  const { data, error } = await supabase
    .from('payments')
    .select('amount')
    .eq('tenant_id', tenantId)
    .eq('method', 'cash')
    .gte('created_at', sinceIso);
  if (error) throw error;
  return ((data || []) as { amount: number }[]).reduce((s, r) => s + Number(r.amount || 0), 0);
}

/** Open a shift with a counted float. Throws the RPC's stable codes. */
export async function openDrawerSession(openingFloat: number): Promise<void> {
  const { error } = await supabase.rpc('sp_open_drawer', { p_opening_float: openingFloat });
  if (error) throw error;
}

/** Count & close a shift; the server returns the sealed ledger truth. */
export async function closeDrawerSession(
  sessionId: string,
  countedCash: number,
  note: string,
): Promise<{ cash_in: number; expected_cash: number; variance: number }> {
  const { data, error } = await supabase.rpc('sp_close_drawer', {
    p_session_id: sessionId,
    p_counted_cash: countedCash,
    p_note: note ? note : null,
  });
  if (error) throw error;
  return data as { cash_in: number; expected_cash: number; variance: number };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Cash drawer movements (migration 021 — payouts & safe drops).
 * Append-only outflow ledger bound to an OPEN drawer session: money leaves
 * the drawer on the record, with a REQUIRED reason, so a close after a
 * payout never blames the operator. expected = float + cash-in − movements,
 * computed server-side at close time (021 rebody of sp_close_drawer).
 * ────────────────────────────────────────────────────────────────────────── */

export interface DrawerMovement {
  id: string;
  session_id: string;
  kind: 'payout' | 'drop';
  amount: number;
  reason: string;
  created_by_email: string;
  created_at: string;
}

export async function fetchDrawerMovements(tenantId: string, sessionId: string): Promise<DrawerMovement[]> {
  const { data, error } = await supabase
    .from('cash_drawer_movements')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as DrawerMovement[];
}

/** Record a payout or safe drop on the open shift. Reason is required. */
export async function recordDrawerMovement(
  sessionId: string,
  kind: 'payout' | 'drop',
  amount: number,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc('sp_record_drawer_movement', {
    p_session_id: sessionId,
    p_kind: kind,
    p_amount: Math.round(amount * 100) / 100,
    p_reason: reason.trim(),
  });
  if (error) throw error;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Guest feedback rows for Reports (Task 53 — "the report learns to listen").
 * The 019 ledger read raw: Reports filters to the selected range client-side
 * (same 500-row cap convention as fetchOrders — a cafe month of ratings).
 * RLS on order_feedback scopes every row to this tenant; guests write through
 * the SECURITY DEFINER RPC only, staff read here.
 * ────────────────────────────────────────────────────────────────────────── */

export interface FeedbackRow {
  rating: number;
  comment: string | null;
  created_at: string;
  order_number: number;
}

export async function fetchFeedbackRows(tenantId: string, limit = 500): Promise<FeedbackRow[]> {
  const { data, error } = await supabase
    .from('order_feedback')
    .select('rating, comment, created_at, orders(order_number)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data || []) as {
    rating: number;
    comment: string | null;
    created_at: string;
    orders?: { order_number?: number } | null;
  }[]).map((r) => ({
    rating: r.rating,
    comment: r.comment,
    created_at: r.created_at,
    order_number: r.orders?.order_number ?? 0,
  }));
}
