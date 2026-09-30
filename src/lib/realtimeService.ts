import { supabase, isSupabaseConfigured } from './supabase';
import { Order, OrderStatus, DineTable } from '../types';

const OFFLINE_QUEUE_KEY = 'tsos_pending_offline_orders';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Local order id → Supabase order UUID mapping.
 * The local reactive store uses friendly ids (`ord-…`) while the live schema
 * enforces UUID primary keys. After a successful cloud insert we remember the
 * mapping so KDS bump / status updates can target the correct cloud row.
 */
const localToCloudOrderId = new Map<string, string>();

/**
 * Cached tenant/location cloud UUID resolution (keyed by local pair).
 * Resolves once per session per tenant/location combination — demo ids like
 * `biz_coolkafe_99` / `loc-demo-01` are translated to their live UUID rows
 * exactly like the menu hydration path does by slug lookup.
 */
const cloudIdCache = new Map<string, { tenantId: string; locationId: string }>();

const resolveCloudIds = async (
  tenantId: string,
  locationId: string,
  tenantSlug?: string
): Promise<{ tenantId: string; locationId: string } | null> => {
  const cacheKey = `${tenantId}::${locationId}`;
  const cached = cloudIdCache.get(cacheKey);
  if (cached) return cached;

  // Already valid UUIDs (e.g. provisioned-through-cloud tenants) — pass through.
  if (UUID_RE.test(tenantId) && UUID_RE.test(locationId)) {
    const passthrough = { tenantId, locationId };
    cloudIdCache.set(cacheKey, passthrough);
    return passthrough;
  }

  try {
    // Step 1: resolve tenant UUID — prefer slug lookup (same as menu hydration).
    let resolvedTenantId = UUID_RE.test(tenantId) ? tenantId : null;
    if (!resolvedTenantId && tenantSlug) {
      const { data: tRow, error: tErr } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .maybeSingle();
      if (!tErr && tRow?.id) resolvedTenantId = tRow.id;
    }
    if (!resolvedTenantId) return null;

    // Step 2: resolve location UUID — first location owned by the tenant.
    let resolvedLocationId = UUID_RE.test(locationId) ? locationId : null;
    if (!resolvedLocationId) {
      const { data: lRows, error: lErr } = await supabase
        .from('locations')
        .select('id')
        .eq('tenant_id', resolvedTenantId)
        .limit(1);
      if (!lErr && lRows && lRows.length > 0) resolvedLocationId = lRows[0].id;
    }
    if (!resolvedLocationId) return null;

    const resolved = { tenantId: resolvedTenantId, locationId: resolvedLocationId };
    cloudIdCache.set(cacheKey, resolved);
    return resolved;
  } catch {
    return null;
  }
};

export interface PendingOfflineOrder {
  id: string;
  order: Order;
  tenantId: string;
  locationId: string;
  tenantSlug?: string;
  timestamp: string;
}

