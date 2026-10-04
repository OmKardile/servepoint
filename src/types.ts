/**
 * ServePoint v5.0.0 — Production types (ADR-0014 rebuild).
 * Mirrors the live Supabase schema (migrations 001/003/004). No demo types.
 */

export type UserRole = 'superadmin' | 'owner' | 'staff';

export type OrderStatus = 'active' | 'paid' | 'cancelled';
export type OrderType = 'dine_in' | 'takeaway' | 'delivery';
export type PaymentMethod = 'cash' | 'card' | 'upi' | null;

export interface Category {
  id: string;
  tenant_id: string;
  name: string;
  icon?: string | null;
  sort_order: number | null;
  image_url?: string | null;
}

export interface MenuItemAddon {
  id: string;
  name: string;
  price: number;
}

/** Size/option pill (migration 012) — POS now loads them like the guest menu always has. */
export interface MenuItemVariant {
  id: string;
  name: string;
  price_delta: number;
}

export interface MenuItem {
  id: string;
  tenant_id: string;
  category_id: string;
  name: string;
  description?: string | null;
  price: number;
  image_url?: string | null;
  is_veg?: boolean | null;
  is_available: boolean | null;
  /** Optional add-on groups rendered in the item detail modal (Frame_30). */
  addons?: MenuItemAddon[] | null;
  /** Size/option pills (v5.55.0) — the counter sells the whole dish. */
  variants?: MenuItemVariant[] | null;
}

export interface OrderItem {
  id?: string;
  order_id?: string;
  menu_item_id?: string | null;
  name: string;
  variant_name?: string | null;
  qty: number;
  unit_price: number;
  item_total: number;
  notes?: string | null;
  /** v5.39.0 — the kitchen's tick: NULL = waiting on the line, timestamp =
   *  fired. Guarded server-side (029): only live tickets can be ticked. */
  checked_at?: string | null;
  image_url?: string | null;
  addons?: { name: string; price: number }[];
}

export interface Order {
  id: string;
  tenant_id: string;
  order_number: number;
  order_type: OrderType | string;
  status: OrderStatus | string;
  table_id?: string | null;
  table_session_id?: string | null;
  table_label?: string | null;
  guest_count?: number | null;
  customer_name?: string | null;
  /** v5.145.0 — loaded via fetchOrders' select(*); the bill's WhatsApp share
   *  opens the guest's DIRECT chat when present (wa.me grammar). */
  customer_phone?: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount?: number | null;
  total: number;
  payment_status?: string | null;
  payment_method?: PaymentMethod;
  notes?: string | null;
  created_at: string;
  items?: OrderItem[];
}

export interface Employee {
  id: string;
  tenant_id: string;
  email: string;
  role: UserRole;
  is_active: boolean | null;
  created_at: string;
}

export type NotificationCategory =
  | 'message'
  | 'system'
  | 'reminder'
  | 'promotion'
  | 'feedback';

export interface AppNotification {
  id: string;
  tenant_id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  is_read: boolean | null;
  /** v5.42.0 — the bell's door: the in-app section slug this card opens
   * (migration 032 — trigger generators stamp it; NULL means doorless). */
  link_to?: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  tenant_id: string;
  kind: 'team' | 'personal';
  name: string;
  member_names?: string[] | null;
  avatar_url?: string | null;
  last_message?: string | null;
  last_message_at?: string | null;
  unread_count?: number | null;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_name: string;
  body: string;
  created_at: string;
  /** Client-side: true when sender_name matches the signed-in user. */
  is_mine?: boolean;
}

/* v5.46.0 — presence (migration 035): who is at the app right now. One row
 * per (member, tenant); the 120s display window is the truth — freshness is
 * derived client-side, never stored as a boolean. */
export interface PresenceRow {
  user_email: string;
  sender_name: string;
  last_seen_at: string;
}

/** The roster behind the presence strip — 001 §15's tenant_users, projected
 * to what the strip needs (identity + role + liveness). */
export interface TeamMemberRow {
  email: string;
  role: string;
  is_active: boolean | null;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  business_type?: string | null;
  status: string;
  city?: string | null;
  owner_email?: string | null;
  owner_phone?: string | null;
  /** Legal identity — printed on the thermal receipt (Task 90): GSTIN turns
   *  a receipt into a tax invoice; FSSAI is the food-business licence. */
  legal_name?: string | null;
  gst_number?: string | null;
  fssai_number?: string | null;
  address?: string | null;
  logo_url?: string | null;
  created_at: string;
}

export interface Subscription {
  id: string;
  tenant_id: string;
  plan_id: string;
  billing_cycle: string;
  monthly_price: number;
  final_monthly_rate: number | null;
  status: string;
  next_billing_at?: string | null;
  /* v5.125.0 — the trial clock: the wire already carries these (select('*')),
   * the operator just never saw them. A trialing row without a trial_end
   * stays "—" — no invented dates. */
  trial_start?: string | null;
  trial_end?: string | null;
  current_period_end?: string | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  tenant_id?: string | null;
  actor_email: string;
  action: string;
  details: string;
  metadata?: Record<string, unknown> | null;
  timestamp: string;
  /** Generated alias of `timestamp` (migration 005) — kept for API parity. */
  created_at?: string;
}

/** Dashboard aggregates (computed from live orders in api.ts). */
export interface DashboardData {
  hourlySales: { hour: string; dineIn: number; takeaway: number; delivery: number }[];
  revenueByType: { name: string; value: number }[];
  /* v5.113.0 — the week is real: seven complete calendar days (local midnights,
   * oldest first), the same live grammar as the today cards (cancelled never
   * happened). Today's bucket IS the today card's numbers — the two views
   * must never disagree. 5.204.0 — each row carries its own day key: the
   * morning paper's replay door passes THE BUCKET'S key to Close-out, so
   * the day the tile names is the day the landing opens — the key travels
   * with the rupees instead of being re-derived from a second clock. */
  weeklyRevenue: {
    key: string;
    label: string;
    full: string;
    dineIn: number;
    takeaway: number;
    delivery: number;
    total: number;
  }[];
  /* v5.113.0 — plates across the same seven live days, same row shape as
   * trendingDishes so the card renders either with one grammar. */
  weeklyTrending: { name: string; tag: string; orders: number; image_url?: string | null }[];
  totalRevenue: number;
  totalOrders: number;
  ordersTrendPct: number;
  newCustomers: number;
  customersTrendPct: number;
  team: { name: string; role: string; since: string | null }[];
  trendingDishes: { name: string; tag: string; orders: number; image_url?: string | null }[];
}

/* ── Customers & Offers (migration 016 CRM) ─────────────────────────────── */

export interface Customer {
  id: string;
  tenant_id: string;
  name: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

/** Derived from the orders ledger by v_customer_stats — never stored, never stale. */
export interface CustomerStats {
  phone: string;
  orders_placed: number;
  visits: number;
  total_spent: number;
  last_visit_at: string | null;
}

export type OfferDiscountType = 'percent' | 'flat';

export interface Offer {
  id: string;
  tenant_id: string;
  title: string;
  description?: string | null;
  discount_type: OfferDiscountType;
  discount_value: number;
  min_order_amount: number;
  is_active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}
