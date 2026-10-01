/**
 * TSOS (The Simple Operating System) Types
 * Point-of-sale and cafe operations platform for India
 */

/**
 * UserRole — v4.0.0 role model (owner-mandated merge):
 *  - 'superadmin' : TSOS developer/platform operator — SuperAdmin Platform console ONLY
 *                   (provisions businesses + owner accounts; never the cafe POS by default).
 *  - 'owner'      : cafe owner — business dashboards, everything in the cafe app, creates staff logins.
 *  - 'staff'      : merged Manager+Cashier (v4.0.0) — operates the WHOLE cafe POS app.
 * Legacy values ('manager'|'cashier'|'kitchen'|'barista'|'chef'|'server') are normalized
 * to 'staff' at the auth boundary (see normalizeRole in lib/rbac.ts).
 */
export type UserRole = 'superadmin' | 'owner' | 'staff';

export type ThemeMode = 'servepoint' | 'tessera' | 'warm' | 'dark' | 'obsidian';

export type OrderType = 'dine_in' | 'takeaway' | 'delivery';

export type OrderStatus = 'new' | 'preparing' | 'ready' | 'completed' | 'cancelled';

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'split';

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export type TableStatus = 'free' | 'occupied' | 'reserved';

export type FeePayer = 'cafe' | 'customer';

export type IngredientUnit = 'g' | 'kg' | 'ml' | 'l' | 'pcs';

export interface Business {
  id: string;
  name: string;
  owner_user_id: string;
  created_at: string;
}

export interface Location {
  id: string;
  business_id: string;
  name: string;
  slug: string;
  address: string;
  phone: string;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  business_id: string;
  pin_code: string;
  is_active: boolean;
}

export interface MenuCategory {
  id: string;
  location_id: string;
  name: string;
  sort_order: number;
  icon?: string;
}

export interface MenuItemVariant {
  id: string;
  menu_item_id: string;
  name: string;
  price_delta: number; // e.g. +30 for Large
}

export interface Addon {
  id: string;
  location_id: string;
  name: string;
  price: number;
}

export interface MenuItem {
  id: string;
  location_id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  is_veg: boolean;
  is_available: boolean;
  tax_rate_pct: number; // e.g. 5% GST
  variants?: MenuItemVariant[];
  addon_ids?: string[];
}

export interface Ingredient {
  id: string;
  location_id: string;
  name: string;
  unit: IngredientUnit;
  stock_qty: number;
  low_stock_threshold: number;
}

export interface Recipe {
  id: string;
  menu_item_id: string;
  ingredient_id: string;
  qty_consumed: number; // in ingredient's base unit (g, ml, pcs)
}

export interface InventoryLog {
  id: string;
  ingredient_id: string;
  ingredient_name: string;
  change_qty: number;
  reason: 'order_consumed' | 'restock' | 'spoilage' | 'adjustment';
  ref_order_id?: string;
  created_at: string;
}

export interface DineTable {
  id: string;
  location_id: string;
  label: string; // e.g. "T1", "Table 4"
  seats: number;
  qr_token: string;
  status: TableStatus;
  current_order_id?: string;
}

export interface OrderItemAddonSelection {
  addon_id: string;
  name: string;
  price: number;
}

export interface CartItem {
  id: string; // unique cart line id
  menu_item: MenuItem;
  variant?: MenuItemVariant;
  addons: OrderItemAddonSelection[];
  qty: number;
  unit_price: number;
  item_total: number;
  notes?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  menu_item_name: string;
  variant_id?: string;
  variant_name?: string;
  qty: number;
  unit_price: number;
  item_total: number;
  notes?: string;
  addons?: OrderItemAddonSelection[];
}

export interface Order {
  id: string;
  order_number: number;
  location_id: string;
  table_id?: string;
  table_label?: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  order_type: OrderType;
  status: OrderStatus;
  placed_by: string; // "Cashier", "QR Storefront", "Waiter"
  subtotal: number;
  tax_total: number;
  discount_total: number;
  platform_fee: number;
  fee_payer: FeePayer;
  grand_total: number;
  payment_status: PaymentStatus;
  payment_method?: PaymentMethod;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
  notes?: string;
  loyalty_points_earned?: number;
  loyalty_points_redeemed?: number;
  inventory_deducted?: boolean;
}

export type LoyaltyTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  phone: string;
  email?: string;
  loyalty_points: number;
  total_orders: number;
  total_spent: number;
  created_at: string;
  tier?: LoyaltyTier;
}

export interface LoyaltyLedger {
  id: string;
  customer_id: string;
  points_delta: number; // positive = earned/bonus, negative = redeemed
  reason: string;
  ref_order_id?: string;
  created_at: string;
  balance_after?: number;
}

export type ConnectionStatus = 'connected' | 'syncing' | 'offline' | 'reconnecting';

export interface CloudSyncState {
  status: ConnectionStatus;
  lastSyncedAt: string;
  pendingChangesCount: number;
  latencyMs: number;
  endpoint: string;
  simulatedOffline: boolean;
}

export interface Offer {
  id: string;
  location_id: string;
  code: string;
  title: string;
  type: 'percent' | 'flat' | 'bogo';
  value: number; // e.g. 15 for 15% or 50 for ₹50 flat
  min_order_value: number;
  valid_from: string;
  valid_to: string;
  is_active: boolean;
}

export interface LocationFeeConfig {
  id: string;
  location_id: string;
  monthly_fee: number; // ₹0
  per_order_fee: number; // default ₹1
  default_fee_payer: FeePayer; // 'cafe' or 'customer'
  customer_paid_order_limit: number; // threshold e.g. 100 orders
  period_order_count: number; // current orders in billing cycle
  auto_flip_enabled: boolean;
}

