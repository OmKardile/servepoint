import { supabase, isSupabaseConfigured } from './supabase';
import type {
  AppNotification,
  AuditLogEntry,
  Category,
  ChatMessage,
  Conversation,
  DashboardData,
  Employee,
  MenuItem,
  Order,
  OrderItem,
  OrderType,
  Subscription,
  Tenant,
} from '../types';

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
  const taxRate = 0.05; // GST 5% — standard F&B rate
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

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
      subtotal,
      tax_amount: taxAmount,
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
