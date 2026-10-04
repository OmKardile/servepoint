import { supabase, isSupabaseConfigured } from './supabase';
import { appTodayIso, appDayKey, appDayBoundsIso } from './appday';
import { moverWindow } from './movers';
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

/**
 * v5.82.0 — one ticket by id, for the floor's hold audit. When a held table's
 * active_order_id misses the board's latest-100 window, this targeted read
 * decides whether the hold is real (the ticket exists and is still live) or
 * stale (the ticket was hard-deleted, so migration 011's release trigger never
 * got its UPDATE and the hold outlived its own order). Returns null when the
 * id resolves to nothing — a ghost pointer, PROVEN, not guessed. Items ride
 * along through the same attachItems bridge fetchOrders uses, so callers get
 * a complete Order and the audit judges status and payment, never the plate.
 */
export async function fetchOrderById(tenantId: string, orderId: string): Promise<Order | null> {
  requireCloud();
  const { data, error } = await supabase
    .from('orders')
    .select('*, dining_tables(table_number)')
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { dining_tables, ...rest } = data as OrderRow & { dining_tables?: { table_number: string } | null };
  const row = { ...rest, table_label: dining_tables?.table_number ?? null } as OrderRow;
  return (await attachItems([row], tenantId))[0] ?? null;
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
  items: {
    name: string;
    qty: number;
    unitPrice: number;
    menuItemId?: string | null;
    variantName?: string | null;
    notes?: string;
    /* v5.56.0 — frozen extras for this line. The counter door finally writes
       order_item_addons (the guest RPC door has since 017). id is the live
       menu FK when known; repeat-synthesized lines pass null (the column is
       ON DELETE SET NULL — a snapshot needs no living addon row). */
    addons?: { id?: string | null; name: string; price: number }[];
  }[];
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
    // v5.55.0 — the counter finally writes the column the guest side always
    // did (direct insert, no RPC change — order_items.variant_name exists
    // since migration 001's lineage and attachItems already reads it back).
    variant_name: it.variantName || null,
    notes: it.notes || null,
  }));
  // .select('id') — v5.56.0 needs the generated order_items ids to hang the
  // add-on snapshots on (same rows in the same insertion order).
  const { data: insertedItems, error: itemsErr } = await supabase
    .from('order_items')
    .insert(rows)
    .select('id');
  if (itemsErr) throw itemsErr;

  // v5.56.0 — the counter's extras reach the ledger. order_item_addons is
  // the frozen name+price snapshot the guest RPC door has written since
  // migration 017; every reader (KDS would-be, receipts, bills, counter
  // inbox, floor cards, track page, repeat) already knows how to read it.
  // One bulk insert, only when extras exist; a ticket without extras is
  // byte-identical to the pre-5.56.0 path.
  const addonRows = input.items.flatMap((it, i) =>
    (it.addons || []).map((a) => ({
      tenant_id: tenantId,
      order_item_id: insertedItems?.[i]?.id,
      addon_id: a.id || null,
      name: a.name,
      price: a.price,
    })),
  );
  if (addonRows.length > 0) {
    if (!insertedItems || insertedItems.length !== rows.length) {
      throw new Error('Order items were written but the extras could not be attached. Please retry the ticket.');
    }
    const { error: addonsErr } = await supabase.from('order_item_addons').insert(addonRows);
    if (addonsErr) throw addonsErr;
  }

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
 * v5.59.0 — the party moves. A seated party asks for another table and the
 * LIVE ticket must move with them — until now the only path was cancel the
 * ticket, re-key it, and hope the kitchen hadn't fired it.
 *
 * Mechanics (migration 011's engine does the floor work, not this function):
 *   1. UPDATE orders.table_id → the trg_orders_sync_table trigger fires on
 *      UPDATE OF table_id and occupies the NEW table (status 'occupied',
 *      active_order_id = ticket). The floor's realtime subscription repaints
 *      both cards from that one table row change.
 *   2. The old table is released here — but ONLY if it still holds THIS
 *      ticket (a manual free may have beaten us; never fight the staff —
 *      the same courtesy the 011 release branch observes).
 *   3. Re-check the target is still free immediately before the write: the
 *      trigger occupies unconditionally, and two parties must never swap
 *      seats through one stale picker row.
 * Guest sessions are NOT migrated — the trail documents scans of a table's
 * QR, and those scans happened at the old table. The ticket moves; the scan
 * history stays where it was scanned (the drill says so).
 */
export async function moveOrderTable(
  orderId: string,
  fromTableId: string,
  toTableId: string,
  tenantId: string
): Promise<void> {
  requireCloud();

  // 0) target re-check — the picker listed it free, the floor may have moved on
  const { data: target, error: tgtErr } = await supabase
    .from('dining_tables')
    .select('id, status')
    .eq('id', toTableId)
    .eq('tenant_id', tenantId)
    .single();
  if (tgtErr) throw tgtErr;
  if (!target || target.status !== 'available') {
    throw new Error('That table is no longer free — pick another.');
  }

  // 1) point the ticket at the new table (011 trigger occupies it)
  const { error: moveErr } = await supabase
    .from('orders')
    .update({ table_id: toTableId, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('tenant_id', tenantId);
  if (moveErr) throw moveErr;

  // 2) release the old table only if THIS ticket still holds it
  const { error: relErr } = await supabase
    .from('dining_tables')
    .update({ status: 'available' as const, active_order_id: null })
    .eq('id', fromTableId)
    .eq('tenant_id', tenantId)
    .eq('active_order_id', orderId);
  if (relErr) {
    // put the ticket back — the floor must end this call exactly as it began
    await supabase
      .from('orders')
      .update({ table_id: fromTableId, updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .eq('tenant_id', tenantId);
    throw relErr;
  }
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
  /** ISO instant of the promised arrival. 5.98.0 — the client composes it
   *  as wall-clock in the OWNER'S chosen reporting clock (src/lib/appday.ts
   *  › appWallToInstant, Settings › Timezone); on every Indian device that
   *  is +05:30 exactly as before, and the math stays DST-safe elsewhere. */
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
  /* v5.113.0 — the window aligns to LOCAL MIDNIGHT six days back, not a
   * rolling 168h: the week card buckets are calendar days, and a rolling
   * window would undercount the oldest bar by whatever part of that day
   * fell outside the 168h. The today slice is unaffected (today begins at
   * local midnight either way). Same day grammar as the today cards —
   * toDateString local days; the reporting-tz flip is a Floor-book/CRM
   * seam, the Dashboard has always read the browser's own days. */
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - 6);
  const since = weekStart.toISOString();
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

  /* 5.99.0 — the counts join the revenue's grammar: cancelled never happened.
   * "Total Order" read todays.length (ALL of the day's rows), so a day with 1
   * real ticket and 17 QA-test cancellations said "18 orders" right above a
   * revenue chart that (correctly) summed only the one. An owner computing
   * ₹294 ÷ 18 got a fiction. New Customers had the same leak — a name on a
   * ticket that never happened is not a customer either. Both now read the
   * day's LIVE tickets, the same slice 5.94.0 gave Trending. */
  const liveToday = todays.filter((r) => String(r.status) !== 'cancelled');
  const liveYesterday = yesterdays.filter((r) => String(r.status) !== 'cancelled');

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

  /* v5.113.0 — the week is real. The query has walked seven days since the
   * card shipped; until now everything except today was dropped on the
   * floor and the Week view showed an honest stub instead of honest data.
   * Seven complete local-day buckets, oldest first, the SAME live grammar
   * (cancelled never happened) and the SAME typeMap — today's bucket must
   * equal the today card or the two views disagree. One pass, no extra
   * query: the buckets ride the rows the query already carried. */
  const weekBuckets = [] as {
    key: string;
    label: string;
    full: string;
    dineIn: number;
    takeaway: number;
    delivery: number;
  }[];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    weekBuckets.push({
      key: d.toDateString(),
      label: i === 0 ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'short' }),
      full: d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' }),
      dineIn: 0,
      takeaway: 0,
      delivery: 0,
    });
  }
  const weekIndex = new Map(weekBuckets.map((b, idx) => [b.key, idx]));
  const weekLiveIds = new Set<string>();
  rows.forEach((r) => {
    if (String(r.status) === 'cancelled') return;
    const idx = weekIndex.get(new Date(r.created_at).toDateString());
    if (idx === undefined) return;
    weekLiveIds.add(r.id);
    const type = typeMap[String(r.order_type || 'dine_in').toLowerCase()] || 'dineIn';
    weekBuckets[idx][type] += Number(r.total);
  });
  const weeklyRevenue = weekBuckets.map((b) => ({
    label: b.label,
    full: b.full,
    dineIn: b.dineIn,
    takeaway: b.takeaway,
    delivery: b.delivery,
    total: b.dineIn + b.takeaway + b.delivery,
  }));

  const totalRevenue = revByType.dineIn + revByType.takeaway + revByType.delivery;
  const uniqueToday = new Set(liveToday.map((r) => r.customer_name).filter(Boolean)).size;

  /* 5.94.0 — Trending counts TODAY's plates, not the museum. The item read
   *  below fetches wide (the fetchOrderCogs pattern), and until now nothing
   *  sliced it: "Trending · Today" summed every order_item ever written —
   *  all time, INCLUDING the cancelled tickets' never-happened lines (a
   *  cafe that sold 46 items this week read "Flat White · 65" under a
   *  TODAY header). The slice is the day's live ticket ids: cancelled never
   *  happened, earlier days are history, and the header finally tells the
   *  truth about the number under it. */
  const todayLiveIds = new Set(
    todays.filter((r) => String(r.status) !== 'cancelled').map((r) => r.id)
  );
  const { data: todayItems } = await supabase
    .from('order_items')
    .select('name, qty, order_id')
    .eq('tenant_id', tenantId);
  const dishCounts = new Map<string, { count: number; veg?: boolean | null; image?: string | null }>();
  (todayItems || []).forEach((it: any) => {
    if (!todayLiveIds.has(it.order_id)) return;
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

  /* v5.113.0 — the week's plates, from the SAME wide order_items fetch (one
   * query, two id-slices) and the SAME meta join. Top four like today; the
   * card renders either list with one grammar. */
  const weekDishCounts = new Map<
    string,
    { count: number; veg?: boolean | null; image?: string | null }
  >();
  (todayItems || []).forEach((it: any) => {
    if (!weekLiveIds.has(it.order_id)) return;
    const meta = (items || []).find((m: any) => m.name === it.name);
    const prev =
      weekDishCounts.get(it.name) || { count: 0, veg: meta?.is_veg, image: meta?.image_url };
    prev.count += Number(it.qty) || 1;
    weekDishCounts.set(it.name, prev);
  });
  const weeklyTrending = [...weekDishCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 4)
    .map(([name, v]) => ({
      name,
      tag: v.veg === false ? 'Signature' : 'Food',
      orders: v.count,
      image_url: v.image,
    }));

  /* 5.99.0 — the team card stops inventing money. It showed the workspace's
   * members with "sales" = totalRevenue × [0.42, 0.31, 0.17, 0.1][i] — a
   * hardcoded slice by list position. ₹123.00 was 42% of the day's revenue,
   * not anything the person sold; orders carry no staff attribution at all.
   * The card now says what IS true: real members, real roles, real tenure.
   * The card's caption states the seam out loud. */
  const team = (employees || [])
    .slice()
    .sort((a: any, b: any) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
    .slice(0, 4)
    .map((e: any) => ({
      name:
        (e.email || '')
          .split('@')[0]
          .replace(/[._]/g, ' ')
          .replace(/\b\w/g, (c: string) => c.toUpperCase()) || 'Team member',
      role:
        e.role === 'owner'
          ? 'Owner'
          : String(e.role || 'staff').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      since: e.created_at
        ? new Date(e.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
        : null,
    }));

  return {
    hourlySales: Object.entries(hourBuckets).map(([hour, v]) => ({ hour, ...v })),
    revenueByType: [
      { name: 'Dine-in', value: revByType.dineIn },
      { name: 'Takeaway', value: revByType.takeaway },
      { name: 'Delivery', value: revByType.delivery },
    ],
    weeklyRevenue,
    weeklyTrending,
    totalRevenue,
    totalOrders: liveToday.length,
    ordersTrendPct: pct(liveToday.length, liveYesterday.length),
    newCustomers: uniqueToday,
    customersTrendPct: pct(
      uniqueToday,
      new Set(liveYesterday.map((r) => r.customer_name).filter(Boolean)).size
    ),
    team,
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

/** v5.103.0 — the badge counts the truth the OWNER asked for: one query
 * pulls the category of every unread row, and the header does the prefs
 * math (the data layer stays prefs-blind). Replaces the old all-category
 * head-count, which counted bells the owner had muted. Best-effort by
 * design (the badge is a courtesy — a failed count just means no badge,
 * never a broken screen). */
export async function fetchUnreadCategoryCounts(tenantId: string): Promise<Record<string, number>> {
  requireCloud();
  const { data, error } = await supabase
    .from('notifications')
    .select('category')
    .eq('tenant_id', tenantId)
    .eq('is_read', false);
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const row of (data || []) as { category?: string }[]) {
    const cat = String(row.category || 'unknown');
    counts[cat] = (counts[cat] || 0) + 1;
  }
  return counts;
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

/** v5.108.0 — the chat unread feed's own realtime pulse (the rail badge's
 *  clock). Distinct channel name from subscribeMessagesRealtime's
 *  `messages-${tenantId}`: supabase-js dedupes channels by name and adding
 *  postgres_changes callbacks to an already-subscribed channel throws, so
 *  every consumer keeps its own name ('badge'/'list'/'shared' teach this).
 *  Two tables suffice: a new line INSERTs and the 031 touch trigger
 *  UPDATEs the room's preview — both ping the recount. Watermarks are
 *  client-side upserts; they need no socket. */
export function subscribeChatUnreadRealtime(
  tenantId: string,
  onPing: () => void
): () => void {
  requireCloud();
  const channel = supabase
    .channel(`chat-unread-${tenantId}`)
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
    .subscribe();
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

/* v5.126.0 — the tenant's own subscription, for the shell band. RLS does the
 * scoping ("Tenant read access on own subscription", migration 005) — the
 * query just asks for one row. Any failure resolves to null: the band treats
 * absence as silence, and a broken clock never invents urgency. */
/* v5.127.0 — split into two contracts over ONE query: the strict variant
 * throws on failure and returns null ONLY for a genuine absence (the
 * Settings panel must not read an RLS error as "no record"); the band's
 * wrapper keeps its silence-on-any-failure contract. */
export async function fetchOwnSubscriptionStrict(): Promise<Subscription | null> {
  requireCloud();
  const { data, error } = await supabase.from('subscriptions').select('*').limit(1);
  if (error) throw error;
  return (data?.[0] as Subscription) ?? null;
}

export async function fetchOwnSubscription(): Promise<Subscription | null> {
  return fetchOwnSubscriptionStrict().catch(() => null);
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

/* v5.77.0 — the bin's bill: the waste side of the 027 diary, aggregated.
   Every spoilage / spillage / damage row with its SKU joined (name, unit,
   cost-per-unit on file). Corrections are deliberately excluded — they
   reconcile the shelf, they didn't feed the bin; deliveries are stock IN.
   Value is computed at read time from |qty| × cost_per_unit — a SKU with
   no cost on file reads as unvalued, never as a guessed rupee. */
export interface WasteMove extends StockAdjustment {
  inventory_items: { name: string; unit: string; cost_per_unit: number | null };
}

export async function fetchWasteMoves(tenantId: string): Promise<WasteMove[]> {
  requireCloud();
  const { data, error } = await supabase
    .from('stock_adjustments')
    .select(
      'id, tenant_id, inventory_item_id, qty, reason, note, created_by_email, created_at, inventory_items!inner(name, unit, cost_per_unit)'
    )
    .eq('tenant_id', tenantId)
    .in('reason', ['spoilage', 'spillage', 'damage'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  /* The FK is many-to-one (every diary row has exactly one SKU) so PostgREST
     returns the embed as an OBJECT at runtime — but the generated types
     can't know the cardinality and demand a cast. Normalize defensively:
     if a future SDK ever hands the object over wrapped, unwrap row one. */
  return ((data || []) as unknown as (StockAdjustment & { inventory_items: WasteMove['inventory_items'] | WasteMove['inventory_items'][] })[]).map(
    (row) => ({
      ...row,
      inventory_items: Array.isArray(row.inventory_items) ? row.inventory_items[0] : row.inventory_items,
    })
  );
}

/** One paid order line, flattened for the shortlist (v5.78.0) — the raw row
 *  computeTopMovers groups. Flattened here so the ledger shape never leaks
 *  into the lib (the same boundary rule fetchWasteMoves obeys). */
export interface PaidMoverLine {
  order_id: string;
  menu_item_id: string | null;
  name: string;
  qty: number;
  unit_price: number;
}

/** The shortlist's raw material: every line of every PAID ticket in the last
 *  `days` REPORTING days — moverWindow's ledger week (5.202.0: N calendar
 *  days ending today, the same shape Reports' "Last 7 days" speaks; the
 *  old private rolling `now − days·24h` let the medallion and the rank
 *  disagree as the ledger aged past the boundary). Paid truth mirrors
 *  isPaidTicket at the DB level (status ≠ cancelled AND payment_status =
 *  completed) — one definition, two floors. The !inner embed on orders is
 *  a FILTER, not a join fetch: order_items denormalize everything the rail
 *  needs. The window is [start, end) — .lt end-cap keeps exact parity with
 *  the client-side range filter (t >= end excluded, no future leak). */
export async function fetchPaidMoverLines(tenantId: string, days: number): Promise<PaidMoverLine[]> {
  requireCloud();
  const { startMs, endMs } = moverWindow(days);
  const sinceIso = new Date(startMs).toISOString();
  const untilIso = new Date(endMs).toISOString();
  const { data, error } = await supabase
    .from('order_items')
    .select(
      'order_id, menu_item_id, name, qty, unit_price, orders!inner(status, payment_status, created_at)'
    )
    .eq('tenant_id', tenantId)
    .neq('orders.status', 'cancelled')
    .eq('orders.payment_status', 'completed')
    .gte('orders.created_at', sinceIso)
    .lt('orders.created_at', untilIso);
  if (error) throw error;
  return ((data || []) as unknown as PaidMoverLine[]).map((r) => ({
    order_id: r.order_id,
    menu_item_id: r.menu_item_id ?? null,
    name: r.name,
    qty: Number(r.qty) || 0,
    unit_price: Number(r.unit_price) || 0,
  }));
}

/**
 * v5.114.0 — the rail's stock count: every SKU at or below its reorder
 * point, INCLUDING out-of-stock (an out item is the most urgent member of
 * the set, not a separate quieter story). Two columns, no ids — the same
 * client-side filter the Inventory shelf's level tones speak, so the rail
 * badge and the shelf can never disagree about an item.
 */
export async function fetchLowStockCount(tenantId: string): Promise<number> {
  requireCloud();
  const { data, error } = await supabase
    .from('inventory_items')
    .select('current_stock, reorder_point')
    .eq('tenant_id', tenantId);
  if (error) throw error;
  const rows = (data || []) as { current_stock: number; reorder_point: number }[];
  return rows.filter((r) => Number(r.current_stock) <= Number(r.reorder_point)).length;
}

/**
 * Live stock board: shelf + deduction ledger + hand-made diary, realtime + RLS.
 *
 * `channelTag` — v5.114.0: supabase-js dedupes channels by NAME, and adding
 * postgres_changes callbacks to an already-subscribed channel THROWS (the
 * unread.ts 'badge' lesson). The rail's stock feed and this screen's board
 * subscription both tap the same three tables, so each consumer owns a
 * channel name of its own — two small taps, never one shared room.
 */
export function subscribeInventoryRealtime(
  tenantId: string,
  onPing: () => void,
  onState: (s: RealtimeState) => void,
  channelTag = 'screen'
): () => void {
  requireCloud();
  const channel = supabase
    .channel(`inventory-${tenantId}-${channelTag}`)
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
 * v_order_cogs (018) bounded to the reporting calendar day (5.97.0: the
 * Settings timezone via src/lib/appday.ts — Asia/Kolkata by default), same
 * money basis as Reports/Close-out: margin on PAID, non-cancelled tickets.
 */
export async function fetchTodayCostMargin(tenantId: string): Promise<TodayCostMargin> {
  requireCloud();
  // Reporting-day bounds (same math as Reports/Close-out)
  const { startIso, endIso } = appDayBoundsIso(appTodayIso());
  const start = new Date(startIso);
  const end = new Date(endIso);
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

/* ── The offer's scorecard (5.71.0) — offers finally answer for themselves.
 * 016 wrote every redemption into a ledger row (UNIQUE(order_id), the
 * discount's exact paise) but no surface ever read them as a season: the
 * owner could create and pause offers yet never see which one performed.
 * One bounded read joins the redemption ledger to its offer and ticket. */

export interface OfferRedemptionRow {
  offerId: string;
  title: string;
  discountType: string;
  discountValue: number;
  isActive: boolean;
  /** the paise the offer took off THIS ticket (the ledger's stored truth) */
  discountAmount: number;
  /** the total the ticket walked in with (null on a rare orphaned ticket) */
  orderTotal: number | null;
  createdAt: string;
}

export async function fetchOfferRedemptions(tenantId: string, limit = 500): Promise<OfferRedemptionRow[]> {
  requireCloud();
  const { data, error } = await supabase
    .from('offer_redemptions')
    .select('offer_id, discount_amount, created_at, offers(title, discount_type, discount_value, is_active), orders(total)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data || []) as {
    offer_id: string;
    discount_amount: number;
    created_at: string;
    offers?: { title?: string; discount_type?: string; discount_value?: number; is_active?: boolean } | null;
    orders?: { total?: number } | null;
  }[]).map((r) => ({
    offerId: r.offer_id,
    title: r.offers?.title ?? 'an offer since gone',
    discountType: r.offers?.discount_type ?? 'percent',
    discountValue: Number(r.offers?.discount_value ?? 0),
    isActive: r.offers?.is_active ?? false,
    discountAmount: Number(r.discount_amount ?? 0),
    orderTotal: r.orders?.total != null ? Number(r.orders.total) : null,
    createdAt: r.created_at,
  }));
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

/* ── Split bills (5.63.0) — the ledger already holds one row per payment;
 *    a ticket may now be SETTLED across several of them. Non-covering parts
 *    are plain member inserts (RLS "payments member all"); the covering part
 *    rides the guarded sp_record_payment, which flips the order exactly once,
 *    when the last part lands. Zero migration — 007's table was built for
 *    this, the client simply stopped assuming one row per ticket. */

/** ALL ledger rows for an order, oldest first. A one-shot ticket sees one
 * row; a split ticket sees N. Fails soft (empty list) — the ledger is
 * progress display, never the ticket's own truth (that lives on orders). */
export async function fetchOrderPayments(
  tenantId: string,
  orderId: string,
): Promise<ReceiptPayment[]> {
  requireCloud();
  const { data, error } = await supabase
    .from('payments')
    .select('method, amount, confirmed_by_email, created_at')
    .eq('tenant_id', tenantId)
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return (
    data as {
      method: string;
      amount: number;
      confirmed_by_email: string | null;
      created_at: string;
    }[]
  ).map((row) => ({
    method: String(row.method || ''),
    amount: Number(row.amount ?? 0),
    paidAt: String(row.created_at || ''),
    confirmedByEmail: row.confirmed_by_email ?? null,
  }));
}

/**
 * v5.181.0 — the settle moments for MANY orders in one read: the floor's
 * turn census measures a finished seat as created → LAST settle (a split
 * ticket frees the table when its final part lands, so the newest row per
 * order is the seat's end). Empty map on any failure — the census reads
 * silence from an unread ledger and from an honest zero alike, and the
 * caller cannot tell them apart by design (neither may speak).
 */
export async function fetchPaymentMoments(
  tenantId: string,
  orderIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (orderIds.length === 0) return out;
  requireCloud();
  const { data, error } = await supabase
    .from('payments')
    .select('order_id, created_at')
    .eq('tenant_id', tenantId)
    .in('order_id', orderIds)
    .order('created_at', { ascending: false });
  if (error || !data) return out;
  for (const r of data as { order_id: string; created_at: string }[]) {
    // rows arrive newest-first: first sight of an order IS its last settle
    if (!out.has(r.order_id)) out.set(r.order_id, String(r.created_at || ''));
  }
  return out;
}

/** Records ONE NON-COVERING part of a split: a ledger row and nothing else —
 * the order stays honestly pending until a later part covers the ticket.
 * Amount/positive are re-guarded here (the table CHECK also holds). */
export async function insertPartialPayment(
  tenantId: string,
  orderId: string,
  method: PaymentMethod,
  amount: number,
  actorEmail: string,
): Promise<void> {
  requireCloud();
  if (!(amount > 0)) throw new Error('Payment amount must be greater than zero.');
  const { error } = await supabase.from('payments').insert({
    tenant_id: tenantId,
    order_id: orderId,
    method,
    amount,
    status: 'paid',
    confirmed_by_email: actorEmail,
  });
  if (error) throw error;
}

/** Paid-so-far per order, bounded to the ids you pass (the unpaid column) —
 * feeds the "₹X in · ₹Y open" badges on the Bills list. */
export async function fetchOpenPaymentSums(
  tenantId: string,
  orderIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!tenantId || orderIds.length === 0) return map;
  requireCloud();
  const { data, error } = await supabase
    .from('payments')
    .select('order_id, amount')
    .eq('tenant_id', tenantId)
    .in('order_id', orderIds);
  if (error || !data) return map;
  for (const r of data as { order_id: string; amount: number }[]) {
    map.set(r.order_id, (map.get(r.order_id) || 0) + Number(r.amount || 0));
  }
  return map;
}

/** Ledger rows whose money moved inside a window (5.64.0) — Reports' pay-mix
 * reads each PART under its own method instead of attributing a split ticket's
 * whole total to whichever method covered the balance. Fails soft (empty). */
export async function fetchPaymentsInRange(
  tenantId: string,
  startIso: string | null,
  endIso: string,
): Promise<(ReceiptPayment & { orderId: string })[]> {
  requireCloud();
  let q = supabase
    .from('payments')
    .select('order_id, method, amount, confirmed_by_email, created_at')
    .eq('tenant_id', tenantId)
    .lt('created_at', endIso)
    .order('created_at', { ascending: true });
  if (startIso) q = q.gte('created_at', startIso);
  const { data, error } = await q;
  if (error || !data) return [];
  return (
    data as {
      order_id: string;
      method: string;
      amount: number;
      confirmed_by_email: string | null;
      created_at: string;
    }[]
  ).map((row) => ({
    orderId: String(row.order_id || ''),
    method: String(row.method || ''),
    amount: Number(row.amount ?? 0),
    paidAt: String(row.created_at || ''),
    confirmedByEmail: row.confirmed_by_email ?? null,
  }));
}

/* ── Kitchen speed (5.67.0): the status-hop ledger, read raw ───────────────── */

export interface StatusHop {
  orderId: string;
  fromStatus: string;
  toStatus: string;
  atIso: string;
}

/**
 * Raw status hops for a window — 007's order_status_history, the
 * trigger-written trail of every status transition (placed → fired → ready →
 * done). Reports computes the kitchen-speed story from these hops; this
 * reader stays dumb on purpose. Read is bounded to the window (the caller
 * adds a tail so a ticket that fired just after midnight still lands),
 * tenant-scoped by RLS, and fail-soft like every Reports sidecar.
 */
export async function fetchStatusHopsInRange(
  tenantId: string,
  startIso: string | null,
  endIso: string,
): Promise<StatusHop[]> {
  requireCloud();
  let q = supabase
    .from('order_status_history')
    .select('order_id, from_status, to_status, created_at')
    .eq('tenant_id', tenantId)
    .lt('created_at', endIso)
    .order('created_at', { ascending: true });
  if (startIso) q = q.gte('created_at', startIso);
  const { data, error } = await q;
  if (error || !data) return [];
  return (
    data as {
      order_id: string;
      from_status: string;
      to_status: string;
      created_at: string;
    }[]
  ).map((row) => ({
    orderId: String(row.order_id || ''),
    fromStatus: String(row.from_status || ''),
    toStatus: String(row.to_status || ''),
    atIso: String(row.created_at || ''),
  }));
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

  /* v5.106.0 — "today" rides the reporting clock (appday): the same voice
     the Dashboard's Guest love card and the Reports screen speak. The old
     bucket was hardcoded Asia/Kolkata, so on a non-IST reporting day the
     card counted a different "today" than the screen it sits on. */
  const todayKey = appTodayIso();
  const isToday = (iso: string) => appDayKey(iso) === todayKey;

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
  /** 5.70.0 — the guest identity the ticket carried (null on anonymous
   *  takeaways): the recover list can name WHO to call back, not just
   *  WHICH ticket went wrong. */
  customer_name?: string | null;
  customer_phone?: string | null;
}

export async function fetchFeedbackRows(tenantId: string, limit = 500): Promise<FeedbackRow[]> {
  const { data, error } = await supabase
    .from('order_feedback')
    .select('rating, comment, created_at, orders(order_number, customer_name, customer_phone)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data || []) as {
    rating: number;
    comment: string | null;
    created_at: string;
    orders?: { order_number?: number; customer_name?: string | null; customer_phone?: string | null } | null;
  }[]).map((r) => ({
    rating: r.rating,
    comment: r.comment,
    created_at: r.created_at,
    order_number: r.orders?.order_number ?? 0,
    customer_name: r.orders?.customer_name ?? null,
    customer_phone: r.orders?.customer_phone ?? null,
  }));
}
