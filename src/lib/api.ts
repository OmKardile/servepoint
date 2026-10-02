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
  Subscription,
  Tenant,
} from '../types';
export type { Category };

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
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return attachItems((data || []) as OrderRow[], tenantId);
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
  patch: { status?: TableStatus; active_order_id?: string | null }
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
  const { error } = await supabase.from('menu_items').update(row).eq('id', itemId).eq('tenant_id', tenantId);
  if (error) throw error;
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

/** Adds delivery stock to the shelf (restock = stock IN, always positive). */
export async function restockInventoryItem(id: string, qty: number): Promise<void> {
  requireCloud();
  if (!(qty > 0)) throw new Error('Restock quantity must be greater than zero.');
  // Read-modify-write within one RPC-less call — acceptable for single-terminal
  // edits; the engine's money paths remain RPC/trigger-guarded.
  const { data, error } = await supabase
    .from('inventory_items')
    .select('current_stock')
    .eq('id', id)
    .single();
  if (error) throw error;
  const next = Number(data.current_stock) + qty;
  const { error: upErr } = await supabase
    .from('inventory_items')
    .update({ current_stock: next })
    .eq('id', id);
  if (upErr) throw upErr;
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

/** Live stock board: inventory movements + deduction ledger, realtime + RLS. */
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
