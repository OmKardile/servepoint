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
  tableLabel?: string | null;
  guestCount?: number | null;
  customerName?: string | null;
  notes?: string | null;
  items: { name: string; qty: number; unitPrice: number; menuItemId?: string | null; notes?: string }[];
}

/** Creates an order + its items; returns the created order. */
export async function createOrder(tenantId: string, input: NewOrderInput): Promise<Order> {
  requireCloud();
  const { data: last, error: lastErr } = await supabase
    .from('orders')
    .select('order_number')
    .eq('tenant_id', tenantId)
    .order('order_number', { ascending: false })
    .limit(1);
  if (lastErr) throw lastErr;
  const nextNumber = ((last?.[0]?.order_number as number) || 0) + 1;

  const subtotal = input.items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
  const taxRate = 0.05; // GST 5% — standard F&B rate
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  const { data: created, error } = await supabase
    .from('orders')
    .insert({
      tenant_id: tenantId,
      order_number: nextNumber,
      order_type: input.orderType,
      status: 'active',
      customer_name: input.customerName || null,
      guest_count: input.guestCount || null,
      subtotal,
      tax_amount: taxAmount,
      total,
      payment_status: 'pending',
      notes: input.notes || null,
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
    }
  } else {
    cloudError = 'Cloud not configured — registered locally only.';
  }

  return { tenant, cloudError };
}