export type StaffRole = 'barista' | 'cashier' | 'chef' | 'server' | 'manager' | 'cleaner';

export interface StaffMember {
  id: string;
  location_id: string;
  name: string;
  role: StaffRole;
  phone: string;
  hourly_rate: number; // in ₹ per hour (e.g. ₹200)
  pin_code: string;
  pin?: string;
  is_active: boolean;
  avatar?: string;
  joined_date: string;
}

export interface DrawerDenominations {
  d500: number;
  d200: number;
  d100: number;
  d50: number;
  d20: number;
  d10: number;
  coins: number;
}

export interface DrawerReconciliation {
  id: string;
  shift_id?: string;
  staff_id?: string;
  staff_name: string;
  reconciled_at: string; // ISO date
  opening_float: number;
  system_cash_sales: number;
  system_upi_sales: number;
  system_card_sales: number;
  system_total_sales: number;
  cash_orders_count: number;
  total_orders_count: number;
  denominations: DrawerDenominations;
  total_counted_cash: number;
  expected_cash: number; // opening_float + system_cash_sales
  variance: number; // total_counted_cash - expected_cash
  status: 'balanced' | 'surplus' | 'shortage';
  notes?: string;
}

export interface StaffShift {
  id: string;
  staff_id: string;
  staff_name: string;
  role: StaffRole;
  clock_in: string; // ISO date string
  clock_out?: string; // ISO date string or undefined if active
  break_minutes: number;
  hourly_rate: number;
  total_hours?: number; // net hours worked = (clock_out - clock_in) - break_minutes
  regular_hours?: number; // up to 8 hrs
  overtime_hours?: number; // > 8 hrs
  total_pay?: number; // in ₹
  status: 'active' | 'completed';
  notes?: string;
  reconciliation?: DrawerReconciliation;
}

export type ActiveSurface = 
  | 'web' 
  | 'android' 
  | 'windows' 
  | 'storefront' 
  | 'order_track' 
  | 'marketing_v1' 
  | 'marketing_v2' 
  | 'code_viewer'
  | 'superadmin';

export type BusinessStatus = 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'archived';

export type SubscriptionPlanId = 'starter' | 'growth' | 'pro' | 'enterprise';

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired';

export type BillingCycle = 'monthly' | 'quarterly' | 'annual';

export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  name: string;
  tagline: string;
  monthly_price: number; // in INR e.g. ₹999/mo
  annual_discount_pct: number;
  max_locations: number;
  max_tables: number;
  max_staff: number;
  features: string[];
  is_popular?: boolean;
}

export interface BusinessSubscription {
  id: string;
  business_id: string;
  plan_id: SubscriptionPlanId;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  monthly_price: number;
  applied_discount_pct: number;
  final_monthly_rate: number;
  deal_notes?: string;
  trial_start?: string;
  trial_end?: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  last_payment_status: 'paid' | 'pending' | 'failed';
  last_payment_at?: string;
  next_billing_at: string;
  payment_method_summary?: string;
}

export interface TenantBusiness {
  id: string;
  name: string;
  legal_name: string;
  display_name: string;
  slug: string;
  gst_number?: string;
  pan_number?: string;
  fssai_number?: string;
  upi_id?: string;
  business_email: string;
  business_phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  business_type: 'cafe' | 'restaurant' | 'quick_service' | 'bakery' | 'brewery' | 'cloud_kitchen';
  contact_person: string;
  owner_name: string;
  owner_email: string;
  owner_phone: string;
  status: BusinessStatus;
  locations_count: number;
  subscription: BusinessSubscription;
  total_orders_count: number;
  lifetime_revenue: number;
  created_at: string;
  updated_at: string;
  notes?: string;
}

export interface PlatformAuditLog {
  id: string;
  admin_email: string;
  action: string;
  target_business_id?: string;
  target_business_name?: string;
  details: string;
  timestamp: string;
}

export type WebTab = 
  | 'pos' 
  | 'kds' 
  | 'orders' 
  | 'menu' 
  | 'inventory' 
  | 'tables' 
  | 'customers' 
  | 'offers' 
  | 'shifts' 
  | 'reports' 
  | 'settings';

export type PrinterConnectionType = 'browser' | 'network' | 'bluetooth' | 'usb';
export type PaperWidth = '58mm' | '80mm';

export interface PrinterConfig {
  connection_type: PrinterConnectionType;
  paper_width: PaperWidth;
  ip_address?: string;
  port?: number;
  bluetooth_device_name?: string;
  auto_print_receipt: boolean;
  auto_print_kot: boolean;
  cut_paper: boolean;
  open_cash_drawer: boolean;
  print_logo: boolean;
  receipt_header?: string;
  receipt_footer?: string;
  gstin?: string;
  kot_printer_ip?: string;
}

export interface PrintLogEntry {
  id: string;
  order_id?: string;
  order_number?: number | string;
  document_type: 'bill' | 'kot' | 'test' | 'drawer_kick';
  printer_name: string;
  interface_type: PrinterConnectionType;
  paper_width: PaperWidth;
  status: 'success' | 'failed';
  error_message?: string;
  bytes_sent?: number;
  operator_name?: string;
  timestamp: string;
}

export interface GuidanceItem {
  id: string;
  title: string;
  description: string;
  actionHint?: string;
  shortcut?: string;
  category?: 'pos' | 'kds' | 'loyalty' | 'printer' | 'sync' | 'shift' | 'general';
}

export interface TourStep {
  id: string;
  title: string;
  description: string;
  targetTab?: WebTab;
  highlightSelector?: string;
  category: string;
}
