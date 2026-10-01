/**
 * TSOS v5.0.0 — Production types (ServePoint rebuild, ADR-0014).
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
  image_url?: string | null;
}

export interface Order {
  id: string;
  tenant_id: string;
  order_number: number;
  order_type: OrderType | string;
  status: OrderStatus | string;
  table_id?: string | null;
  table_label?: string | null;
  guest_count?: number | null;
  customer_name?: string | null;
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

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  business_type?: string | null;
  status: string;
  city?: string | null;
  owner_email?: string | null;
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
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  actor: string | null;
  action: string;
  entity: string | null;
  details?: string | null;
  created_at: string;
}

/** Dashboard aggregates (computed from live orders in api.ts). */
export interface DashboardData {
  hourlySales: { hour: string; dineIn: number; takeaway: number; delivery: number }[];
  revenueByType: { name: string; value: number }[];
  totalRevenue: number;
  totalOrders: number;
  ordersTrendPct: number;
  newCustomers: number;
  customersTrendPct: number;
  bestEmployees: { name: string; role: string; sales: number }[];
  trendingDishes: { name: string; tag: string; orders: number; image_url?: string | null }[];
}