export const realtimeService = {
  /**
   * Subscribe to live Supabase Postgres Changes for KDS, POS, and Storefront
   */
  subscribeToTenantRealtime(
    tenantId: string,
    callbacks: {
      onOrderInserted?: (order: any) => void;
      onOrderUpdated?: (order: any) => void;
      onTableUpdated?: (table: any) => void;
    }
  ) {
    if (!isSupabaseConfigured()) {
      return () => {};
    }

    try {
      const channel = supabase
        .channel(`pos-realtime-${tenantId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'orders',
          },
          (payload) => {
            if (callbacks.onOrderInserted) {
              callbacks.onOrderInserted(payload.new);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
          },
          (payload) => {
            if (callbacks.onOrderUpdated) {
              callbacks.onOrderUpdated(payload.new);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'dining_tables',
          },
          (payload) => {
            if (callbacks.onTableUpdated) {
              callbacks.onTableUpdated(payload.new);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (err) {
      console.warn('Realtime channel error:', err);
      return () => {};
    }
  },

  /**
   * Sync Order to Supabase with offline queue fallback
   */
  async syncOrderToSupabase(
    order: Order,
    tenantId: string,
    locationId: string,
    tenantSlug?: string
  ): Promise<{ success: boolean; queued: boolean }> {
    if (isSupabaseConfigured() && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        // Demo/local ids (biz_coolkafe_99, loc-demo-01) are NOT valid UUIDs —
        // resolve them to the live cloud rows before inserting (mirrors menu
        // hydration). If resolution fails, queue locally instead of hammering
        // Postgres with 22P02 invalid-input errors.
        const cloudIds = await resolveCloudIds(tenantId, locationId, tenantSlug);
        if (!cloudIds) {
          this.queuePendingOrder(order, tenantId, locationId, tenantSlug);
          return { success: true, queued: true };
        }

        // Format table ID as valid UUID if needed
        const tableId = order.table_id && UUID_RE.test(order.table_id)
          ? order.table_id
          : null;

        const { data: orderData, error: orderErr } = await supabase
          .from('orders')
          .insert({
            tenant_id: cloudIds.tenantId,
            location_id: cloudIds.locationId,
            table_id: tableId,
            order_type: order.order_type,
            status: order.status,
            customer_name: order.customer_name || null,
            customer_phone: order.customer_phone || null,
            subtotal: order.subtotal,
            tax_amount: order.tax_total,
            platform_fee: order.platform_fee,
            discount_amount: order.discount_total,
            total: order.grand_total,
            payment_status: order.payment_status,
            payment_method: order.payment_method || 'cash',
            notes: order.notes || null,
          })
          .select('id')
          .single();

        if (orderErr) {
          throw orderErr;
        }

        // Remember local→cloud id mapping so later status updates (KDS bump,
        // cashier advance) target the correct cloud row.
        if (orderData?.id && order.id) {
          localToCloudOrderId.set(order.id, orderData.id);
        }

        if (orderData?.id && order.items?.length > 0) {
          const itemInserts = order.items.map((i) => ({
            tenant_id: cloudIds.tenantId,
            order_id: orderData.id,
            name: i.menu_item_name,
            variant_name: i.variant_name || null,
            qty: i.qty,
            unit_price: i.unit_price,
            item_total: i.item_total,
            notes: i.notes || null,
          }));

          await supabase.from('order_items').insert(itemInserts);
        }

        return { success: true, queued: false };
      } catch (err: any) {
        // Discriminate the failure so operators see WHY the cloud insert failed:
        //  - 42501: RLS policy denies anon inserts (migration 001 DDL/policies
        //    not yet re-run) → order stays local, retry later via offline queue.
        //  - network / auth errors → queued for auto-flush on reconnect.
        if (err?.code === '42501') {
          console.info(
            '[TSOS] Cloud order insert blocked by RLS (anon policy pending — re-run migration 001). Order kept local + queued.'
          );
        } else {
          console.warn('Supabase order insert failed, queueing locally:', err);
        }
      }
    }

    // Queue in offline storage
    this.queuePendingOrder(order, tenantId, locationId, tenantSlug);
    return { success: true, queued: true };
  },

  /**
   * Update order status in Supabase (e.g. KDS Bump)
   */
  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<boolean> {
    if (isSupabaseConfigured() && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        // Translate local order id to its cloud UUID when known; skip entirely
        // for non-UUID ids with no mapping (avoids 22P02 invalid-input errors).
        const cloudOrderId = UUID_RE.test(orderId)
          ? orderId
          : localToCloudOrderId.get(orderId);
        if (!cloudOrderId) return false;

        const { error } = await supabase
          .from('orders')
          .update({
            status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', cloudOrderId);

        if (!error) return true;
      } catch (err) {
        console.warn('Failed to update order status in Supabase:', err);
      }
    }
    return false;
  },

  /**
   * Offline Queue Management
   */
  queuePendingOrder(order: Order, tenantId: string, locationId: string, tenantSlug?: string) {
    if (typeof window === 'undefined') return;
    try {
      const queue = this.getOfflineQueue();
      queue.push({
        id: `pending_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        order,
        tenantId,
        locationId,
        tenantSlug,
        timestamp: new Date().toISOString(),
      });
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch {}
  },

  getOfflineQueue(): PendingOfflineOrder[] {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(OFFLINE_QUEUE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async flushOfflineQueue(): Promise<number> {
    if (!isSupabaseConfigured() || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return 0;
    }

    const queue = this.getOfflineQueue();
    if (queue.length === 0) return 0;

    let syncedCount = 0;
    const remaining: PendingOfflineOrder[] = [];

    for (const item of queue) {
      try {
        const res = await this.syncOrderToSupabase(
          item.order,
          item.tenantId,
          item.locationId,
          item.tenantSlug
        );
        if (!res.queued) {
          syncedCount++;
        } else {
          remaining.push(item);
        }
      } catch {
        remaining.push(item);
      }
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    }

    return syncedCount;
  },
};

// Auto-flush when browser comes back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    realtimeService.flushOfflineQueue();
  });
}
